import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalingMessageSchema,
  SignalOfferSchema,
  SignalAnswerSchema,
  SignalIceCandidateSchema,
  SignalByeSchema,
  SignalResponseSchema,
} from './signaling-types';
import {
  getOrCreateEntry,
  getEntry,
  removeEntry,
  cleanupStaleEntries,
  getActiveEntryCount,
  clearAllEntries,
} from './signaling-store';

// ============================================
// Signaling Types Tests
// ============================================

describe('SignalingMessageSchema', () => {
  it('validates a correct offer message', () => {
    const offer = {
      type: 'offer',
      sessionId: 'session-123',
      sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1...',
    };
    const result = SignalingMessageSchema.safeParse(offer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('offer');
    }
  });

  it('validates a correct ice-candidate message', () => {
    const iceMsg = {
      type: 'ice-candidate',
      sessionId: 'session-123',
      candidate: {
        candidate: 'candidate:1 1 UDP 2013266431 10.0.0.1 12345 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    };
    const result = SignalingMessageSchema.safeParse(iceMsg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('ice-candidate');
    }
  });

  it('validates a correct bye message', () => {
    const bye = { type: 'bye', sessionId: 'session-123', reason: 'user-hangup' };
    const result = SignalingMessageSchema.safeParse(bye);
    expect(result.success).toBe(true);
  });

  it('rejects messages with missing sessionId', () => {
    const bad = { type: 'offer', sdp: 'some-sdp' };
    const result = SignalingMessageSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects messages with unknown type', () => {
    const bad = { type: 'unknown', sessionId: 'x' };
    const result = SignalingMessageSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects offer with empty sdp', () => {
    const bad = { type: 'offer', sessionId: 'x', sdp: '' };
    const result = SignalOfferSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('SignalResponseSchema', () => {
  it('validates a correct answer response', () => {
    const resp = {
      ok: true,
      type: 'answer',
      sessionId: 'session-123',
      sdp: 'v=0\r\nserver-sdp...',
    };
    const result = SignalResponseSchema.safeParse(resp);
    expect(result.success).toBe(true);
  });

  it('validates an error response', () => {
    const resp = {
      ok: false,
      type: 'error',
      sessionId: 'session-123',
      error: 'Something went wrong',
    };
    const result = SignalResponseSchema.safeParse(resp);
    expect(result.success).toBe(true);
  });
});

// ============================================
// Signaling Store Tests
// ============================================

describe('SignalingStore', () => {
  beforeEach(() => {
    clearAllEntries();
  });

  it('creates a new entry for unknown sessionId', () => {
    const entry = getOrCreateEntry('new-session');
    expect(entry.sessionId).toBe('new-session');
    expect(entry.serverSdp).toBeNull();
    expect(entry.serverCandidates).toEqual([]);
    expect(entry.clientCandidates).toEqual([]);
    expect(entry.destroyed).toBe(false);
  });

  it('returns existing entry for known sessionId', () => {
    const entry1 = getOrCreateEntry('session-1');
    entry1.serverSdp = 'test-sdp';
    const entry2 = getOrCreateEntry('session-1');
    expect(entry2.serverSdp).toBe('test-sdp');
  });

  it('getEntry returns undefined for non-existent session', () => {
    expect(getEntry('non-existent')).toBeUndefined();
  });

  it('removeEntry marks entry as destroyed and removes it', () => {
    const entry = getOrCreateEntry('to-remove');
    removeEntry('to-remove');
    expect(entry.destroyed).toBe(true);
    expect(getEntry('to-remove')).toBeUndefined();
  });

  it('tracks active entry count', () => {
    getOrCreateEntry('s1');
    getOrCreateEntry('s2');
    getOrCreateEntry('s3');
    expect(getActiveEntryCount()).toBe(3);
    removeEntry('s2');
    expect(getActiveEntryCount()).toBe(2);
  });

  it('cleanupStaleEntries removes old entries', () => {
    const entry = getOrCreateEntry('stale-session');
    // Force the entry to be stale (6 minutes ago)
    entry.lastActivity = Date.now() - 6 * 60 * 1000;
    const removed = cleanupStaleEntries();
    expect(removed).toBe(1);
    expect(getEntry('stale-session')).toBeUndefined();
  });

  it('cleanupStaleEntries keeps recent entries', () => {
    getOrCreateEntry('fresh-session');
    const removed = cleanupStaleEntries();
    expect(removed).toBe(0);
    expect(getEntry('fresh-session')).toBeDefined();
  });

  it('clearAllEntries removes everything', () => {
    getOrCreateEntry('a');
    getOrCreateEntry('b');
    clearAllEntries();
    expect(getActiveEntryCount()).toBe(0);
  });
});
