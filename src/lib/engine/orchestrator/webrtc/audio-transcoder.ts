// ============================================
// Audio Transcoder — Opus ↔ PCM
// ============================================
// Provides encoding and decoding between Opus
// audio frames and raw PCM samples. Designed for
// real-time WebRTC audio processing.
//
// Uses a lightweight in-process implementation
// rather than native bindings or WASM to avoid
// platform/deployment issues. For production,
// opus-encdec or @discordjs/opus can be swapped in.
// ============================================

// ------------------------------------------
// Types
// ------------------------------------------

export interface OpusDecoder {
  /** Decode an Opus frame to PCM (16-bit signed LE) */
  decode(opusFrame: Buffer): Int16Array;
  /** Reset decoder state */
  reset(): void;
  /** Release resources */
  destroy(): void;
}

export interface OpusEncoder {
  /** Encode PCM samples (16-bit signed LE) to an Opus frame */
  encode(pcmSamples: Int16Array): Buffer;
  /** Reset encoder state */
  reset(): void;
  /** Release resources */
  destroy(): void;
}

export interface TranscoderConfig {
  /** Sample rate in Hz (default: 48000 for Opus, output resampled to targetRate) */
  opusSampleRate?: number;
  /** Target sample rate for decoded PCM (default: 16000 for ASR) */
  targetPcmRate?: number;
  /** Channels (default: 1 for mono) */
  channels?: number;
  /** Frame duration in ms (default: 20) */
  frameDurationMs?: number;
}

const DEFAULT_CONFIG: Required<TranscoderConfig> = {
  opusSampleRate: 48000,
  targetPcmRate: 16000,
  channels: 1,
  frameDurationMs: 20,
};

// ------------------------------------------
// Opus Decoder (Passthrough / Simulated)
// ------------------------------------------
// NOTE: In production, this would use opus-encdec
// WASM or @discordjs/opus for real Opus decoding.
// The current implementation provides the correct
// interface and handles resampling, but treats
// incoming buffers as raw PCM for testability.
// ------------------------------------------

/**
 * G.711u (u-law) to Linear PCM 16-bit conversion.
 */
function ulawToLinear(ulaw: number): number {
  ulaw = ~ulaw & 0xff;
  const sign = ulaw & 0x80;
  const exponent = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  let sample = (mantissa << 3) + 132;
  sample <<= exponent;
  sample -= 132;
  // Final Linear PCM 16-bit sample
  return sign ? -sample : sample;
}

/**
 * Create a G.711u (PCMU) decoder that converts 8kHz u-law 
 * frames to 16kHz mono PCM suitable for ASR.
 */
export function createOpusDecoder(config: TranscoderConfig = {}): OpusDecoder {
  const cfg = { 
    ...DEFAULT_CONFIG, 
    opusSampleRate: 8000, // PCMU is 8kHz
    ...config 
  };
  let destroyed = false;

  return {
    decode(payload: Buffer): Int16Array {
      if (destroyed) throw new Error('Decoder is destroyed');

      // Decode G.711u bytes to PCM 16-bit
      const pcm8k = new Int16Array(payload.length);
      for (let i = 0; i < payload.length; i++) {
        pcm8k[i] = ulawToLinear(payload[i]);
      }

      // Resample from 8kHz to target (usually 16kHz)
      if (cfg.opusSampleRate !== cfg.targetPcmRate) {
        return resample(pcm8k, cfg.opusSampleRate, cfg.targetPcmRate);
      }

      return pcm8k;
    },

    reset() {},

    destroy() {
      destroyed = true;
    },
  };
}

// ------------------------------------------
// Opus Encoder (Passthrough / Simulated)
// ------------------------------------------

/**
 * Linear PCM 16-bit to G.711u (u-law) conversion.
 */
function linearToUlaw(sample: number): number {
  const sign = (sample >> 8) & 0x80;
  if (sample < 0) sample = -sample;
  
  const CLIP = 32635;
  const BIAS = 132;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/**
 * Create a G.711u (PCMU) encoder that converts PCM samples
 * to u-law frames for WebRTC transmission.
 */
export function createOpusEncoder(config: TranscoderConfig = {}): OpusEncoder {
  const cfg = { 
    ...DEFAULT_CONFIG, 
    opusSampleRate: 8000, // PCMU is 8kHz
    ...config 
  };
  let destroyed = false;

  return {
    encode(pcmSamples: Int16Array): Buffer {
      if (destroyed) throw new Error('Encoder is destroyed');

      // 1. Resample from input rate down to PCMU 8kHz
      let samples = pcmSamples;
      if (cfg.targetPcmRate !== cfg.opusSampleRate) {
        samples = resample(pcmSamples, cfg.targetPcmRate, cfg.opusSampleRate);
      }

      // 2. Encode Linear PCM 16-bit to G.711u
      const ulaw = Buffer.alloc(samples.length);
      for (let i = 0; i < samples.length; i++) {
        ulaw[i] = linearToUlaw(samples[i]);
      }

      return ulaw;
    },

    reset() {},

    destroy() {
      destroyed = true;
    },
  };
}

// ------------------------------------------
// Resampling
// ------------------------------------------

/**
 * Simple linear interpolation resampler.
 * Converts samples from `fromRate` to `toRate`.
 */
export function resample(
  input: Int16Array,
  fromRate: number,
  toRate: number,
): Int16Array {
  if (fromRate === toRate) return input;

  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const frac = srcIndex - srcIndexFloor;

    // Linear interpolation
    output[i] = Math.round(
      input[srcIndexFloor]! * (1 - frac) + input[srcIndexCeil]! * frac
    );
  }

  return output;
}

// ------------------------------------------
// Utility: Compute RMS energy from PCM
// ------------------------------------------

/**
 * Compute the RMS (Root Mean Square) energy level
 * from a PCM Int16 buffer. Returns dBFS value.
 */
export function computeRmsDbfs(samples: Int16Array): number {
  if (samples.length === 0) return -Infinity;

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const normalized = samples[i]! / 32768;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  if (rms === 0) return -Infinity;

  return 20 * Math.log10(rms);
}
