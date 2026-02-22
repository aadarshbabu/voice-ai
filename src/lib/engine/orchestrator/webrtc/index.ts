// ============================================
// WebRTC Module — Public API
// ============================================

// Signaling types
export type {
  SignalOffer,
  SignalAnswer,
  SignalIceCandidate,
  SignalBye,
  SignalingMessage,
  SignalResponse,
} from './signaling-types';
export {
  SignalOfferSchema,
  SignalAnswerSchema,
  SignalIceCandidateSchema,
  SignalByeSchema,
  SignalingMessageSchema,
  SignalResponseSchema,
} from './signaling-types';

// Signaling store
export {
  getOrCreateEntry,
  getEntry,
  removeEntry,
  cleanupStaleEntries,
  getActiveEntryCount,
  clearAllEntries,
} from './signaling-store';
export type { SignalingEntry } from './signaling-store';

// Server peer
export { createServerPeer } from './server-peer';
export type { ServerPeer, ServerPeerConfig } from './server-peer';

// Audio transcoder
export {
  createOpusDecoder,
  createOpusEncoder,
  resample,
  computeRmsDbfs,
} from './audio-transcoder';
export type {
  OpusDecoder,
  OpusEncoder,
  TranscoderConfig,
} from './audio-transcoder';

// WebRTC bridge
export { createWebRTCBridge } from './bridge-voice';
export type { WebRTCBridge, WebRTCBridgeConfig } from './bridge-voice';

// Session manager
export { WebRTCSessionManager } from './session-manager';
export type {
  WebRTCSessionEntry,
  SessionManagerConfig,
} from './session-manager';
