"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalAudioTrack,
  Track,
} from "livekit-client";

export type LiveKitSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface UseLiveKitSessionOptions {
  sessionId: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export function useLiveKitSession(options: UseLiveKitSessionOptions) {
  const { sessionId, onConnected, onDisconnected, onError } = options;

  const [status, setStatus] = useState<LiveKitSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ---- Cleanup ----
  const cleanup = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  // ---- Audio Monitoring ----
  const startAudioMonitoring = useCallback((localTrack: LocalAudioTrack) => {
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    
    // Create a source from the MediaStreamTrack
    const source = audioCtx.createMediaStreamSource(new MediaStream([localTrack.mediaStreamTrack]));
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const level = Math.min(100, Math.round((average / 128) * 100));
      setAudioLevel(level);
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }, []);

  // ---- Connect ----
  const connect = useCallback(async () => {
    try {
      setError(null);
      setStatus("connecting");

      // 1. Fetch token from server
      const response = await fetch(`/api/voice/token?sessionId=${sessionId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch LiveKit token");
      }

      const { token, url } = data;

      // 2. Initialize Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // ---- Room Events ----
      room
        .on(RoomEvent.Connected, () => {
          setStatus("connected");
          onConnected?.();
        })
        .on(RoomEvent.Disconnected, () => {
          setStatus("disconnected");
          onDisconnected?.();
        })
        .on(RoomEvent.Reconnecting, () => {
          setStatus("reconnecting");
        })
        .on(RoomEvent.Reconnected, () => {
          setStatus("connected");
        })
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            // LiveKit automatically attaches the audio elements to the DOM if we use room.on(RoomEvent.TrackSubscribed)
            // or we can manually attach them to an <audio> element.
            // By default, it plays through the default output.
            track.attach();
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
        });

      // 3. Connect to room
      await room.connect(url, token);

      // 4. Publish local audio
      const localAudioTrack = await room.localParticipant.setMicrophoneEnabled(true);
      if (localAudioTrack) {
        setIsMuted(false);
        // Cast to LocalAudioTrack to access mediaStreamTrack for monitoring
        if (localAudioTrack instanceof LocalAudioTrack) {
          startAudioMonitoring(localAudioTrack);
        }
      }

    } catch (e) {
      console.error("[LiveKit] Connection error:", e);
      const err = e instanceof Error ? e : new Error("Failed to connect to LiveKit");
      setError(err.message);
      setStatus("error");
      onError?.(err);
      void cleanup();
    }
  }, [sessionId, onConnected, onDisconnected, onError, cleanup, startAudioMonitoring]);

  const disconnect = useCallback(() => {
    void cleanup();
    setStatus("disconnected");
  }, [cleanup]);

  const mute = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(true);
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
