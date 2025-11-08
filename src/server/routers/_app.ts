import { router } from "../trpc";
import { workflowRouter } from "./workflow";

export const appRouter = router({
  workflow: workflowRouter,
});
export type AppRouter = typeof appRouter;
