import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { prisma } from "@/lib/prisma";

export const workflowRouter = router({
  list: publicProcedure.query(() => prisma.workflow.findMany()),
  create: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) =>
      prisma.workflow.create({
        data: { name: input.name, nodes: [], edges: [] },
      })
    ),
});
