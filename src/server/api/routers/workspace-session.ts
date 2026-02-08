import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { TRPCError } from "@trpc/server";
import { inngest } from "@/server/inngest/client";
import { sessionEmitter } from '@/lib/engine/session-emitter';
import { type ExecutionContext, LLMConfigSchema, ExecutionContextSchema } from '@/lib/engine/types';

// Using a literal union to match the Prisma enum without requiring a direct enum import if possible, 
// but Zod enum is safer for validation.
const SessionStatusEnum = z.enum(["ACTIVE", "COMPLETED", "ERROR"]);

const LLMConfigInput = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
}).optional();

export const workspaceSessionRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ 
      workflowId: z.string(),
      status: SessionStatusEnum.optional(),
    }))
    .query(async ({ input, ctx }) => {
      // First verify workflow ownership
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.workflowId },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      return prisma.workflowSession.findMany({
        where: {
          workflowId: input.workflowId,
          ...(input.status && { status: input.status }),
        },
        orderBy: {
          startedAt: "desc",
        },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const session = await prisma.workflowSession.findUnique({
        where: { id: input.id },
        include: {
          workflow: true,
        }
      });

      if (!session || session.workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or unauthorized",
        });
      }

      return session;
    }),

  getTrace: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const session = await prisma.workflowSession.findUnique({
        where: { id: input.id },
        include: {
          workflow: true,
          traces: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!session || session.workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or unauthorized",
        });
      }

      return session;
    }),

  // ========================================
  // Start a new workflow session
  // ========================================
  start: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      llmConfig: LLMConfigInput,
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify workflow ownership
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.workflowId },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      // Create a new session
      const session = await prisma.workflowSession.create({
        data: {
          workflowId: input.workflowId,
          status: "ACTIVE",
          metadata: {},
        },
      });

      // Trigger Inngest workflow execution (non-blocking)
      // In dev, Inngest dev server must be running: npx inngest-cli@latest dev
      try {
        await inngest.send({
          name: "workflow/execute",
          data: {
            sessionId: session.id,
            workflowId: input.workflowId,
            llmConfig: input.llmConfig,
          },
        });
      } catch (error) {
        console.error("Failed to send Inngest event (is Inngest dev server running?):", error);
        // Don't fail the request - session is created, just can't execute yet
      }

      return { sessionId: session.id };
    }),

  // ========================================
  // Resume a paused session with user input
  // ========================================
  resume: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      userInput: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify session ownership
      const session = await prisma.workflowSession.findUnique({
        where: { id: input.sessionId },
        include: { workflow: true },
      });

      if (!session || session.workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or unauthorized",
        });
      }

      if (session.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Session is not active (status: ${session.status})`,
        });
      }

      // Update status to 'running' immediately so polling clients don't see 'waiting' state from previous turn
      // preserving existing metadata structure
      const currentMetadata = session.metadata as Record<string, any>;
      const currentContext = currentMetadata.context || currentMetadata; // Handle both formats
      
      const updatedMetadata = {
        ...currentMetadata,
        context: {
          ...currentContext,
          status: 'running',
        }
      };

      await prisma.workflowSession.update({
        where: { id: input.sessionId },
        data: {
          metadata: updatedMetadata,
        },
      });

      // NO POLLING: Notify the SSE stream that we're now running
      sessionEmitter.notifyUpdate(input.sessionId, {
        sessionId: input.sessionId,
        status: 'ACTIVE',
        context: updatedMetadata.context,
      });

      // Send execute event with user input - this resumes the workflow
      // The function will load saved context from DB (which we just updated to running) and continue
      try {
        await inngest.send({
          name: "workflow/execute",
          data: {
            sessionId: input.sessionId,
            workflowId: session.workflowId,
            userInput: input.userInput,
          },
        });
      } catch (error) {
        console.error("Failed to send Inngest event:", error);
      }

      return { success: true };
    }),

  // ========================================
  // Get current execution context for a session
  // ========================================
  getContext: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const session = await prisma.workflowSession.findUnique({
        where: { id: input.sessionId },
        include: { workflow: true },
      });

      if (!session || session.workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or unauthorized",
        });
      }

      // Handle both old format (metadata = context) and new format (metadata = { context, llmConfig })
      let context: ExecutionContext | null = null;
      if (session.metadata && typeof session.metadata === 'object') {
        const metadata = session.metadata as Record<string, unknown>;
        if ('context' in metadata && typeof metadata.context === 'object') {
          // New format
          context = metadata.context as ExecutionContext;
        } else if ('sessionId' in metadata) {
          // Old format - metadata is the context directly
          context = metadata as unknown as ExecutionContext;
        }
      }
      
      return {
        sessionId: session.id,
        status: session.status,
        context: context || {
          sessionId: session.id,
          workflowId: session.workflowId,
          currentNodeId: null,
          variables: {},
          transcript: [],
          status: 'idle',
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
      };
    }),
});

