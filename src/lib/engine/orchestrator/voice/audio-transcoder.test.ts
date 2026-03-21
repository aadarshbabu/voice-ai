import { describe, it, expect } from 'vitest';
import {
  createOpusDecoder,
  createOpusEncoder,
  resample,
  computeRmsDbfs,
} from './audio-transcoder';

describe('AudioTranscoder', () => {
  describe('resample', () => {
    it('passes through when rates are equal', () => {
      const input = new Int16Array([100, 200, 300, 400]);
      const output = resample(input, 16000, 16000);
      expect(output).toEqual(input);
    });

    it('downsamples 48kHz to 16kHz (3:1 ratio)', () => {
      // 6 samples at 48kHz → 2 samples at 16kHz
      const input = new Int16Array([100, 200, 300, 400, 500, 600]);
      const output = resample(input, 48000, 16000);
      expect(output.length).toBe(2);
    });

    it('upsamples 16kHz to 48kHz (1:3 ratio)', () => {
      // 2 samples at 16kHz → 6 samples at 48kHz
      const input = new Int16Array([1000, 2000]);
      const output = resample(input, 16000, 48000);
      expect(output.length).toBe(6);
      // First sample should be 1000, last should be close to 2000
      expect(output[0]).toBe(1000);
    });

    it('handles empty input', () => {
      const input = new Int16Array([]);
      const output = resample(input, 48000, 16000);
      expect(output.length).toBe(0);
    });
  });

  describe('OpusDecoder', () => {
    it('decodes a buffer to Int16Array', () => {
      const decoder = createOpusDecoder({ opusSampleRate: 16000, targetPcmRate: 16000 });
      // Create a buffer representing 4 PCM samples (8 bytes)
      const pcm = new Int16Array([100, 200, 300, 400]);
      const buf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const result = decoder.decode(buf);
      expect(result.length).toBe(4);
      expect(result[0]).toBe(100);
      expect(result[3]).toBe(400);
    });

    it('resamples from 48kHz to 16kHz during decode', () => {
      const decoder = createOpusDecoder({ opusSampleRate: 48000, targetPcmRate: 16000 });
      // 6 samples at 48kHz → 2 samples at 16kHz
      const pcm = new Int16Array([100, 200, 300, 400, 500, 600]);
      const buf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const result = decoder.decode(buf);
      expect(result.length).toBe(2);
    });

    it('throws after destroy', () => {
      const decoder = createOpusDecoder();
      decoder.destroy();
      const buf = Buffer.alloc(4);
      expect(() => decoder.decode(buf)).toThrow('Decoder is destroyed');
    });

    it('reset does not throw', () => {
      const decoder = createOpusDecoder();
      expect(() => decoder.reset()).not.toThrow();
    });
  });

  describe('OpusEncoder', () => {
    it('encodes PCM to a buffer', () => {
      const encoder = createOpusEncoder({ opusSampleRate: 16000, targetPcmRate: 16000 });
      const pcm = new Int16Array([500, 600, 700]);
      const result = encoder.encode(pcm);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(6); // 3 samples * 2 bytes
    });

    it('resamples from 16kHz to 48kHz during encode', () => {
      const encoder = createOpusEncoder({ opusSampleRate: 48000, targetPcmRate: 16000 });
      // 2 samples at 16kHz → 6 samples at 48kHz → 12 bytes
      const pcm = new Int16Array([1000, 2000]);
      const result = encoder.encode(pcm);
      expect(result.length).toBe(12); // 6 samples * 2 bytes
    });

    it('throws after destroy', () => {
      const encoder = createOpusEncoder();
      encoder.destroy();
      const pcm = new Int16Array([1]);
      expect(() => encoder.encode(pcm)).toThrow('Encoder is destroyed');
    });
  });

  describe('computeRmsDbfs', () => {
    it('returns -Infinity for silence (all zeros)', () => {
      const silence = new Int16Array([0, 0, 0, 0]);
      expect(computeRmsDbfs(silence)).toBe(-Infinity);
    });

    it('returns -Infinity for empty buffer', () => {
      const empty = new Int16Array([]);
      expect(computeRmsDbfs(empty)).toBe(-Infinity);
    });

    it('returns 0 dBFS for max amplitude signal', () => {
      // Full-scale signal: all samples at max (32767)
      const maxSignal = new Int16Array([32767, 32767, 32767, 32767]);
      const dbfs = computeRmsDbfs(maxSignal);
      // Should be very close to 0 dBFS (full scale)
      expect(dbfs).toBeGreaterThan(-1);
      expect(dbfs).toBeLessThanOrEqual(0);
    });

    it('returns negative dBFS for quieter signals', () => {
      // Half amplitude → ~-6 dBFS
      const halfSignal = new Int16Array([16384, 16384, 16384, 16384]);
      const dbfs = computeRmsDbfs(halfSignal);
      expect(dbfs).toBeLessThan(-5);
      expect(dbfs).toBeGreaterThan(-7);
    });

    it('speech-level signal has reasonable dBFS', () => {
      // Simulate typical speech-level samples (~3000-5000 amplitude)
      const speech = new Int16Array([3000, -3500, 4000, -2500, 3200]);
      const dbfs = computeRmsDbfs(speech);
      // Should be somewhere around -20 to -15 dBFS
      expect(dbfs).toBeLessThan(-15);
      expect(dbfs).toBeGreaterThan(-25);
    });
  });
});
