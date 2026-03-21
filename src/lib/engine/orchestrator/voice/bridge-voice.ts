// ============================================
// Voice Bridge — Audio ↔ EngineOrchestrator
// ============================================
// Manages the VAD and audio streaming logic for voice sessions.
// ============================================

import type { OpusDecoder, OpusEncoder } from './audio-transcoder';
import { createOpusDecoder, createOpusEncoder, computeRmsDbfs } from './audio-transcoder';
import type { VoiceEvent } from '../events';

// ------------------------------------------
// Types
// ------------------------------------------

export interface VoiceBridgeConfig {
  sessionId: string;
  dispatchEvent: (event: VoiceEvent) => Promise<void>;
  transcribePcm?: (pcmBase64: string, mimeType: string) => Promise<string | null>;
  synthesizeSpeech?: (text: string) => Promise<Buffer | null>;
  sendAudioFrame: (frame: Buffer) => void;
  vadThresholdDbfs?: number;
  minSpeechDurationMs?: number;
  silenceAfterSpeechMs?: number;
}

export interface VoiceBridge {
  handleAudioFrame(frame: Buffer, timestamp: number): void;
  handleSpeakText(text: string, nodeId?: string): Promise<void>;
  stopSpeaking(): void;
  destroy(): void;
  readonly isSpeechActive: boolean;
}

const DEFAULT_VAD_THRESHOLD_DBFS = -35;
const DEFAULT_MIN_SPEECH_DURATION_MS = 150;
const DEFAULT_SILENCE_AFTER_SPEECH_MS = 800;

export function createVoiceBridge(config: VoiceBridgeConfig): VoiceBridge {
  const {
    sessionId,
    dispatchEvent,
    transcribePcm,
    synthesizeSpeech,
    sendAudioFrame,
    vadThresholdDbfs = DEFAULT_VAD_THRESHOLD_DBFS,
    minSpeechDurationMs = DEFAULT_MIN_SPEECH_DURATION_MS,
    silenceAfterSpeechMs = DEFAULT_SILENCE_AFTER_SPEECH_MS,
  } = config;

  console.log(`[VAD-V4:${sessionId}] Bridge initialized. Threshold: ${vadThresholdDbfs}, Min Dur: ${minSpeechDurationMs}`);

  const decoder = createOpusDecoder();
  const encoder = createOpusEncoder();
  let destroyed = false;

  let speechActive = false;
  let speechStartTime: number | null = null;
  let lastSpeechTime: number = Date.now();
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const speechBuffer: Int16Array[] = [];
  let ttsAbortController: AbortController | null = null;
  let pulseCounter = 0;

  function dispatch(event: VoiceEvent): void {
    if (destroyed) return;
    void dispatchEvent(event).catch((err) => {
      console.error(`[VAD-V4:${sessionId}] Dispatch error:`, err);
    });
  }

  function onSilenceTimeout(): void {
    if (destroyed || !speechActive) return;

    console.log(`[VAD-V4:${sessionId}] Silence detected for ${silenceAfterSpeechMs}ms. Finalizing.`);
    speechActive = false;
    silenceTimer = null;

    const totalLength = speechBuffer.reduce((acc, buf) => acc + buf.length, 0);
    const concatenated = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of speechBuffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }
    speechBuffer.length = 0;

    const pcmBuffer = Buffer.from(concatenated.buffer, concatenated.byteOffset, concatenated.byteLength);
    const pcmBase64 = pcmBuffer.toString('base64');

    if (transcribePcm) {
      void transcribePcm(pcmBase64, 'audio/pcm').then((transcript) => {
        const finalTranscript = transcript || "";
        console.log(`[VAD-V4:${sessionId}] STT Finished. Result: "${finalTranscript}"`);
        dispatch({
          type: 'USER_SPEECH_FINAL',
          sessionId,
          timestamp: new Date().toISOString(),
          payload: { transcript: finalTranscript, confidence: transcript ? 0.9 : 0 },
        });
      }).catch((err) => {
        console.error(`[VAD-V4:${sessionId}] STT Error:`, err);
        dispatch({
          type: 'ERROR',
          sessionId,
          timestamp: new Date().toISOString(),
          payload: { message: `STT failed: ${err instanceof Error ? err.message : String(err)}` },
        });
      });
    }
  }

  const bridge: VoiceBridge = {
    get isSpeechActive() {
      return speechActive;
    },

    handleAudioFrame(frame: Buffer, _timestamp: number): void {
      if (destroyed) return;

      const pcmSamples = decoder.decode(frame);
      const dbfs = computeRmsDbfs(pcmSamples);
      const now = Date.now();

      pulseCounter++;
      if (pulseCounter >= 100) {
        pulseCounter = 0;
        console.log(`[VAD-V4:${sessionId}] Pulse: ${dbfs.toFixed(1)} dBFS (Need > ${vadThresholdDbfs}, Active: ${speechActive})`);
      }

      if (dbfs > vadThresholdDbfs) {
        // LOUD FRAME
        lastSpeechTime = now;
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }

        if (!speechActive) {
          if (speechStartTime === null) {
            speechStartTime = now;
            console.log(`[VAD-V4:${sessionId}] Loudness detected. Starting timer...`);
          }

          const duration = now - speechStartTime;
          if (duration >= minSpeechDurationMs) {
            speechActive = true;
            speechStartTime = null;
            console.log(`[VAD-V4:${sessionId}] --- SPEECH ACTIVATED --- (${duration}ms accumulated)`);
            dispatch({
              type: 'USER_SPEECH_START',
              sessionId,
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (speechActive) {
          speechBuffer.push(pcmSamples);
        }
      } else {
        // QUIET FRAME
        if (!speechActive) {
          // Grace period: Only reset speechStartTime if we've been silent for > 150ms
          // (matching the minSpeechDurationMs for symmetry)
          if (speechStartTime !== null && (now - lastSpeechTime > 150)) {
            console.log(`[VAD-V4:${sessionId}] Brief noise discarded (silence lasted ${now - lastSpeechTime}ms)`);
            speechStartTime = null;
          }
        } else {
          if (!silenceTimer) {
            silenceTimer = setTimeout(onSilenceTimeout, silenceAfterSpeechMs);
          }
        }
      }
    },

    async handleSpeakText(text: string): Promise<void> {
      if (destroyed || !synthesizeSpeech) return;
      ttsAbortController = new AbortController();
      const signal = ttsAbortController.signal;
      try {
        const audioBuffer = await synthesizeSpeech(text);
        if (signal.aborted || destroyed || !audioBuffer) return;
        const pcmSamples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength / 2);
        const FRAME_SIZE = 320; 
        for (let i = 0; i < pcmSamples.length; i += FRAME_SIZE) {
          if (signal.aborted || destroyed) break;
          const chunk = pcmSamples.slice(i, i + FRAME_SIZE);
          if (chunk.length < FRAME_SIZE) break; 
          sendAudioFrame(encoder.encode(chunk));
        }
      } catch (err) {
        if (!signal.aborted) console.error(`[VAD-V4:${sessionId}] TTS Error:`, err);
      }
    },

    stopSpeaking(): void {
      if (ttsAbortController) {
        ttsAbortController.abort();
        ttsAbortController = null;
      }
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (ttsAbortController) ttsAbortController.abort();
      decoder.destroy();
      encoder.destroy();
      speechBuffer.length = 0;
    },
  };

  return bridge;
}
