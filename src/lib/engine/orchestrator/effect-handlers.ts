import type { AdvanceResult, ExecutionContext, LLMConfig } from '../types';

// ============================================
// Effect Handlers — Dependency Injection Seam
// ============================================
// These handler interfaces define the bridge between
// the orchestrator's pure FSM effects and the real-world
// side-effects (TTS, ASR, engine calls, etc.).
//
// In production: handlers call real SDK APIs.
// In tests: handlers are mock vi.fn() functions.
// ============================================

/**
 * EffectHandlers — injected implementations for each FSM effect.
 *
 * The orchestrator calls these handlers when the turnReducer
 * emits corresponding Effect commands. Each handler is async
 * to support real I/O operations.
 */
export interface EffectHandlers {
  /** Start speech recognition (ASR). Called when FSM emits START_ASR. */
  onStartASR: () => Promise<void>;

  /** Stop speech recognition (ASR). Called when FSM emits STOP_ASR. */
  onStopASR: () => Promise<void>;

  /** Stop TTS playback (barge-in). Called when FSM emits STOP_TTS. */
  onStopTTS: () => Promise<void>;

  /**
   * Emit synthesized speech text to the client.
   * Called when FSM emits EMIT_SPEAKING_TEXT.
   * @param text - The text to be spoken
   * @param nodeId - Optional workflow node ID for tracing
   * @param signal - AbortSignal for cancellation (barge-in)
   */
  onEmitSpeakingText: (text: string, nodeId?: string, signal?: AbortSignal) => Promise<void>;

  /**
   * Emit raw audio data to the client.
   * Called when FSM emits EMIT_AUDIO.
   * @param text - The text that generated the audio
   * @param nodeId - Optional workflow node ID for tracing
   */
  onEmitAudio: (text: string, nodeId?: string) => Promise<void>;

  /**
   * Log an event (error, warning, info).
   * Called when FSM emits LOG_EVENT.
   * @param message - Log message
   * @param level - Log severity
   */
  onLogEvent: (message: string, level?: 'info' | 'warn' | 'error') => Promise<void>;
}

// ============================================
// Orchestrator Configuration
// ============================================

/**
 * PrismaLike — minimal Prisma client interface for DI.
 * Only the methods actually used by the orchestrator are required.
 */
export interface PrismaLike {
  workflow: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      userId: string;
      nodes: unknown;
      edges: unknown;
    } | null>;
  };
  workflowSession: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      metadata: unknown;
      status: string;
    } | null>;
    update: (args: {
      where: { id: string };
      data: {
        metadata: object;
        status: any;
        endedAt?: Date;
      };
    }) => Promise<unknown>;
  };
}

/**
 * OrchestratorConfig — configuration for creating an EngineOrchestrator.
 */
export interface OrchestratorConfig {
  /** Active voice session ID */
  sessionId: string;

  /** Workflow being executed */
  workflowId: string;

  /** Injected effect handlers for TTS/ASR/engine operations */
  handlers: EffectHandlers;

  /** Prisma client for session persistence (injected for testability) */
  prisma: PrismaLike;

  /** Optional LLM configuration passed to the engine */
  llmConfig?: Partial<LLMConfig>;
}

// ============================================
// No-op Handler Factory (for testing)
// ============================================

/**
 * Creates a set of EffectHandlers that do nothing.
 * Useful as a base for testing — override individual
 * handlers with vi.fn() as needed.
 */
export function createNoopHandlers(): EffectHandlers {
  return {
    onStartASR: async () => {},
    onStopASR: async () => {},
    onStopTTS: async () => {},
    onEmitSpeakingText: async () => {},
    onEmitAudio: async () => {},
    onLogEvent: async () => {},
  };
}
