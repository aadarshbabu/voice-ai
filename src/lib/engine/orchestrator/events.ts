import { z } from 'zod';

// ============================================
// Voice Event Schemas — Real-Time Signals
// ============================================
// These events represent all the real-time signals
// that the Turn-Taking FSM can receive. They are
// the "nervous system" inputs that drive state changes.
// ============================================

const BaseEventSchema = z.object({
  sessionId: z.string(),
  timestamp: z.string(), // ISO 8601
});

// --- User Speech Events ---

export const UserSpeechStartSchema = BaseEventSchema.extend({
  type: z.literal('USER_SPEECH_START'),
});

export const UserSpeechEndSchema = BaseEventSchema.extend({
  type: z.literal('USER_SPEECH_END'),
});

export const UserSpeechFinalSchema = BaseEventSchema.extend({
  type: z.literal('USER_SPEECH_FINAL'),
  payload: z.object({
    transcript: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// --- Agent / TTS Events ---

export const AgentTtsStartSchema = BaseEventSchema.extend({
  type: z.literal('AGENT_TTS_START'),
  payload: z.object({
    text: z.string(),
    nodeId: z.string().optional(),
  }),
});

export const AgentTtsEndSchema = BaseEventSchema.extend({
  type: z.literal('AGENT_TTS_END'),
});

// --- Agent / Thinking Events ---

export const AgentThinkingStartSchema = BaseEventSchema.extend({
  type: z.literal('AGENT_THINKING_START'),
});

export const AgentThinkingEndSchema = BaseEventSchema.extend({
  type: z.literal('AGENT_THINKING_END'),
});

// --- Engine Events ---

export const EngineResultSchema = BaseEventSchema.extend({
  type: z.literal('ENGINE_RESULT'),
  payload: z.object({
    text: z.string().optional(),
    nodeId: z.string().optional(),
    actionType: z.string().optional(), // 'speak', 'wait_for_input', 'completed', etc.
    completed: z.boolean().optional(),
  }),
});

// --- Session Lifecycle Events ---

export const SessionStartSchema = BaseEventSchema.extend({
  type: z.literal('SESSION_START'),
  payload: z.object({
    workflowId: z.string(),
  }).optional(),
});

export const SessionEndSchema = BaseEventSchema.extend({
  type: z.literal('SESSION_END'),
  payload: z.object({
    reason: z.enum(['completed', 'user_hangup', 'timeout', 'error']).optional(),
  }).optional(),
});

// --- Timeout Events ---

export const SilenceTimeoutSchema = BaseEventSchema.extend({
  type: z.literal('SILENCE_TIMEOUT'),
});

// --- Error Events ---

export const ErrorEventSchema = BaseEventSchema.extend({
  type: z.literal('ERROR'),
  payload: z.object({
    message: z.string(),
    code: z.string().optional(),
    fatal: z.boolean().optional(),
  }),
});

// ============================================
// Discriminated Union — VoiceEvent
// ============================================

export const VoiceEventSchema = z.discriminatedUnion('type', [
  UserSpeechStartSchema,
  UserSpeechEndSchema,
  UserSpeechFinalSchema,
  AgentTtsStartSchema,
  AgentTtsEndSchema,
  AgentThinkingStartSchema,
  AgentThinkingEndSchema,
  EngineResultSchema,
  SessionStartSchema,
  SessionEndSchema,
  SilenceTimeoutSchema,
  ErrorEventSchema,
]);

export type VoiceEvent = z.infer<typeof VoiceEventSchema>;

// Individual event types for convenience
export type UserSpeechStartEvent = z.infer<typeof UserSpeechStartSchema>;
export type UserSpeechEndEvent = z.infer<typeof UserSpeechEndSchema>;
export type UserSpeechFinalEvent = z.infer<typeof UserSpeechFinalSchema>;
export type AgentTtsStartEvent = z.infer<typeof AgentTtsStartSchema>;
export type AgentTtsEndEvent = z.infer<typeof AgentTtsEndSchema>;
export type AgentThinkingStartEvent = z.infer<typeof AgentThinkingStartSchema>;
export type AgentThinkingEndEvent = z.infer<typeof AgentThinkingEndSchema>;
export type EngineResultEvent = z.infer<typeof EngineResultSchema>;
export type SessionStartEvent = z.infer<typeof SessionStartSchema>;
export type SessionEndEvent = z.infer<typeof SessionEndSchema>;
export type SilenceTimeoutEvent = z.infer<typeof SilenceTimeoutSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

// All possible event type strings
export const VOICE_EVENT_TYPES = [
  'USER_SPEECH_START',
  'USER_SPEECH_END',
  'USER_SPEECH_FINAL',
  'AGENT_TTS_START',
  'AGENT_TTS_END',
  'AGENT_THINKING_START',
  'AGENT_THINKING_END',
  'ENGINE_RESULT',
  'SESSION_START',
  'SESSION_END',
  'SILENCE_TIMEOUT',
  'ERROR',
] as const;

export type VoiceEventType = typeof VOICE_EVENT_TYPES[number];
