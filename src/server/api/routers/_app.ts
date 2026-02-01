import { createTRPCRouter } from "../../trpc/init";
import { workflowRouter } from "./workflow";

export const appRouter = createTRPCRouter({
  workflow: workflowRouter,
});
export type AppRouter = typeof appRouter;
