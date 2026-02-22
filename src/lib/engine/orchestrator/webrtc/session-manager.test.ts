import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { WebRTCSessionManager } from './session-manager';
import type { PrismaLike } from '../effect-handlers';

// ============================================
// Mock dependencies
// ============================================

vi.mock('./server-peer', () => ({
  createServerPeer: vi.fn().mockImplementation((config: any) => ({
    sessionId: config.sessionId,
    pc: {},
    getConnectionState: () => 'new',
    handleOffer: vi.fn().mockResolvedValue('mock-answer-sdp'),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    sendAudioFrame: vi.fn(),
    destroy: vi.fn(),
    // Expose callbacks for testing
    _config: config,
  })),
}));

vi.mock('./webrtc-bridge', () => ({
  createWebRTCBridge: vi.fn().mockImplementation((config: any) => ({
    isSpeechActive: false,
    handleAudioFrame: vi.fn(),
    handleSpeakText: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
    destroy: vi.fn(),
    _config: config,
  })),
}));

vi.mock('../engine-orchestrator', () => ({
  EngineOrchestrator: vi.fn().mockImplementation(() => ({
    dispatch: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn().mockReturnValue({ state: 'IDLE' }),
    destroy: vi.fn(),
  })),
}));

vi.mock('../effect-handlers', () => ({
  createNoopHandlers: vi.fn().mockReturnValue({
    onStartASR: vi.fn(),
    onStopASR: vi.fn(),
    onStopTTS: vi.fn(),
    onCallEngine: vi.fn(),
    onEmitSpeakingText: vi.fn(),
    onEmitAudio: vi.fn(),
    onLogEvent: vi.fn(),
  }),
}));

describe('WebRTCSessionManager', () => {
  let mockPrisma: PrismaLike;
  let manager: WebRTCSessionManager;

  beforeEach(() => {
    vi.useFakeTimers();

    mockPrisma = {
      workflow: {
        findUnique: vi.fn().mockResolvedValue({ id: 'wf-1', nodes: [], edges: [] }),
      },
      workflowSession: {
        findUnique: vi.fn().mockResolvedValue({ id: 'sess-1', metadata: null }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: 'sess-1' }),
      },
    } as unknown as PrismaLike;

    manager = new WebRTCSessionManager({
      prisma: mockPrisma,
      maxSessions: 3,
      idleTimeoutMs: 5000,
      // Use a very large interval so periodic cleanup doesn't interfere with tests
      cleanupIntervalMs: 999_999_999,
    });
  });

  afterEach(() => {
    manager.destroyAll();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('creates a session and returns SDP answer', async () => {
    const result = await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    expect(result.answerSdp).toBe('mock-answer-sdp');
    expect(manager.getActiveSessionCount()).toBe(1);
  });

  it('getSession returns the entry after creation', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    const entry = manager.getSession('sess-1');
    expect(entry).toBeDefined();
    expect(entry?.sessionId).toBe('sess-1');
    expect(entry?.workflowId).toBe('wf-1');
  });

  it('rejects duplicate session IDs', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    await expect(
      manager.createSession('sess-1', 'wf-1', 'offer-sdp')
    ).rejects.toThrow('already exists');
  });

  it('enforces max session limit', async () => {
    await manager.createSession('s1', 'wf-1', 'sdp');
    await manager.createSession('s2', 'wf-1', 'sdp');
    await manager.createSession('s3', 'wf-1', 'sdp');
    await expect(
      manager.createSession('s4', 'wf-1', 'sdp')
    ).rejects.toThrow('Max sessions reached');
  });

  it('destroySession removes the session', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    await manager.destroySession('sess-1');
    expect(manager.getActiveSessionCount()).toBe(0);
    expect(manager.getSession('sess-1')).toBeUndefined();
  });

  it('destroySession dispatches SESSION_END', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    const entry = manager.getSession('sess-1')!;
    await manager.destroySession('sess-1', 'user_hangup');
    expect(entry.orchestrator.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SESSION_END' })
    );
  });

  it('destroySession destroys all sub-components', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    const entry = manager.getSession('sess-1')!;
    await manager.destroySession('sess-1');
    expect(entry.bridge.destroy).toHaveBeenCalled();
    expect(entry.serverPeer.destroy).toHaveBeenCalled();
    expect(entry.orchestrator.destroy).toHaveBeenCalled();
  });

  it('addIceCandidate adds candidate to the server peer', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    await manager.addIceCandidate('sess-1', {
      candidate: 'candidate:1',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    const entry = manager.getSession('sess-1')!;
    expect(entry.serverPeer.addIceCandidate).toHaveBeenCalled();
  });

  it('addIceCandidate throws for unknown session', async () => {
    await expect(
      manager.addIceCandidate('unknown', { candidate: 'x' })
    ).rejects.toThrow('not found');
  });

  it('cleanupIdleSessions removes idle sessions', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    // Manually set lastActivity to the past (beyond idle timeout)
    const entry = manager.getSession('sess-1')!;
    entry.lastActivity = Date.now() - 6000;
    const cleaned = manager.cleanupIdleSessions();
    expect(cleaned).toBe(1);
    expect(manager.getActiveSessionCount()).toBe(0);
  });

  it('cleanupIdleSessions does not remove active sessions', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    // Only advance 1 second (below 5s idle timeout)
    vi.advanceTimersByTime(1000);
    const cleaned = manager.cleanupIdleSessions();
    expect(cleaned).toBe(0);
    expect(manager.getActiveSessionCount()).toBe(1);
  });

  it('destroyAll cleans up everything', async () => {
    await manager.createSession('s1', 'wf-1', 'sdp');
    await manager.createSession('s2', 'wf-1', 'sdp');
    manager.destroyAll();
    expect(manager.getActiveSessionCount()).toBe(0);
  });

  it('createSession dispatches SESSION_START', async () => {
    await manager.createSession('sess-1', 'wf-1', 'offer-sdp');
    const entry = manager.getSession('sess-1')!;
    expect(entry.orchestrator.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SESSION_START',
        payload: { workflowId: 'wf-1' },
      })
    );
  });
});
