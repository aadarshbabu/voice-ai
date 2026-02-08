import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
} from "../../trpc/init";
import { CreateWorkflowSchema, UpdateWorkflowSchema } from "@/types/workflow";
import { TRPCError } from "@trpc/server";

export const workflowRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    prisma.workflow.findMany({
      where: {
        userId: ctx.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
  ),
  create: protectedProcedure
    .input(CreateWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      return prisma.workflow.create({
        data: {
          name: input.name,
          description: input.description,
          userId: ctx.user.id,
          orgId: input.orgId,
          nodes: [],
          edges: [],
        },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.id },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      return workflow;
    }),

  update: protectedProcedure
    .input(UpdateWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.id },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      return prisma.workflow.update({
        where: { id: input.id },
        data: {
          nodes: input.nodes,
          edges: input.edges,
        },
      });
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.id },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      if (workflow.status === "PUBLISHED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workflow is already published",
        });
      }

      // Safe check for nodes array
      const nodes = workflow.nodes;
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Workflow must have at least one node to be published",
        });
      }

      // Save snapshot of the version BEFORE incrementing
      await prisma.workflowSnapshot.create({
        data: {
          workflowId: input.id,
          version: workflow.version,
          nodes: workflow.nodes || [],
          edges: workflow.edges || [],
        },
      });

      return prisma.workflow.update({
        where: { id: input.id },
        data: {
          status: "PUBLISHED",
          version: { increment: 1 },
        },
      });
    }),

  listSnapshots: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      return prisma.workflowSnapshot.findMany({
        where: { workflowId: input.id },
        orderBy: { version: "desc" },
      });
    }),

  restoreVersion: protectedProcedure
    .input(z.object({ workflowId: z.string(), version: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.workflow.findUnique({
        where: { id: input.workflowId },
      });

      if (!workflow || workflow.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found or unauthorized",
        });
      }

      const snapshot = await prisma.workflowSnapshot.findUnique({
        where: {
          workflowId_version: {
            workflowId: input.workflowId,
            version: input.version,
          },
        },
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found",
        });
      }

      // When restoring, we overwrite the current draft nodes/edges
      return prisma.workflow.update({
        where: { id: input.workflowId },
        data: {
          nodes: snapshot.nodes as any,
          edges: snapshot.edges as any,
          status: "DRAFT", // Back to draft so they can edit the restored version
        },
      });
    }),
});
