import { createTRPCRouter } from "../../trpc/init";
import { workflowRouter } from "./workflow";
import { workspaceSessionRouter } from "./workspace-session";

import { credentialsRouter } from "./credentials";
import { voiceProviderRouter } from "./voice-providers";

export const appRouter = createTRPCRouter({
  workflow: workflowRouter,
  workspaceSession: workspaceSessionRouter,
  credentials: credentialsRouter,
  voiceProvider: voiceProviderRouter,
});
export type AppRouter = typeof appRouter;
