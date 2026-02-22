import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { createWebRTCBridge, type WebRTCBridgeConfig } from './bridge-voice';

describe('WebRTCBridge', () => {
  let dispatchEvent: Mock;
  let transcribePcm: Mock;
  let synthesizeSpeech: Mock;
  let config: WebRTCBridgeConfig;

  beforeEach(() => {
    vi.useFakeTimers();

    dispatchEvent = vi.fn().mockResolvedValue(undefined);
    transcribePcm = vi.fn().mockResolvedValue('hello world');
    synthesizeSpeech = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]));

    config = {
      sessionId: 'test-session',
      dispatchEvent,
      transcribePcm,
      synthesizeSpeech,
      sendAudioFrame: vi.fn(),
      vadThresholdDbfs: -40,
      minSpeechDurationMs: 200,
      silenceAfterSpeechMs: 500,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to create a PCM buffer with a given amplitude.
   * Higher amplitude = louder = above VAD threshold.
   */
  function makePcmFrame(amplitude: number, sampleCount = 160): Buffer {
    const pcm = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      // Alternate positive/negative to simulate a tone
      pcm[i] = i % 2 === 0 ? amplitude : -amplitude;
    }
    return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  }

  /** Loud frame (above -40 dBFS threshold) */
  const loudFrame = () => makePcmFrame(5000);
  /** Silent frame (below threshold) */
  const silentFrame = () => makePcmFrame(10);

  it('starts in non-speech state', () => {
    const bridge = createWebRTCBridge(config);
    expect(bridge.isSpeechActive).toBe(false);
    bridge.destroy();
  });

  it('dispatches USER_SPEECH_START after sustained loud audio', () => {
    const bridge = createWebRTCBridge(config);

    // Send loud frames for > 200ms (minSpeechDurationMs)
    bridge.handleAudioFrame(loudFrame(), 0);
    vi.advanceTimersByTime(100);
    bridge.handleAudioFrame(loudFrame(), 100);
    vi.advanceTimersByTime(150);
    bridge.handleAudioFrame(loudFrame(), 250);

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'USER_SPEECH_START' })
    );
    expect(bridge.isSpeechActive).toBe(true);

    bridge.destroy();
  });

  it('does NOT dispatch USER_SPEECH_START for brief noise', () => {
    const bridge = createWebRTCBridge(config);

    // One loud frame then silence — too short
    bridge.handleAudioFrame(loudFrame(), 0);
    vi.advanceTimersByTime(50);
    bridge.handleAudioFrame(silentFrame(), 50);

    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'USER_SPEECH_START' })
    );
    expect(bridge.isSpeechActive).toBe(false);

    bridge.destroy();
  });

  it('dispatches USER_SPEECH_FINAL after silence following speech', async () => {
    const bridge = createWebRTCBridge(config);

    // Trigger speech start
    bridge.handleAudioFrame(loudFrame(), 0);
    vi.advanceTimersByTime(250);
    bridge.handleAudioFrame(loudFrame(), 250);

    // Now silence
    vi.advanceTimersByTime(100);
    bridge.handleAudioFrame(silentFrame(), 350);

    // Advance past silence timeout (500ms)
    vi.advanceTimersByTime(600);

    // Wait for async STT
    await vi.runAllTimersAsync();

    expect(transcribePcm).toHaveBeenCalledOnce();

    bridge.destroy();
  });

  it('does not dispatch events after destroy', () => {
    const bridge = createWebRTCBridge(config);
    bridge.destroy();

    bridge.handleAudioFrame(loudFrame(), 0);
    vi.advanceTimersByTime(300);
    bridge.handleAudioFrame(loudFrame(), 300);

    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('handleSpeakText calls synthesizeSpeech', async () => {
    const bridge = createWebRTCBridge(config);
    await bridge.handleSpeakText('Hello world', 'node-1');
    expect(synthesizeSpeech).toHaveBeenCalledWith('Hello world');
    bridge.destroy();
  });

  it('stopSpeaking aborts in-flight TTS', async () => {
    // Setup synthesize to hang for a while
    const mockSynthesize = vi.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve(Buffer.from([1])), 5000))
    );
    config.synthesizeSpeech = mockSynthesize;

    const bridge = createWebRTCBridge(config);

    // Start speaking
    const speakPromise = bridge.handleSpeakText('Long text');

    // Immediately stop
    bridge.stopSpeaking();

    vi.advanceTimersByTime(5100);
    await speakPromise;

    bridge.destroy();
  });

  it('silent frames do not trigger speech', () => {
    const bridge = createWebRTCBridge(config);

    // Send many silent frames
    for (let i = 0; i < 50; i++) {
      bridge.handleAudioFrame(silentFrame(), i * 20);
      vi.advanceTimersByTime(20);
    }

    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(bridge.isSpeechActive).toBe(false);

    bridge.destroy();
  });

  it('destroy cleans up timers and decoder', () => {
    const bridge = createWebRTCBridge(config);

    // Start speech
    bridge.handleAudioFrame(loudFrame(), 0);
    vi.advanceTimersByTime(250);
    bridge.handleAudioFrame(loudFrame(), 250);

    // Then silence (starts a timer)
    vi.advanceTimersByTime(100);
    bridge.handleAudioFrame(silentFrame(), 350);

    // Destroy before timer fires
    bridge.destroy();

    // Timer should not fire
    vi.advanceTimersByTime(1000);
    // transcribePcm should not be called
    expect(transcribePcm).not.toHaveBeenCalled();
  });
});
