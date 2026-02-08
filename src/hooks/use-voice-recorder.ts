"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceRecorderStatus = "idle" | "requesting" | "recording" | "processing" | "error";

interface UseVoiceRecorderOptions {
  onRecordingComplete?: (audioBlob: Blob) => void | Promise<void>;
  onError?: (error: Error) => void;
  maxDurationMs?: number;  // Maximum recording duration (default: 30s)
}

interface UseVoiceRecorderReturn {
  status: VoiceRecorderStatus;
  isRecording: boolean;
  audioLevel: number;        // 0-100 for visualizer
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const {
    onRecordingComplete,
    onError,
    maxDurationMs = 30000,
  } = options;

  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Audio level analyzer loop
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS (root mean square) for smoother level indication
    const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sum / dataArray.length);
    const normalizedLevel = Math.min(100, Math.round((rms / 128) * 100));

    setAudioLevel(normalizedLevel);

    if (status === "recording") {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [status]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setStatus("requesting");

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Good for STT
        },
      });

      streamRef.current = stream;

      // Setup audio analyzer for visual feedback
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setStatus("processing");
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          await onRecordingComplete?.(audioBlob);
        } catch (e) {
          const err = e instanceof Error ? e : new Error("Failed to process audio");
          setError(err.message);
          onError?.(err);
        } finally {
          cleanup();
          setStatus("idle");
          setAudioLevel(0);
        }
      };

      mediaRecorder.onerror = () => {
        const err = new Error("Recording failed");
        setError(err.message);
        setStatus("error");
        onError?.(err);
        cleanup();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setStatus("recording");

      // Start audio level monitoring
      updateAudioLevel();

      // Set max duration timeout
      maxDurationTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, maxDurationMs);

    } catch (e) {
      const err = e instanceof Error ? e : new Error("Microphone access denied");
      
      // Handle specific permission errors
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow microphone access.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError(err.message);
      }
      
      setStatus("error");
      onError?.(err);
      cleanup();
    }
  }, [cleanup, maxDurationMs, onError, onRecordingComplete, updateAudioLevel]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    status,
    isRecording: status === "recording",
    audioLevel,
    startRecording,
    stopRecording,
    error,
  };
}
