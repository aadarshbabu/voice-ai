import type { AppRouter } from "@/server/api/routers/_app";
import { createTRPCContext } from "@trpc/tanstack-react-query";
export const { useTRPC, TRPCProvider } = createTRPCContext<AppRouter>();
