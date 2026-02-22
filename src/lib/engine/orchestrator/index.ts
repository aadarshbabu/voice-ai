// ============================================
// Orchestrator — Public API
// ============================================
// Barrel file for the real-time voice orchestrator.
// This module provides the "Nervous System" that
// manages turn-taking without modifying the existing
// workflow engine ("Brain").
// ============================================

// Event types and schemas
export {
  VoiceEventSchema,
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
  VOICE_EVENT_TYPES,
} from './events';

export type {
  VoiceEvent,
  VoiceEventType,
  UserSpeechStartEvent,
  UserSpeechEndEvent,
  UserSpeechFinalEvent,
  AgentTtsStartEvent,
  AgentTtsEndEvent,
  AgentThinkingStartEvent,
  AgentThinkingEndEvent,
  EngineResultEvent,
  SessionStartEvent,
  SessionEndEvent,
  SilenceTimeoutEvent,
  ErrorEvent,
} from './events';

// State types and factories
export {
  TURN_STATES,
  EFFECT_TYPES,
  createInitialTurnContext,
} from './types';

export type {
  TurnState,
  TurnContext,
  Effect,
  EffectType,
  TurnResult,
} from './types';

// Core reducer
export { turnReducer } from './turn-machine';

// Effect handlers (DI interface for testability)
export { createNoopHandlers } from './effect-handlers';

export type {
  EffectHandlers,
  OrchestratorConfig,
  PrismaLike,
} from './effect-handlers';

// Engine Orchestrator (the Bridge)
export { EngineOrchestrator } from './engine-orchestrator';
