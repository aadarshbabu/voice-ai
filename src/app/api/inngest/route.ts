import { serve } from "inngest/next";
import { inngest } from "@/server/inngest/client";
import { appRouter } from "@/server/routers/_app";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
