import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
} from "../../trpc/init";
import { CreateWorkflowSchema } from "@/types/workflow";
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

      return prisma.workflow.update({
        where: { id: input.id },
        data: {
          status: "PUBLISHED",
          version: { increment: 1 },
        },
      });
    }),
});
