import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { VoiceProviderService } from "@/server/services/voice-provider-service";
import { ProviderType } from "@/generated/prisma";

export const voiceProviderRouter = createTRPCRouter({
  save: protectedProcedure
    .input(
      z.object({
        providerType: z.nativeEnum(ProviderType),
        config: z.object({
          apiKey: z.string().min(1),
          baseUrl: z.string().optional(),
          model: z.string().optional(),
          region: z.string().optional(),
          voiceId: z.string().optional(),
        }).passthrough(),
        isDefault: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await VoiceProviderService.saveConfig(
        ctx.user.id,
        input.providerType,
        input.config,
        input.isDefault
      );
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await VoiceProviderService.listProviders(ctx.user.id);
  }),

  delete: protectedProcedure
    .input(
      z.object({
        providerType: z.nativeEnum(ProviderType),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await VoiceProviderService.deleteConfig(ctx.user.id, input.providerType);
    }),
});
