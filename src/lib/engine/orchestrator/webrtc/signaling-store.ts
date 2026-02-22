// ============================================
// WebRTC Signaling State Store
// ============================================
// In-memory signaling state store for pairing
// browser ↔ server WebRTC peers. Each entry holds
// pending ICE candidates and the server-side SDP
// answer until the peer connection is established.
// ============================================

import type { SignalIceCandidate } from './signaling-types';

// ------------------------------------------
// Types
// ------------------------------------------

export interface SignalingEntry {
  sessionId: string;
  /** Server-generated SDP answer (set once server peer is created) */
  serverSdp: string | null;
  /** Pending ICE candidates from server → client */
  serverCandidates: SignalIceCandidate['candidate'][];
  /** Pending ICE candidates from client → server (before server peer is ready) */
  clientCandidates: SignalIceCandidate['candidate'][];
  /** Timestamp of last activity (for cleanup) */
  lastActivity: number;
  /** Whether the session has been torn down */
  destroyed: boolean;
}

// ------------------------------------------
// Store
// ------------------------------------------

const store = new Map<string, SignalingEntry>();

/** Max age for stale entries (5 minutes) */
const MAX_ENTRY_AGE_MS = 5 * 60 * 1000;

/**
 * Get or create a signaling entry for a session.
 */
export function getOrCreateEntry(sessionId: string): SignalingEntry {
  let entry = store.get(sessionId);
  if (!entry) {
    entry = {
      sessionId,
      serverSdp: null,
      serverCandidates: [],
      clientCandidates: [],
      lastActivity: Date.now(),
      destroyed: false,
    };
    store.set(sessionId, entry);
  }
  entry.lastActivity = Date.now();
  return entry;
}

/**
 * Get an existing signaling entry.
 */
export function getEntry(sessionId: string): SignalingEntry | undefined {
  return store.get(sessionId);
}

/**
 * Remove a signaling entry.
 */
export function removeEntry(sessionId: string): void {
  const entry = store.get(sessionId);
  if (entry) {
    entry.destroyed = true;
  }
  store.delete(sessionId);
}

/**
 * Clean up stale entries older than MAX_ENTRY_AGE_MS.
 */
export function cleanupStaleEntries(): number {
  const now = Date.now();
  let removed = 0;
  for (const [id, entry] of store) {
    if (now - entry.lastActivity > MAX_ENTRY_AGE_MS) {
      store.delete(id);
      removed++;
    }
  }
  return removed;
}

/**
 * Get the number of active signaling entries.
 */
export function getActiveEntryCount(): number {
  return store.size;
}

/**
 * Clear all entries (for testing).
 */
export function clearAllEntries(): void {
  store.clear();
}
