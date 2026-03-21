// ============================================
// Voice Module — Public API
// ============================================

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

// Voice bridge
export { createVoiceBridge } from './bridge-voice';
export type { VoiceBridge, VoiceBridgeConfig } from './bridge-voice';

// LiveKit Agent
export { LiveKitAgent } from './livekit-agent';
