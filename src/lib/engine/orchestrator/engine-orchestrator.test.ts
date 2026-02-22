import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { EngineOrchestrator } from './engine-orchestrator';
import { createNoopHandlers } from './effect-handlers';
import type { EffectHandlers, OrchestratorConfig, PrismaLike } from './effect-handlers';
import type { VoiceEvent } from './events';
import type { AdvanceResult, ExecutionContext } from '../types';
import { TURN_STATES } from './types';

// ============================================
// Mock external modules
// ============================================

// Mock the runner module
vi.mock('../runner', () => ({
  runWorkflowUntilWait: vi.fn(),
}));

// Mock the session-emitter module
vi.mock('../session-emitter', () => ({
  sessionEmitter: {
    notifyUpdate: vi.fn(),
    notifyComplete: vi.fn(),
  },
}));

// Import after mocking so we get the mocked versions
import { runWorkflowUntilWait } from '../runner';
import { sessionEmitter } from '../session-emitter';

// ============================================
// Test Helpers
// ============================================

function createMockPrisma(): PrismaLike {
  return {
    workflow: {
      findUnique: vi.fn(),
    },
    workflowSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createMockHandlers(): EffectHandlers & { [K in keyof EffectHandlers]: Mock } {
  return {
    onStartASR: vi.fn().mockResolvedValue(undefined),
    onStopASR: vi.fn().mockResolvedValue(undefined),
    onStopTTS: vi.fn().mockResolvedValue(undefined),
    onEmitSpeakingText: vi.fn().mockResolvedValue(undefined),
    onEmitAudio: vi.fn().mockResolvedValue(undefined),
    onLogEvent: vi.fn().mockResolvedValue(undefined),
  };
}

function createTestConfig(overrides?: Partial<OrchestratorConfig>): OrchestratorConfig {
  return {
    sessionId: 'test-session-1',
    workflowId: 'test-workflow-1',
    handlers: createMockHandlers(),
    prisma: createMockPrisma(),
    llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
    ...overrides,
  };
}

function makeEvent(type: string, payload?: Record<string, unknown>): VoiceEvent {
  return {
    type,
    sessionId: 'test-session-1',
    timestamp: new Date().toISOString(),
    ...(payload ? { payload } : {}),
  } as VoiceEvent;
}

function makeMockAdvanceResult(
  actionType: string,
  actionData?: Record<string, unknown>,
): AdvanceResult {
  const now = new Date().toISOString();
  return {
    context: {
      sessionId: 'test-session-1',
      workflowId: 'test-workflow-1',
      currentNodeId: 'node-1',
      variables: {},
      transcript: [],
      status: actionType === 'completed' ? 'completed' : actionType === 'error' ? 'error' : 'running',
      createdAt: now,
      updatedAt: now,
    },
    action: {
      type: actionType,
      ...actionData,
    } as AdvanceResult['action'],
  };
}

function setupEngineCallMocks(
  config: OrchestratorConfig,
  advanceResult: AdvanceResult,
): void {
  const prisma = config.prisma as {
    workflow: { findUnique: Mock };
    workflowSession: { findUnique: Mock; update: Mock };
  };

  prisma.workflow.findUnique.mockResolvedValue({
    id: 'test-workflow-1',
    userId: 'user-1',
    nodes: [{ id: 'trigger-1', type: 'trigger' }],
    edges: [],
  });

  prisma.workflowSession.findUnique.mockResolvedValue({
    id: 'test-session-1',
    metadata: {
      context: {
        sessionId: 'test-session-1',
        workflowId: 'test-workflow-1',
        currentNodeId: null,
        variables: {},
        transcript: [],
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    status: 'ACTIVE',
  });

  prisma.workflowSession.update.mockResolvedValue({});

  (runWorkflowUntilWait as Mock).mockResolvedValue(advanceResult);
}

// ============================================
// Tests
// ============================================

describe('EngineOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // 6.2: dispatch(SESSION_START) triggers onStartASR
  // ------------------------------------------
  it('should trigger onStartASR when SESSION_START is dispatched', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    await orchestrator.dispatch(makeEvent('SESSION_START', { workflowId: 'test-workflow-1' }));

    expect(handlers.onStartASR).toHaveBeenCalledOnce();
    expect(orchestrator.getContext().state).toBe(TURN_STATES.LISTENING);
  });

  // ------------------------------------------
  // 6.3: dispatch(USER_SPEECH_FINAL) triggers onStopASR → onCallEngine
  // ------------------------------------------
  it('should trigger onStopASR when USER_SPEECH_FINAL is dispatched from LISTENING', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // Setup: transition to LISTENING first
    await orchestrator.dispatch(makeEvent('SESSION_START'));

    // Setup mocks for the engine call that will be triggered
    const advanceResult = makeMockAdvanceResult('wait_for_input', { nodeId: 'listen-1' });
    setupEngineCallMocks(config, advanceResult);

    // Act
    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Hello world', confidence: 0.95 }),
    );

    // Assert: onStopASR was called
    expect(handlers.onStopASR).toHaveBeenCalled();
  });

  // ------------------------------------------
  // 6.4: handleCallEngine maps speak → ENGINE_RESULT → SPEAKING
  // ------------------------------------------
  it('should map speak action to ENGINE_RESULT and transition to SPEAKING', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // Setup: IDLE → LISTENING
    await orchestrator.dispatch(makeEvent('SESSION_START'));

    // Setup engine to return a speak action
    const advanceResult = makeMockAdvanceResult('speak', {
      text: 'Hello, how can I help?',
      nodeId: 'speak-1',
    });
    setupEngineCallMocks(config, advanceResult);

    // Act: LISTENING → THINKING → (engine) → SPEAKING
    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Hi', confidence: 0.9 }),
    );

    // Assert: ended up in SPEAKING state with speaking text emitted
    expect(orchestrator.getContext().state).toBe(TURN_STATES.SPEAKING);
    expect(handlers.onEmitSpeakingText).toHaveBeenCalledWith(
      'Hello, how can I help?',
      'speak-1',
      expect.any(AbortSignal),
    );
  });

  // ------------------------------------------
  // 6.5: handleCallEngine maps completed → SESSION_END → IDLE
  // ------------------------------------------
  it('should map completed action to SESSION_END and transition to IDLE', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    const advanceResult = makeMockAdvanceResult('completed');
    setupEngineCallMocks(config, advanceResult);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Goodbye', confidence: 0.9 }),
    );

    expect(orchestrator.getContext().state).toBe(TURN_STATES.IDLE);
  });

  // ------------------------------------------
  // 6.6: handleCallEngine maps error → ERROR → IDLE with cleanup
  // ------------------------------------------
  it('should map error action to ERROR and transition to IDLE with cleanup', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    const advanceResult = makeMockAdvanceResult('error', { message: 'Something broke' });
    setupEngineCallMocks(config, advanceResult);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Test', confidence: 1.0 }),
    );

    expect(orchestrator.getContext().state).toBe(TURN_STATES.IDLE);
    expect(handlers.onLogEvent).toHaveBeenCalledWith('Something broke', 'error');
  });

  // ------------------------------------------
  // 6.7: Barge-in during SPEAKING triggers onStopTTS
  // ------------------------------------------
  it('should trigger onStopTTS on barge-in (USER_SPEECH_START during SPEAKING)', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // Setup: get to SPEAKING state
    await orchestrator.dispatch(makeEvent('SESSION_START'));

    const advanceResult = makeMockAdvanceResult('speak', {
      text: 'Let me help you with that.',
      nodeId: 'speak-1',
    });
    setupEngineCallMocks(config, advanceResult);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Help', confidence: 0.95 }),
    );

    expect(orchestrator.getContext().state).toBe(TURN_STATES.SPEAKING);

    // Act: barge-in
    await orchestrator.dispatch(makeEvent('USER_SPEECH_START'));

    // Assert: TTS was stopped
    expect(handlers.onStopTTS).toHaveBeenCalled();
    // FSM transitions to INTERRUPTED (transient state per 10.1 design)
    expect(orchestrator.getContext().state).toBe(TURN_STATES.INTERRUPTED);
  });

  // ------------------------------------------
  // 6.8: SESSION_END triggers cleanup effects
  // ------------------------------------------
  it('should trigger cleanup effects on SESSION_END', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // Get to LISTENING state
    await orchestrator.dispatch(makeEvent('SESSION_START'));
    expect(orchestrator.getContext().state).toBe(TURN_STATES.LISTENING);

    // End session
    await orchestrator.dispatch(makeEvent('SESSION_END', { reason: 'user_hangup' }));

    // ASR was active, so STOP_ASR should be called
    expect(handlers.onStopASR).toHaveBeenCalled();
    expect(orchestrator.getContext().state).toBe(TURN_STATES.IDLE);
  });

  // ------------------------------------------
  // 6.9: Effect handler errors are caught gracefully
  // ------------------------------------------
  it('should catch effect handler errors and log them', async () => {
    const config = createTestConfig();
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // Make onStartASR throw
    handlers.onStartASR.mockRejectedValueOnce(new Error('ASR init failed'));

    const orchestrator = new EngineOrchestrator(config);

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    // Should have logged the error via onLogEvent
    expect(handlers.onLogEvent).toHaveBeenCalledWith(
      expect.stringContaining('ASR init failed'),
      'error',
    );
  });

  // ------------------------------------------
  // 6.10: getContext() returns a copy
  // ------------------------------------------
  it('should return a copy from getContext(), not a reference', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);

    const ctx1 = orchestrator.getContext();
    const ctx2 = orchestrator.getContext();

    expect(ctx1).toEqual(ctx2);
    expect(ctx1).not.toBe(ctx2); // Different objects
  });

  // ------------------------------------------
  // 6.11: destroy() aborts TTS and marks destroyed
  // ------------------------------------------
  it('should abort TTS and prevent further dispatch after destroy()', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // Get to SPEAKING so TTS is active
    await orchestrator.dispatch(makeEvent('SESSION_START'));
    const advanceResult = makeMockAdvanceResult('speak', {
      text: 'Testing destroy',
      nodeId: 'speak-1',
    });
    setupEngineCallMocks(config, advanceResult);
    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'test', confidence: 1 }),
    );

    // Destroy
    orchestrator.destroy();

    // Further dispatch should be ignored
    handlers.onStartASR.mockClear();
    await orchestrator.dispatch(makeEvent('SESSION_START'));
    expect(handlers.onStartASR).not.toHaveBeenCalled();
  });

  // ------------------------------------------
  // 6.12: Multiple rapid dispatch calls are serialized
  // ------------------------------------------
  it('should serialize multiple rapid dispatch() calls', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    const callOrder: string[] = [];

    handlers.onStartASR.mockImplementation(async () => {
      callOrder.push('onStartASR');
      // Simulate async delay
      await new Promise((r) => setTimeout(r, 10));
    });

    handlers.onStopASR.mockImplementation(async () => {
      callOrder.push('onStopASR');
    });

    // Dispatch two events rapidly (don't await between them)
    const p1 = orchestrator.dispatch(makeEvent('SESSION_START'));

    // Setup engine for the second dispatch
    const advanceResult = makeMockAdvanceResult('wait_for_input', { nodeId: 'listen-1' });
    setupEngineCallMocks(config, advanceResult);

    const p2 = orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Hello', confidence: 1 }),
    );

    // Wait for both
    await Promise.all([p1, p2]);

    // onStartASR should have been called before onStopASR
    const startIdx = callOrder.indexOf('onStartASR');
    const stopIdx = callOrder.indexOf('onStopASR');
    expect(startIdx).toBeLessThan(stopIdx);
  });

  // ------------------------------------------
  // 6.13: SILENCE_TIMEOUT triggers engine call with last transcript
  // ------------------------------------------
  it('should trigger engine call on SILENCE_TIMEOUT in LISTENING state', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    const advanceResult = makeMockAdvanceResult('wait_for_input', { nodeId: 'listen-1' });
    setupEngineCallMocks(config, advanceResult);

    await orchestrator.dispatch(makeEvent('SILENCE_TIMEOUT'));

    // Should have called the engine (runWorkflowUntilWait)
    expect(runWorkflowUntilWait).toHaveBeenCalled();
  });

  // ------------------------------------------
  // 6.14: Session persistence — load and save via Prisma
  // ------------------------------------------
  it('should load and save ExecutionContext via Prisma during engine call', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const prisma = config.prisma as {
      workflow: { findUnique: Mock };
      workflowSession: { findUnique: Mock; update: Mock };
    };

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    const advanceResult = makeMockAdvanceResult('speak', {
      text: 'Persisted response',
      nodeId: 'speak-1',
    });
    setupEngineCallMocks(config, advanceResult);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Test persist', confidence: 1 }),
    );

    // Should have loaded workflow
    expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
      where: { id: 'test-workflow-1' },
    });

    // Should have loaded session
    expect(prisma.workflowSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'test-session-1' },
    });

    // Should have saved updated context
    expect(prisma.workflowSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'test-session-1' },
        data: expect.objectContaining({
          metadata: expect.any(Object),
          status: expect.any(String),
        }),
      }),
    );
  });

  // ------------------------------------------
  // 6.15: sessionEmitter.notifyUpdate() called after each dispatch
  // ------------------------------------------
  it('should call sessionEmitter.notifyUpdate after each dispatch', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    expect(sessionEmitter.notifyUpdate).toHaveBeenCalledWith(
      'test-session-1',
      expect.objectContaining({
        sessionId: 'test-session-1',
        fsmState: TURN_STATES.LISTENING,
      }),
    );
  });

  // ------------------------------------------
  // 6.16: Full conversation cycle
  // ------------------------------------------
  it('should handle full conversation cycle: START → SPEECH → ENGINE → TTS_END → SPEECH → END', async () => {
    const config = createTestConfig();
    const orchestrator = new EngineOrchestrator(config);
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;

    // 1. Start session
    await orchestrator.dispatch(makeEvent('SESSION_START', { workflowId: 'test-workflow-1' }));
    expect(orchestrator.getContext().state).toBe(TURN_STATES.LISTENING);
    expect(handlers.onStartASR).toHaveBeenCalledTimes(1);

    // 2. User speaks
    const speakResult = makeMockAdvanceResult('speak', {
      text: 'Hello! How can I help?',
      nodeId: 'speak-1',
    });
    setupEngineCallMocks(config, speakResult);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Hi there', confidence: 0.98 }),
    );
    expect(orchestrator.getContext().state).toBe(TURN_STATES.SPEAKING);

    // 3. Agent finishes speaking
    await orchestrator.dispatch(makeEvent('AGENT_TTS_END'));
    expect(orchestrator.getContext().state).toBe(TURN_STATES.LISTENING);

    // 4. User speaks again, engine completes
    const completeResult = makeMockAdvanceResult('completed');
    setupEngineCallMocks(config, completeResult);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'Thanks, bye', confidence: 0.95 }),
    );

    // Should have ended in IDLE
    expect(orchestrator.getContext().state).toBe(TURN_STATES.IDLE);
    expect(sessionEmitter.notifyComplete).toHaveBeenCalled();
  });

  // ------------------------------------------
  // Additional: createNoopHandlers returns valid handlers
  // ------------------------------------------
  it('should create valid noop handlers that do nothing', async () => {
    const handlers = createNoopHandlers();

    // All handlers should be callable without errors
    await expect(handlers.onStartASR()).resolves.toBeUndefined();
    await expect(handlers.onStopASR()).resolves.toBeUndefined();
    await expect(handlers.onStopTTS()).resolves.toBeUndefined();
    await expect(handlers.onEmitSpeakingText('test')).resolves.toBeUndefined();
    await expect(handlers.onEmitAudio('test')).resolves.toBeUndefined();
    await expect(handlers.onLogEvent('test', 'info')).resolves.toBeUndefined();
  });

  // ------------------------------------------
  // Additional: Workflow not found triggers ERROR
  // ------------------------------------------
  it('should dispatch ERROR when workflow is not found in DB', async () => {
    const config = createTestConfig();
    const handlers = config.handlers as ReturnType<typeof createMockHandlers>;
    const orchestrator = new EngineOrchestrator(config);
    const prisma = config.prisma as {
      workflow: { findUnique: Mock };
      workflowSession: { findUnique: Mock; update: Mock };
    };

    await orchestrator.dispatch(makeEvent('SESSION_START'));

    // Mock workflow not found
    prisma.workflow.findUnique.mockResolvedValue(null);

    await orchestrator.dispatch(
      makeEvent('USER_SPEECH_FINAL', { transcript: 'test', confidence: 1 }),
    );

    // Should end in IDLE due to error
    expect(orchestrator.getContext().state).toBe(TURN_STATES.IDLE);
    expect(handlers.onLogEvent).toHaveBeenCalledWith(
      expect.stringContaining('not found'),
      'error',
    );
  });
});
