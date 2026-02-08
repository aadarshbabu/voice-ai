import { prisma } from "@/lib/prisma";
import { encryptJSON, decryptJSON } from "@/lib/crypto";
import { ProviderType } from "@/generated/prisma";

export interface ProviderConfigData {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  region?: string; // For Google/Azure
  voiceId?: string; // For ElevenLabs
  [key: string]: any;
}

export class VoiceProviderService {
  /**
   * Saves or updates a provider configuration with encryption.
   */
  static async saveConfig(
    userId: string,
    providerType: ProviderType,
    config: ProviderConfigData,
    isDefault: boolean = false
  ) {
    const encryptedConfig = encryptJSON(config);

    return await prisma.providerConfig.upsert({
      where: {
        userId_providerType: {
          userId,
          providerType,
        },
      },
      create: {
        userId,
        providerType,
        encryptedConfig,
        isDefault,
      },
      update: {
        encryptedConfig,
        isDefault,
      },
    });
  }

  /**
   * Retrieves and decrypts a provider configuration.
   */
  static async getConfig(userId: string, providerType: ProviderType): Promise<ProviderConfigData | null> {
    const record = await prisma.providerConfig.findUnique({
      where: {
        userId_providerType: {
          userId,
          providerType,
        },
      },
    });

    if (!record) return null;

    return decryptJSON<ProviderConfigData>(record.encryptedConfig);
  }

  /**
   * Lists available providers for a user (without sensitive data).
   */
  static async listProviders(userId: string) {
    const records = await prisma.providerConfig.findMany({
      where: { userId },
      select: {
        providerType: true,
        isDefault: true,
        updatedAt: true,
      },
    });

    return records.map(r => ({
      providerType: r.providerType,
      isDefault: r.isDefault,
      updatedAt: r.updatedAt,
      isConfigured: true
    }));
  }

  /**
   * Deletes a provider configuration.
   */
  static async deleteConfig(userId: string, providerType: ProviderType) {
    return await prisma.providerConfig.delete({
      where: {
        userId_providerType: {
          userId,
          providerType,
        },
      },
    });
  }
}
