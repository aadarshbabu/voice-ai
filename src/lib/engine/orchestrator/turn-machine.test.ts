import { describe, it, expect } from 'vitest';
import { turnReducer } from './turn-machine';
import { createInitialTurnContext, TURN_STATES } from './types';
import type { TurnContext } from './types';
import type { VoiceEvent } from './events';

// ============================================
// Helpers
// ============================================

function makeEvent(overrides: Partial<VoiceEvent> & { type: VoiceEvent['type'] }): VoiceEvent {
  return {
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
    ...overrides,
  } as VoiceEvent;
}

function listeningContext(overrides?: Partial<TurnContext>): TurnContext {
  return {
    ...createInitialTurnContext(),
    state: TURN_STATES.LISTENING,
    sessionId: 'test-session',
    asrActive: true,
    ...overrides,
  };
}

function thinkingContext(overrides?: Partial<TurnContext>): TurnContext {
  return {
    ...createInitialTurnContext(),
    state: TURN_STATES.THINKING,
    sessionId: 'test-session',
    lastTranscript: 'hello',
    ...overrides,
  };
}

function speakingContext(overrides?: Partial<TurnContext>): TurnContext {
  return {
    ...createInitialTurnContext(),
    state: TURN_STATES.SPEAKING,
    sessionId: 'test-session',
    ttsBufferActive: true,
    speakingText: 'How can I help you?',
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('turnReducer', () => {
  // ------------------------------------------
  // Test 1: IDLE → SESSION_START → LISTENING
  // ------------------------------------------
  it('should transition from IDLE to LISTENING on SESSION_START', () => {
    const ctx = createInitialTurnContext();
    const event = makeEvent({
      type: 'SESSION_START',
      payload: { workflowId: 'wf-1' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.LISTENING);
    expect(result.context.sessionId).toBe('test-session');
    expect(result.context.asrActive).toBe(true);
    expect(result.effects).toEqual([{ type: 'START_ASR' }]);
  });

  // ------------------------------------------
  // Test 2: LISTENING → USER_SPEECH_FINAL → THINKING
  // ------------------------------------------
  it('should transition from LISTENING to THINKING on USER_SPEECH_FINAL', () => {
    const ctx = listeningContext();
    const event = makeEvent({
      type: 'USER_SPEECH_FINAL',
      payload: { transcript: 'book a flight', confidence: 0.95 },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.THINKING);
    expect(result.context.asrActive).toBe(false);
    expect(result.context.lastTranscript).toBe('book a flight');
    expect(result.effects).toEqual([
      { type: 'STOP_ASR' },
      { type: 'CALL_ENGINE', payload: { transcript: 'book a flight' } },
    ]);
  });

  // ------------------------------------------
  // Test 3: THINKING → ENGINE_RESULT → SPEAKING
  // ------------------------------------------
  it('should transition from THINKING to SPEAKING on ENGINE_RESULT', () => {
    const ctx = thinkingContext();
    const event = makeEvent({
      type: 'ENGINE_RESULT',
      payload: { text: 'Sure, where to?', nodeId: 'speak-1', actionType: 'speak' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.SPEAKING);
    expect(result.context.ttsBufferActive).toBe(true);
    expect(result.context.speakingText).toBe('Sure, where to?');
    expect(result.context.currentNodeId).toBe('speak-1');
    expect(result.effects).toEqual([
      {
        type: 'EMIT_SPEAKING_TEXT',
        payload: { text: 'Sure, where to?', nodeId: 'speak-1' },
      },
    ]);
  });

  // ------------------------------------------
  // Test 4: SPEAKING → AGENT_TTS_END → LISTENING (normal turn cycle)
  // ------------------------------------------
  it('should transition from SPEAKING to LISTENING on AGENT_TTS_END', () => {
    const ctx = speakingContext();
    const event = makeEvent({ type: 'AGENT_TTS_END' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.LISTENING);
    expect(result.context.ttsBufferActive).toBe(false);
    expect(result.context.asrActive).toBe(true);
    expect(result.context.speakingText).toBeNull();
    expect(result.effects).toEqual([{ type: 'START_ASR' }]);
  });

  // ------------------------------------------
  // Test 5: SPEAKING → USER_SPEECH_START → INTERRUPTED (barge-in)
  // ------------------------------------------
  it('should transition from SPEAKING to INTERRUPTED on USER_SPEECH_START (barge-in)', () => {
    const ctx = speakingContext();
    const event = makeEvent({ type: 'USER_SPEECH_START' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.INTERRUPTED);
    expect(result.context.ttsBufferActive).toBe(false);
    expect(result.context.speakingText).toBeNull();
    expect(result.effects).toEqual([{ type: 'STOP_TTS' }]);
  });

  // ------------------------------------------
  // Test 6: Any → SESSION_END → IDLE with cleanup effects
  // ------------------------------------------
  it('should transition from SPEAKING to IDLE on SESSION_END with cleanup', () => {
    const ctx = speakingContext();
    const event = makeEvent({
      type: 'SESSION_END',
      payload: { reason: 'completed' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.context.sessionId).toBeNull();
    expect(result.context.ttsBufferActive).toBe(false);
    expect(result.context.asrActive).toBe(false);
    // Should emit STOP_TTS because ttsBufferActive was true
    expect(result.effects).toContainEqual({ type: 'STOP_TTS' });
  });

  it('should transition from LISTENING to IDLE on SESSION_END with cleanup', () => {
    const ctx = listeningContext();
    const event = makeEvent({ type: 'SESSION_END' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.context.asrActive).toBe(false);
    // Should emit STOP_ASR because asrActive was true
    expect(result.effects).toContainEqual({ type: 'STOP_ASR' });
  });

  // ------------------------------------------
  // Test 7: Any → ERROR → IDLE with cleanup effects
  // ------------------------------------------
  it('should transition from SPEAKING to IDLE on ERROR with cleanup', () => {
    const ctx = speakingContext();
    const event = makeEvent({
      type: 'ERROR',
      payload: { message: 'TTS provider failed', fatal: true },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.context.sessionId).toBeNull();
    expect(result.effects).toContainEqual({ type: 'STOP_TTS' });
    expect(result.effects).toContainEqual({
      type: 'LOG_EVENT',
      payload: { message: 'TTS provider failed', level: 'error' },
    });
  });

  it('should transition from THINKING to IDLE on ERROR', () => {
    const ctx = thinkingContext();
    const event = makeEvent({
      type: 'ERROR',
      payload: { message: 'Engine crash' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.effects).toContainEqual({
      type: 'LOG_EVENT',
      payload: { message: 'Engine crash', level: 'error' },
    });
  });

  // ------------------------------------------
  // Test 8: IDLE ignores USER_SPEECH_START (no active session)
  // ------------------------------------------
  it('should ignore USER_SPEECH_START when in IDLE state', () => {
    const ctx = createInitialTurnContext();
    const event = makeEvent({ type: 'USER_SPEECH_START' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.effects).toEqual([]);
  });

  // ------------------------------------------
  // Test 9: LISTENING ignores AGENT_TTS_END (no TTS active)
  // ------------------------------------------
  it('should ignore AGENT_TTS_END when in LISTENING state', () => {
    const ctx = listeningContext();
    const event = makeEvent({ type: 'AGENT_TTS_END' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.LISTENING);
    expect(result.effects).toEqual([]);
  });

  // ------------------------------------------
  // Test 10: Double USER_SPEECH_START while already LISTENING is ignored
  // ------------------------------------------
  it('should ignore USER_SPEECH_START when already LISTENING (idempotent)', () => {
    const ctx = listeningContext();
    const event = makeEvent({ type: 'USER_SPEECH_START' });

    const result = turnReducer(ctx, event);

    // Should stay in LISTENING, no effects
    expect(result.context.state).toBe(TURN_STATES.LISTENING);
    expect(result.effects).toEqual([]);
  });

  // ------------------------------------------
  // Test 11: THINKING ignores USER_SPEECH_START
  // ------------------------------------------
  it('should ignore USER_SPEECH_START when in THINKING state', () => {
    const ctx = thinkingContext();
    const event = makeEvent({ type: 'USER_SPEECH_START' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.THINKING);
    expect(result.effects).toEqual([]);
  });

  // ------------------------------------------
  // Test 12: INTERRUPTED emits STOP_TTS and eventually START_ASR
  // ------------------------------------------
  it('should emit STOP_TTS on barge-in and then START_ASR when resolved', () => {
    // Step 1: Barge-in
    const ctx1 = speakingContext();
    const bargeIn = makeEvent({ type: 'USER_SPEECH_START' });
    const result1 = turnReducer(ctx1, bargeIn);

    expect(result1.context.state).toBe(TURN_STATES.INTERRUPTED);
    expect(result1.effects).toEqual([{ type: 'STOP_TTS' }]);

    // Step 2: Resolve INTERRUPTED — user keeps speaking
    const continueEvent = makeEvent({ type: 'USER_SPEECH_START' });
    const result2 = turnReducer(result1.context, continueEvent);

    expect(result2.context.state).toBe(TURN_STATES.LISTENING);
    expect(result2.context.asrActive).toBe(true);
    expect(result2.effects).toEqual([{ type: 'START_ASR' }]);
  });

  // ------------------------------------------
  // Test 13: ENGINE_RESULT carries text payload into SPEAKING context
  // ------------------------------------------
  it('should carry ENGINE_RESULT text into speakingText field', () => {
    const ctx = thinkingContext();
    const event = makeEvent({
      type: 'ENGINE_RESULT',
      payload: { text: 'Your flight is booked!', nodeId: 'speak-2' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.speakingText).toBe('Your flight is booked!');
    expect(result.context.currentNodeId).toBe('speak-2');
  });

  // ------------------------------------------
  // Test 14: Full conversation cycle
  // ------------------------------------------
  it('should complete a full conversation cycle', () => {
    let ctx = createInitialTurnContext();

    // 1. Session starts
    let result = turnReducer(ctx, makeEvent({
      type: 'SESSION_START',
      payload: { workflowId: 'wf-1' },
    }));
    expect(result.context.state).toBe(TURN_STATES.LISTENING);
    ctx = result.context;

    // 2. User speaks
    result = turnReducer(ctx, makeEvent({
      type: 'USER_SPEECH_FINAL',
      payload: { transcript: 'hello' },
    }));
    expect(result.context.state).toBe(TURN_STATES.THINKING);
    ctx = result.context;

    // 3. Engine responds
    result = turnReducer(ctx, makeEvent({
      type: 'ENGINE_RESULT',
      payload: { text: 'Hi there!', nodeId: 'speak-1' },
    }));
    expect(result.context.state).toBe(TURN_STATES.SPEAKING);
    ctx = result.context;

    // 4. Agent finishes speaking
    result = turnReducer(ctx, makeEvent({ type: 'AGENT_TTS_END' }));
    expect(result.context.state).toBe(TURN_STATES.LISTENING);
    ctx = result.context;

    // 5. User speaks again
    result = turnReducer(ctx, makeEvent({
      type: 'USER_SPEECH_FINAL',
      payload: { transcript: 'goodbye' },
    }));
    expect(result.context.state).toBe(TURN_STATES.THINKING);
    ctx = result.context;

    // 6. Session ends
    result = turnReducer(ctx, makeEvent({
      type: 'SESSION_END',
      payload: { reason: 'completed' },
    }));
    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.context.sessionId).toBeNull();
  });

  // ------------------------------------------
  // Test 15: Reducer is pure (same input → same output, no mutation)
  // ------------------------------------------
  it('should be a pure function — same input produces same output', () => {
    const ctx = listeningContext();
    const event = makeEvent({
      type: 'USER_SPEECH_FINAL',
      payload: { transcript: 'test' },
    });

    const result1 = turnReducer(ctx, event);
    const result2 = turnReducer(ctx, event);

    expect(result1).toEqual(result2);
  });

  it('should not mutate the input context', () => {
    const ctx = listeningContext();
    const originalState = ctx.state;
    const originalAsrActive = ctx.asrActive;

    const event = makeEvent({
      type: 'USER_SPEECH_FINAL',
      payload: { transcript: 'test' },
    });

    turnReducer(ctx, event);

    // Original context should be unchanged
    expect(ctx.state).toBe(originalState);
    expect(ctx.asrActive).toBe(originalAsrActive);
  });

  // ------------------------------------------
  // Test 16: SILENCE_TIMEOUT in LISTENING → THINKING
  // ------------------------------------------
  it('should transition from LISTENING to THINKING on SILENCE_TIMEOUT', () => {
    const ctx = listeningContext({ lastTranscript: 'partial words' });
    const event = makeEvent({ type: 'SILENCE_TIMEOUT' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.THINKING);
    expect(result.context.asrActive).toBe(false);
    expect(result.effects).toContainEqual({ type: 'STOP_ASR' });
    expect(result.effects).toContainEqual({
      type: 'CALL_ENGINE',
      payload: { transcript: 'partial words' },
    });
  });

  // ------------------------------------------
  // Test 17: ERROR in IDLE only logs (no cleanup needed)
  // ------------------------------------------
  it('should only log when ERROR occurs in IDLE state', () => {
    const ctx = createInitialTurnContext();
    const event = makeEvent({
      type: 'ERROR',
      payload: { message: 'something went wrong' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    expect(result.effects).toEqual([
      { type: 'LOG_EVENT', payload: { message: 'something went wrong', level: 'error' } },
    ]);
  });

  // ------------------------------------------
  // Test 18: INTERRUPTED + USER_SPEECH_FINAL → THINKING directly
  // ------------------------------------------
  it('should go from INTERRUPTED to THINKING on USER_SPEECH_FINAL', () => {
    const ctx: TurnContext = {
      ...createInitialTurnContext(),
      state: TURN_STATES.INTERRUPTED,
      sessionId: 'test-session',
    };
    const event = makeEvent({
      type: 'USER_SPEECH_FINAL',
      payload: { transcript: 'actually, cancel that' },
    });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.THINKING);
    expect(result.context.lastTranscript).toBe('actually, cancel that');
    expect(result.effects).toContainEqual({
      type: 'CALL_ENGINE',
      payload: { transcript: 'actually, cancel that' },
    });
  });

  // ------------------------------------------
  // Test 19: SESSION_END cleanup only emits active resource stops
  // ------------------------------------------
  it('should only emit STOP effects for resources that are actually active', () => {
    // THINKING state: no TTS active, no ASR active
    const ctx = thinkingContext();
    const event = makeEvent({ type: 'SESSION_END' });

    const result = turnReducer(ctx, event);

    expect(result.context.state).toBe(TURN_STATES.IDLE);
    // Should NOT have STOP_TTS or STOP_ASR since neither was active
    expect(result.effects).not.toContainEqual({ type: 'STOP_TTS' });
    expect(result.effects).not.toContainEqual({ type: 'STOP_ASR' });
  });
});
