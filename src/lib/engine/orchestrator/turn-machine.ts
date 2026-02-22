import type { VoiceEvent } from './events';
import {
  type TurnContext,
  type TurnResult,
  type Effect,
  TURN_STATES,
} from './types';

// ============================================
// Turn-Taking FSM — Pure Reducer
// ============================================
// This function is the core of the "Nervous System".
// It takes the current context and a voice event, and
// returns a new context + an array of effects (commands).
//
// INVARIANTS:
// - Zero I/O, zero async, zero timers
// - Does NOT mutate the input context
// - Same input → same output (deterministic)
// - Effects are commands, not actions — they describe
//   what SHOULD happen, not what DID happen
// ============================================

export function turnReducer(
  context: TurnContext,
  event: VoiceEvent,
): TurnResult {
  switch (context.state) {
    case TURN_STATES.IDLE:
      return handleIdle(context, event);

    case TURN_STATES.LISTENING:
      return handleListening(context, event);

    case TURN_STATES.THINKING:
      return handleThinking(context, event);

    case TURN_STATES.SPEAKING:
      return handleSpeaking(context, event);

    case TURN_STATES.INTERRUPTED:
      return handleInterrupted(context, event);

    default:
      // Unknown state — no-op
      return { context, effects: [] };
  }
}

// ============================================
// State Handlers
// ============================================

function handleIdle(
  context: TurnContext,
  event: VoiceEvent,
): TurnResult {
  switch (event.type) {
    case 'SESSION_START':
      return {
        context: {
          ...context,
          state: TURN_STATES.LISTENING,
          sessionId: event.sessionId,
          asrActive: true,
        },
        effects: [{ type: 'START_ASR' }],
      };

    case 'ERROR':
      return {
        context,
        effects: [
          { type: 'LOG_EVENT', payload: { message: event.payload.message, level: 'error' } },
        ],
      };

    // All other events are no-ops when IDLE
    default:
      return { context, effects: [] };
  }
}

function handleListening(
  context: TurnContext,
  event: VoiceEvent,
): TurnResult {
  switch (event.type) {
    case 'USER_SPEECH_FINAL':
      return {
        context: {
          ...context,
          state: TURN_STATES.THINKING,
          asrActive: false,
          lastTranscript: event.payload.transcript,
        },
        effects: [
          { type: 'STOP_ASR' },
          { type: 'CALL_ENGINE', payload: { transcript: event.payload.transcript } },
        ],
      };

    case 'SILENCE_TIMEOUT':
      return {
        context: {
          ...context,
          state: TURN_STATES.THINKING,
          asrActive: false,
        },
        effects: [
          { type: 'STOP_ASR' },
          { type: 'CALL_ENGINE', payload: { transcript: context.lastTranscript ?? '' } },
        ],
      };

    case 'SESSION_END':
      return transitionToIdle(context);

    case 'ERROR':
      return transitionToIdleWithError(context, event.payload.message);

    // USER_SPEECH_START while already LISTENING — idempotent no-op
    // AGENT_TTS_END while LISTENING — no TTS active, no-op
    default:
      return { context, effects: [] };
  }
}

function handleThinking(
  context: TurnContext,
  event: VoiceEvent,
): TurnResult {
  switch (event.type) {
    case 'ENGINE_RESULT':
      return {
        context: {
          ...context,
          state: TURN_STATES.SPEAKING,
          ttsBufferActive: true,
          speakingText: event.payload.text ?? null,
          currentNodeId: event.payload.nodeId ?? context.currentNodeId,
        },
        effects: [
          {
            type: 'EMIT_SPEAKING_TEXT',
            payload: {
              text: event.payload.text ?? '',
              nodeId: event.payload.nodeId,
            },
          },
        ],
      };

    case 'SESSION_END':
      return transitionToIdle(context);

    case 'ERROR':
      return transitionToIdleWithError(context, event.payload.message);

    // USER_SPEECH_START while THINKING — ignore, wait for engine
    default:
      return { context, effects: [] };
  }
}

