// ============================================
// Server-Side WebRTC Peer
// ============================================
// Creates a server-side RTCPeerConnection using
// werift (pure TypeScript). Receives browser audio
// via inbound track and can inject TTS audio into
// the outbound track.
// ============================================

import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  type MediaStreamTrack,
  RtpPacket,
} from 'werift';

// ------------------------------------------
// Types
// ------------------------------------------

export interface ServerPeerConfig {
  sessionId: string;
  /** Called when inbound Opus/RTP audio frames arrive */
  onAudioFrame?: (frame: Buffer, timestamp: number) => void;
  /** Called when the peer connection state changes */
  onConnectionStateChange?: (state: string) => void;
  /** Called when the peer disconnects or fails */
  onDisconnected?: () => void;
}

export interface ServerPeer {
  /** The underlying RTCPeerConnection */
  readonly pc: RTCPeerConnection;
  /** Session ID this peer belongs to */
  readonly sessionId: string;
  /** Current connection state */
  getConnectionState(): string;
  /** Process a remote SDP offer and return the local SDP answer */
  handleOffer(offerSdp: string): Promise<string>;
  /** Add a remote ICE candidate */
  addIceCandidate(candidate: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  }): Promise<void>;
  /** Send an audio frame (RTP payload) to the browser */
  sendAudioFrame(payload: Buffer, timestamp: number, payloadType?: number): void;
  /** Destroy the peer connection and release resources */
  destroy(): void;
}

// ------------------------------------------
// Factory
// ------------------------------------------

/**
 * Create a server-side WebRTC peer capable of receiving
 * and sending audio via an RTCPeerConnection.
 */
export function createServerPeer(config: ServerPeerConfig): ServerPeer {
  const { sessionId, onAudioFrame, onConnectionStateChange, onDisconnected } = config;

  // Create peer connection with STUN servers for ICE
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  let destroyed = false;
  let inboundTrack: MediaStreamTrack | null = null;

  // Add a recvonly audio transceiver — we want to receive audio from browser
  // and also sendrecv so we can push TTS audio back.
  const transceiver = pc.addTransceiver('audio', {
    direction: 'sendrecv',
  });

  // ---- Connection State ----
  pc.connectionStateChange.subscribe((state) => {
    if (destroyed) return;
    onConnectionStateChange?.(state);

    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      onDisconnected?.();
    }
  });

  // ---- Inbound Audio ----
  pc.onTrack.subscribe((track) => {
    if (destroyed) return;
    if (track.kind === 'audio') {
      inboundTrack = track;

      track.onReceiveRtp.subscribe((rtp: RtpPacket) => {
        if (destroyed) return;
        onAudioFrame?.(rtp.payload, rtp.header.timestamp);
      });
    }
  });

  // ---- Public API ----
  const peer: ServerPeer = {
    pc,
    sessionId,

    getConnectionState(): string {
      return pc.connectionState;
    },

    async handleOffer(offerSdp: string): Promise<string> {
      if (destroyed) throw new Error('Peer is destroyed');

      // Munge SDP to prioritize PCMU (Payload Type 0) over Opus
      // This forces the browser to send G.711 audio which we can decode easily.
      const mungledOffer = offerSdp.replace(
        /m=audio (\d+) UDP\/TLS\/RTP\/SAVPF (.*)/,
        (match, port, fmt) => {
          const formats = fmt.split(' ');
          const pcmuIdx = formats.indexOf('0');
          if (pcmuIdx > -1) {
            formats.splice(pcmuIdx, 1);
            formats.unshift('0');
          }
          return `m=audio ${port} UDP\/TLS\/RTP\/SAVPF ${formats.join(' ')}`;
        }
      );

      await pc.setRemoteDescription(
        new RTCSessionDescription(mungledOffer, 'offer')
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      return answer.sdp;
    },

    async addIceCandidate(candidate): Promise<void> {
      if (destroyed) return;

      await pc.addIceCandidate(
        new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? undefined,
          sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
        })
      );
    },

    sendAudioFrame(payload: Buffer, timestamp: number, payloadType = 0): void {
      if (destroyed) return;

      const sender = transceiver.sender;
      if (!sender) return;

      // Create an RTP packet to send
      // Note: werift RtpHeader is a class with internal methods,
      // so we cast this object literal to satisfy the constructor.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rtp = new RtpPacket(
        {
          payloadType,
          sequenceNumber: 0,
          timestamp,
          ssrc: 0,
          marker: false,
          padding: false,
          extension: false,
          csrcLength: 0,
          csrc: [],
          extensionProfile: 0,
          extensions: [],
          paddingSize: 0,
        } as any,
        payload,
      );

      sender.sendRtp(rtp);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;

      try {
        pc.close();
      } catch {
        // Ignore close errors during teardown
      }
    },
  };

  return peer;
}
