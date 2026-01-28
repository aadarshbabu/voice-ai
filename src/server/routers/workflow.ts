import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
} from "../trpc/init";

export const workflowRouter = createTRPCRouter({
  list: baseProcedure.query(() => prisma.workflow.findMany()),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return prisma.workflow.create({
        data: {
          name: input.name,
          description: input.description,
          userId: ctx.user.id,
          nodes: [],
          edges: [],
        },
      });
    }),

  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
});
