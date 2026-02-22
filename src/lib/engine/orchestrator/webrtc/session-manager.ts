// ============================================
// WebRTC Session Manager
// ============================================
// Manages the lifecycle of WebRTC voice sessions.
// Each session consists of:
//   - ServerPeer (WebRTC connection)
//   - WebRTCBridge (audio ↔ orchestrator adapter)
//   - EngineOrchestrator (FSM + engine wrapper)
//
// Provides create, cleanup, and idle-timeout logic.
// ============================================

import { createServerPeer, type ServerPeer } from './server-peer';
import { createWebRTCBridge, type WebRTCBridge } from './bridge-voice';
import { EngineOrchestrator } from '../engine-orchestrator';
import { createNoopHandlers, type PrismaLike } from '../effect-handlers';
import type { VoiceEvent } from '../events';

// ------------------------------------------
// Types
// ------------------------------------------

export interface WebRTCSessionEntry {
  sessionId: string;
  workflowId: string;
  serverPeer: ServerPeer;
  bridge: WebRTCBridge;
  orchestrator: EngineOrchestrator;
  createdAt: number;
  lastActivity: number;
}

export interface SessionManagerConfig {
  /** Prisma client for session persistence */
  prisma: PrismaLike;
  /** Maximum concurrent sessions (default: 10) */
  maxSessions?: number;
  /** Idle timeout in ms (default: 300000 = 5 minutes) */
  idleTimeoutMs?: number;
  /** Cleanup interval in ms (default: 30000 = 30 seconds) */
  cleanupIntervalMs?: number;
  /** STT function for the bridge */
  transcribePcm?: (pcmBase64: string, mimeType: string, userId: string) => Promise<string | null>;
  /** TTS function for the bridge */
  synthesizeSpeech?: (text: string, userId: string) => Promise<Buffer | null>;
}

// ------------------------------------------
// Session Manager
// ------------------------------------------

export class WebRTCSessionManager {
  private readonly sessions = new Map<string, WebRTCSessionEntry>();
  private readonly prisma: PrismaLike;
  private readonly maxSessions: number;
  private readonly idleTimeoutMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly transcribePcm?: (pcmBase64: string, mimeType: string, userId: string) => Promise<string | null>;
  private readonly synthesizeSpeech?: (text: string, userId: string) => Promise<Buffer | null>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: SessionManagerConfig) {
    this.prisma = config.prisma;
    this.maxSessions = config.maxSessions ?? 10;
    this.idleTimeoutMs = config.idleTimeoutMs ?? 300_000;
    this.cleanupIntervalMs = config.cleanupIntervalMs ?? 30_000;
    this.transcribePcm = config.transcribePcm;
    this.synthesizeSpeech = config.synthesizeSpeech;

    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanupIdleSessions(), this.cleanupIntervalMs);
  }

  // ---- Public API ----

  /**
   * Create a new WebRTC session with all components wired together.
   * Returns the server's SDP answer.
   */
  async createSession(
    sessionId: string,
    workflowId: string,
    offerSdp: string,
  ): Promise<{ answerSdp: string }> {
    // Check capacity
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Max sessions reached (${this.maxSessions}). Try again later.`);
    }

    // Check for duplicate session
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    // 0. Fetch workflow to get userId
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    const userId = workflow.userId;

    // 4. Create WebRTC Bridge (definition moved up to use in handlers)
    let bridge: WebRTCBridge;

    // 1. Create EngineOrchestrator with real handlers
    const orchestrator = new EngineOrchestrator({
      sessionId,
      workflowId,
      handlers: {
        onStartASR: async () => {
          // ASR is managed by the bridge's VAD
        },
        onStopASR: async () => {
          // ASR is managed by the bridge's VAD
        },
        onStopTTS: async () => {
          bridge.stopSpeaking();
        },
        onEmitSpeakingText: async (text) => {
          await bridge.handleSpeakText(text);
        },
        onEmitAudio: async () => {
          // WebRTC uses direct frame streaming, not base64 blobs
        },
        onLogEvent: async (msg, level) => {
          console.log(`[Orchestrator:${sessionId}] ${level}: ${msg}`);
        },
      },
      prisma: this.prisma,
    });

    // 2. Create Server Peer (definition moved up to use in bridge)
    const serverPeer = createServerPeer({
      sessionId,
      onAudioFrame: (frame, timestamp) => {
        bridge.handleAudioFrame(frame, timestamp);
        // Update activity timestamp
        const entry = this.sessions.get(sessionId);
        if (entry) entry.lastActivity = Date.now();
      },
      onDisconnected: () => {
        void this.destroySession(sessionId, 'user_hangup');
      },
    });

    // 3. Create WebRTC Bridge
    bridge = createWebRTCBridge({
      sessionId,
      dispatchEvent: (event: VoiceEvent) => orchestrator.dispatch(event),
      transcribePcm: (pcm, mime) => this.transcribePcm?.(pcm, mime, userId) ?? Promise.resolve(null),
      synthesizeSpeech: (text) => this.synthesizeSpeech?.(text, userId) ?? Promise.resolve(null),
      sendAudioFrame: (frame) => serverPeer.sendAudioFrame(frame),
    });

    // 5. Handle SDP offer → answer
    const answerSdp = await serverPeer.handleOffer(offerSdp);

    // 6. Store the session
    const entry: WebRTCSessionEntry = {
      sessionId,
      workflowId,
      serverPeer,
      bridge,
      orchestrator,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.sessions.set(sessionId, entry);

    // 7. Start the session in the orchestrator
    await orchestrator.dispatch({
      type: 'SESSION_START',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { workflowId },
    });

    return { answerSdp };
  }

  /**
   * Add an ICE candidate for an existing session.
   */
  async addIceCandidate(
    sessionId: string,
    candidate: {
      candidate: string;
      sdpMid?: string | null;
      sdpMLineIndex?: number | null;
    },
  ): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await entry.serverPeer.addIceCandidate(candidate);
    entry.lastActivity = Date.now();
  }

  /**
   * Destroy a session and clean up all resources.
   * The entry is removed from the map SYNCHRONOUSLY so that
   * getActiveSessionCount() reflects the removal immediately.
   */
  async destroySession(sessionId: string, reason = 'user_hangup'): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    // Remove from map FIRST (synchronous) so counts update immediately
    this.sessions.delete(sessionId);

    // Dispatch SESSION_END to the orchestrator (async, best-effort)
    try {
      await entry.orchestrator.dispatch({
        type: 'SESSION_END',
        sessionId,
        timestamp: new Date().toISOString(),
        payload: { reason: reason as 'completed' | 'user_hangup' | 'timeout' | 'error' },
      });
    } catch {
      // Best-effort
    }

    // Tear down components
    entry.bridge.destroy();
    entry.serverPeer.destroy();
    entry.orchestrator.destroy();
  }

  /**
   * Get a session entry (if it exists).
   */
  getSession(sessionId: string): WebRTCSessionEntry | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get the number of active sessions.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up sessions that have been idle for too long.
   */
  cleanupIdleSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.lastActivity > this.idleTimeoutMs) {
        void this.destroySession(sessionId, 'timeout');
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Destroy all sessions and stop cleanup timer.
   */
  destroyAll(): void {
    for (const sessionId of this.sessions.keys()) {
      void this.destroySession(sessionId, 'error');
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
