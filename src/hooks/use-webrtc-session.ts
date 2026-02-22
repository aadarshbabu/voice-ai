"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SignalResponse } from "@/lib/engine/orchestrator/webrtc/signaling-types";

// ============================================
// useWebRTCSession — Client-Side WebRTC Hook
// ============================================
// Manages the full WebRTC lifecycle for a voice
// session: create offer, exchange SDP/ICE via
// POST /api/voice/signal, and manage media tracks.
// ============================================

export type WebRTCSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "error";

export interface UseWebRTCSessionOptions {
  sessionId: string;
  /** Called when the connection is established */
  onConnected?: () => void;
  /** Called when the connection is disconnected */
  onDisconnected?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when an inbound audio track is received (TTS playback) */
  onRemoteTrack?: (track: MediaStreamTrack) => void;
  /** STUN/TURN servers (default: Google STUN) */
  iceServers?: RTCIceServer[];
  /** Signaling endpoint (default: /api/voice/signal) */
  signalUrl?: string;
}

export interface UseWebRTCSessionReturn {
  status: WebRTCSessionStatus;
  /** Start the WebRTC connection */
  connect: () => Promise<void>;
  /** Disconnect and clean up */
  disconnect: () => void;
  /** Mute the local audio track */
  mute: () => void;
  /** Unmute the local audio track */
  unmute: () => void;
  /** Whether the local audio is muted */
  isMuted: boolean;
  /** Real-time microphone audio level (0-100) */
  audioLevel: number;
  /** Error message if any */
  error: string | null;
}

export function useWebRTCSession(
  options: UseWebRTCSessionOptions
): UseWebRTCSessionReturn {
  const {
    sessionId,
    onConnected,
    onDisconnected,
    onError,
    onRemoteTrack,
    iceServers = [{ urls: "stun:stun.l.google.com:19302" }],
    signalUrl = "/api/voice/signal",
  } = options;

  const [status, setStatus] = useState<WebRTCSessionStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCleanedUp = useRef(false);

  // ---- Helper: POST to signal endpoint ----
  const sendSignal = useCallback(
    async (body: Record<string, unknown>): Promise<SignalResponse> => {
      const res = await fetch(signalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as SignalResponse;
      if (!data.ok) {
        throw new Error(data.error ?? "Signaling failed");
      }
      return data;
    },
    [signalUrl]
  );

  // ---- Cleanup ----
  const cleanup = useCallback(() => {
    isCleanedUp.current = true;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      // Best-effort bye signal
      void fetch(signalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bye", sessionId }),
        keepalive: true,
      }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Connect ----
  const connect = useCallback(async () => {
    try {
      isCleanedUp.current = false;
      setError(null);
      setStatus("connecting");

      // 1. Get user media (audio only)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Opus native rate
        },
      });
      streamRef.current = stream;

      // 2. Create peer connection
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // Add local audio track
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // ---- Setup Audio Monitoring ----
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (isCleanedUp.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize to 0-100 (approximately)
        const level = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(level);
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // 3. Handle remote tracks (TTS audio from server)
      pc.ontrack = (event) => {
        if (isCleanedUp.current) return;
        const remoteTrack = event.track;
        if (remoteTrack.kind === "audio") {
          onRemoteTrack?.(remoteTrack);
        }
      };

      // 4. Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (isCleanedUp.current || !event.candidate) return;
        try {
          await sendSignal({
            type: "ice-candidate",
            sessionId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        } catch (e) {
          console.warn("[WebRTC] ICE candidate send failed:", e);
        }
      };

      // 5. Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (isCleanedUp.current) return;
        const state = pc.connectionState;

        switch (state) {
          case "connected":
            setStatus("connected");
            onConnected?.();
            break;
          case "disconnected":
            setStatus("disconnected");
            onDisconnected?.();
            break;
          case "failed":
            setStatus("failed");
            onError?.(new Error("WebRTC connection failed"));
            break;
          case "closed":
            setStatus("disconnected");
            break;
        }
      };

      // 6. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Send offer to signaling server
      const response = await sendSignal({
        type: "offer",
        sessionId,
        sdp: offer.sdp,
      });

      // 8. Set remote description (server's answer)
      if (response.sdp) {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: response.sdp })
        );
      }
    } catch (e) {
      const err =
        e instanceof Error ? e : new Error("WebRTC connection failed");

      if (err.name === "NotAllowedError") {
        setError("Microphone permission denied.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found.");
      } else {
        setError(err.message);
      }

      setStatus("error");
      onError?.(err);
      cleanup();
    }
  }, [
    sessionId,
    iceServers,
    sendSignal,
    onConnected,
    onDisconnected,
    onError,
    onRemoteTrack,
    cleanup,
  ]);

  // ---- Disconnect ----
  const disconnect = useCallback(() => {
    // Send bye signal
    void sendSignal({ type: "bye", sessionId }).catch(() => {});
    cleanup();
    setStatus("disconnected");
  }, [sendSignal, sessionId, cleanup]);

  // ---- Mute/Unmute ----
  const mute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      setIsMuted(false);
    }
  }, []);

  return {
    status,
    connect,
    disconnect,
    mute,
    unmute,
    isMuted,
    audioLevel,
    error,
  };
}
