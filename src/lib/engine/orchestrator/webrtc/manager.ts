import { WebRTCSessionManager } from './session-manager';
import { prisma } from '@/lib/prisma';
import { speechToText, textToSpeech } from '@/lib/engine/providers/voice';

/**
 * Singleton instance of the WebRTC Session Manager.
 * In development, we attach it to the global object to prevent 
 * re-initialization on HMR (Hot Module Replacement).
 */

const globalForWebRTC = global as unknown as {
  webrtcManager: WebRTCSessionManager | undefined;
};

export const webrtcManager =
  globalForWebRTC.webrtcManager ??
  new WebRTCSessionManager({
    prisma,
    maxSessions: 20,
    idleTimeoutMs: 300_000, // 5 minutes
    cleanupIntervalMs: 30_000,
    // Inject STT/TTS providers
    transcribePcm: async (pcmBase64, mimeType, userId) => {
      const result = await speechToText(pcmBase64, mimeType, userId);
      return result.success ? (result.transcript || null) : null;
    },
    synthesizeSpeech: async (text, userId) => {
      const result = await textToSpeech(text, userId);
      if (result.success && result.audioBase64) {
        return Buffer.from(result.audioBase64, 'base64');
      }
      return null;
    }
  });

if (process.env.NODE_ENV !== 'production') {
  globalForWebRTC.webrtcManager = webrtcManager;
}
