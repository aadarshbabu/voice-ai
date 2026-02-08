import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { prisma } from "@/lib/prisma";

export const credentialsRouter = createTRPCRouter({
  save: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        model: z.string().optional(),
        apiKey: z.string().min(1),
        baseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use ctx.user.id from the protected procedure context
      const userId = ctx.user.id;
      
      // Upsert the credential
      return await prisma.lLMCredential.upsert({
        where: {
          userId_provider: {
            userId: userId,
            provider: input.provider,
          },
        },
        create: {
          userId: userId,
          provider: input.provider,
          model: input.model,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
        },
        update: {
          model: input.model,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
        },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const creds = await prisma.lLMCredential.findMany({
      where: { userId },
      select: {
        provider: true,
        model: true,
        baseUrl: true,
        updatedAt: true,
      },
    });

    // Return status objects (never the key)
    return creds.map((c) => ({
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
      isConfigured: true,
      updatedAt: c.updatedAt,
    }));
  }),

  delete: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      return await prisma.lLMCredential.delete({
        where: {
          userId_provider: {
            userId: userId,
            provider: input.provider,
          },
        },
      });
    }),
});
