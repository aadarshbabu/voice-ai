// ============================================
// Turn-Taking FSM Types
// ============================================
// These types define the state machine that manages
// real-time voice UX states. The FSM is a pure reducer —
// it never performs I/O, never calls async functions,
// and never mutates its input.
// ============================================

// --- FSM States ---

export const TURN_STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
} as const;

export type TurnState = typeof TURN_STATES[keyof typeof TURN_STATES];

// --- Turn Context (FSM State Container) ---

export interface TurnContext {
  /** Current FSM state */
  state: TurnState;
  /** Active voice session ID */
  sessionId: string | null;
  /** Current workflow node being executed */
  currentNodeId: string | null;
  /** Whether TTS audio is actively being played */
  ttsBufferActive: boolean;
  /** Whether ASR (speech recognition) is actively listening */
  asrActive: boolean;
  /** Last finalized transcript from the user */
  lastTranscript: string | null;
  /** Text currently being spoken by the agent */
  speakingText: string | null;
}

// --- Effect Types (Commands emitted by the FSM) ---

export const EFFECT_TYPES = {
  STOP_TTS: 'STOP_TTS',
  START_ASR: 'START_ASR',
  STOP_ASR: 'STOP_ASR',
  CALL_ENGINE: 'CALL_ENGINE',
  EMIT_AUDIO: 'EMIT_AUDIO',
  LOG_EVENT: 'LOG_EVENT',
  EMIT_SPEAKING_TEXT: 'EMIT_SPEAKING_TEXT',
} as const;

export type EffectType = typeof EFFECT_TYPES[keyof typeof EFFECT_TYPES];

export type Effect =
  | { type: 'STOP_TTS' }
  | { type: 'START_ASR' }
  | { type: 'STOP_ASR' }
  | { type: 'CALL_ENGINE'; payload: { transcript: string } }
  | { type: 'EMIT_AUDIO'; payload: { text: string; nodeId?: string } }
  | { type: 'LOG_EVENT'; payload: { message: string; level?: 'info' | 'warn' | 'error' } }
  | { type: 'EMIT_SPEAKING_TEXT'; payload: { text: string; nodeId?: string } };

// --- Turn Result (what the reducer returns) ---

export interface TurnResult {
  context: TurnContext;
  effects: Effect[];
}

// --- Factory: create a fresh initial context ---

export function createInitialTurnContext(): TurnContext {
  return {
    state: TURN_STATES.IDLE,
    sessionId: null,
    currentNodeId: null,
    ttsBufferActive: false,
    asrActive: false,
    lastTranscript: null,
    speakingText: null,
  };
}