function handleSpeaking(
  context: TurnContext,
  event: VoiceEvent,
): TurnResult {
  switch (event.type) {
    // Normal turn completion: agent finishes speaking → listen again
    case 'AGENT_TTS_END':
      return {
        context: {
          ...context,
          state: TURN_STATES.LISTENING,
          ttsBufferActive: false,
          asrActive: true,
          speakingText: null,
        },
        effects: [{ type: 'START_ASR' }],
      };

    // Barge-in: user starts speaking while agent is still speaking
    case 'USER_SPEECH_START':
      return {
        context: {
          ...context,
          state: TURN_STATES.INTERRUPTED,
          ttsBufferActive: false,
          speakingText: null,
        },
        effects: [{ type: 'STOP_TTS' }],
      };

    case 'SESSION_END':
      return transitionToIdle(context);

    case 'ERROR':
      return transitionToIdleWithError(context, event.payload.message);

    default:
      return { context, effects: [] };
  }
}

function handleInterrupted(
  context: TurnContext,
  event: VoiceEvent,
): TurnResult {
  // INTERRUPTED is a transient state — immediately transition to LISTENING.
  // The reducer is called once with the interrupt event (handled in SPEAKING),
  // and then again to resolve INTERRUPTED → LISTENING.
  // In practice the Orchestrator will call turnReducer again after processing
  // STOP_TTS. But for direct transitions we also handle events here:

  switch (event.type) {
    case 'USER_SPEECH_FINAL':
      // User finished speaking after barge-in — go straight to thinking
      return {
        context: {
          ...context,
          state: TURN_STATES.THINKING,
          asrActive: false,
          lastTranscript: event.payload.transcript,
        },
        effects: [
          { type: 'STOP_ASR' },
          { type: 'CALL_ENGINE', payload: { transcript: event.payload.transcript } },
        ],
      };

    case 'USER_SPEECH_START':
      // Still speaking after interrupt — transition to listening state
      return {
        context: {
          ...context,
          state: TURN_STATES.LISTENING,
          asrActive: true,
        },
        effects: [{ type: 'START_ASR' }],
      };

    case 'SESSION_END':
      return transitionToIdle(context);

    case 'ERROR':
      return transitionToIdleWithError(context, event.payload.message);

    default:
      // By default, INTERRUPTED resolves to LISTENING
      // This handles events like AGENT_TTS_END (which may arrive late after stop)
      return {
        context: {
          ...context,
          state: TURN_STATES.LISTENING,
          asrActive: true,
        },
        effects: [{ type: 'START_ASR' }],
      };
  }
}

// ============================================
// Shared Transition Helpers
// ============================================

function transitionToIdle(context: TurnContext): TurnResult {
  const effects: Effect[] = [];

  if (context.ttsBufferActive) {
    effects.push({ type: 'STOP_TTS' });
  }
  if (context.asrActive) {
    effects.push({ type: 'STOP_ASR' });
  }

  return {
    context: {
      ...context,
      state: TURN_STATES.IDLE,
      sessionId: null,
      ttsBufferActive: false,
      asrActive: false,
      speakingText: null,
      lastTranscript: null,
      currentNodeId: null,
    },
    effects,
  };
}

function transitionToIdleWithError(
  context: TurnContext,
  message: string,
): TurnResult {
  const effects: Effect[] = [];

  if (context.ttsBufferActive) {
    effects.push({ type: 'STOP_TTS' });
  }
  if (context.asrActive) {
    effects.push({ type: 'STOP_ASR' });
  }

  effects.push({
    type: 'LOG_EVENT',
    payload: { message, level: 'error' },
  });

  return {
    context: {
      ...context,
      state: TURN_STATES.IDLE,
      sessionId: null,
      ttsBufferActive: false,
      asrActive: false,
      speakingText: null,
      lastTranscript: null,
      currentNodeId: null,
    },
    effects,
  };
}
