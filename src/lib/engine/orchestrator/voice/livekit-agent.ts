import { Room, RoomEvent, RemoteTrack, RemoteParticipant, Track, LocalAudioTrack } from "livekit-client";
import { EngineOrchestrator } from "../engine-orchestrator";
import { createVoiceBridge, type VoiceBridge } from "./bridge-voice";
import { prisma } from "@/lib/prisma";
import { speechToText, textToSpeech } from "@/lib/engine/providers/voice";
import type { VoiceEvent } from "../events";

/**
 * LiveKit AI Agent Participant
 * 
 * This class connects to a LiveKit room as a participant,
 * listens to the user's audio, and responds using the EngineOrchestrator.
 * 
 * NOTE: This is intended to run in a persistent Node.js environment.
 */
export class LiveKitAgent {
  private room: Room;
  private orchestrator: EngineOrchestrator | null = null;
  private bridge: VoiceBridge | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;

  constructor() {
    this.room = new Room();
  }

  async join(wsUrl: string, token: string, sessionId: string, workflowId: string) {
    console.log(`[LiveKitAgent] Joining room for session: ${sessionId}`);

    // 1. Setup Orchestrator
    this.orchestrator = new EngineOrchestrator({
      sessionId,
      workflowId,
      prisma,
      handlers: {
        onStartASR: async () => {},
        onStopASR: async () => {},
        onStopTTS: async () => {
          this.bridge?.stopSpeaking();
        },
        onEmitSpeakingText: async (text) => {
          await this.bridge?.handleSpeakText(text);
        },
        onEmitAudio: async () => {},
        onLogEvent: async (msg, level) => {
          console.log(`[Agent:${sessionId}] ${level}: ${msg}`);
        },
      },
    });

    // 2. Setup Bridge
    this.bridge = createVoiceBridge({
      sessionId,
      dispatchEvent: (event: VoiceEvent) => this.orchestrator!.dispatch(event),
      transcribePcm: async (pcm: string, mime: string) => {
        const result = await speechToText(pcm, mime, "agent-user");
        return result.success ? (result.transcript || null) : null;
      },
      synthesizeSpeech: async (text: string) => {
        const result = await textToSpeech(text, "agent-user");
        if (result.success && result.audioBase64) {
          return Buffer.from(result.audioBase64, 'base64');
        }
        return null;
      },
      sendAudioFrame: (frame: Buffer) => {
        if (this.localAudioTrack) {
          // Send audio frame through LiveKit
          // Note: This requires the localAudioTrack to be in a mode that accepts raw frames.
          // In standard LiveKit client, this is usually done via a custom source.
        }
      },
    });

    // 3. Room Events
    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        console.log(`[LiveKitAgent] Subscribed to audio track from participant`);
        // In a real Node.js environment, we would use a WebRTC polyfill 
        // to get the audio frames here and feed them to this.bridge.handleAudioFrame
      }
    });

    // 4. Connect
    await this.room.connect(wsUrl, token);
    
    // 5. Start Session
    await this.orchestrator.dispatch({
      type: 'SESSION_START',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { workflowId },
    });
  }

  async leave() {
    this.bridge?.destroy();
    this.orchestrator?.destroy();
    await this.room.disconnect();
  }
}
