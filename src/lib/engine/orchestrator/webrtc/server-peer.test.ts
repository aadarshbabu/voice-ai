import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createServerPeer, type ServerPeerConfig } from './server-peer';

// ============================================
// Mock werift module
// ============================================

// Track registered callbacks for simulating events
const mockState = {
  onTrackCallback: null as ((track: any) => void) | null,
  connectionStateCallback: null as ((state: string) => void) | null,
  senderSendRtp: vi.fn(),
  pcClose: vi.fn(),
  pcSetRemoteDescription: vi.fn().mockResolvedValue(undefined),
  pcCreateAnswer: vi.fn().mockResolvedValue({ sdp: 'mock-answer-sdp', type: 'answer' }),
  pcSetLocalDescription: vi.fn().mockResolvedValue(undefined),
  pcAddIceCandidate: vi.fn().mockResolvedValue(undefined),
};

vi.mock('werift', () => {
  const mockTransceiver = {
    get sender() {
      return {
        sendRtp: (...args: any[]) => mockState.senderSendRtp(...args),
      };
    }
  };

  return {
    RTCPeerConnection: vi.fn().mockImplementation(() => ({
      connectionState: 'new',
      connectionStateChange: {
        subscribe: (cb: (state: string) => void) => {
          mockState.connectionStateCallback = cb;
        },
      },
      onTrack: {
        subscribe: (cb: (track: any) => void) => {
          mockState.onTrackCallback = cb;
        },
      },
      addTransceiver: vi.fn().mockReturnValue(mockTransceiver),
      setRemoteDescription: (...args: any[]) => mockState.pcSetRemoteDescription(...args),
      createAnswer: (...args: any[]) => mockState.pcCreateAnswer(...args),
      setLocalDescription: (...args: any[]) => mockState.pcSetLocalDescription(...args),
      addIceCandidate: (...args: any[]) => mockState.pcAddIceCandidate(...args),
      close: (...args: any[]) => mockState.pcClose(...args),
    })),
    RTCSessionDescription: vi.fn().mockImplementation((sdp: string, type: string) => ({ sdp, type })),
    RTCIceCandidate: vi.fn().mockImplementation((c: any) => c),
    RtpPacket: vi.fn().mockImplementation((header: any, payload: any) => ({ header, payload })),
  };
});

describe('ServerPeer', () => {
  let config: ServerPeerConfig;
  let onAudioFrame: Mock;
  let onConnectionStateChange: Mock;
  let onDisconnected: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.onTrackCallback = null;
    mockState.connectionStateCallback = null;

    onAudioFrame = vi.fn();
    onConnectionStateChange = vi.fn();
    onDisconnected = vi.fn();

    config = {
      sessionId: 'test-session',
      onAudioFrame,
      onConnectionStateChange,
      onDisconnected,
    };
  });

  it('creates a peer with the correct sessionId', () => {
    const peer = createServerPeer(config);
    expect(peer.sessionId).toBe('test-session');
  });

  it('handleOffer returns an SDP answer', async () => {
    const peer = createServerPeer(config);
    const answer = await peer.handleOffer('mock-offer-sdp');
    expect(answer).toBe('mock-answer-sdp');
    expect(mockState.pcSetRemoteDescription).toHaveBeenCalledOnce();
    expect(mockState.pcCreateAnswer).toHaveBeenCalledOnce();
    expect(mockState.pcSetLocalDescription).toHaveBeenCalledOnce();
  });

  it('addIceCandidate adds a candidate to the peer connection', async () => {
    const peer = createServerPeer(config);
    await peer.addIceCandidate({
      candidate: 'candidate:1 1 UDP 2013266431 10.0.0.1 12345 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(mockState.pcAddIceCandidate).toHaveBeenCalledOnce();
  });

  it('emits audio frames from inbound track', () => {
    createServerPeer(config);

    // Simulate a track being received
    let onReceiveRtpCallback: ((rtp: any) => void) | null = null;
    const mockTrack = {
      kind: 'audio',
      onReceiveRtp: {
        subscribe: (cb: (rtp: any) => void) => {
          onReceiveRtpCallback = cb;
        },
      },
    };

    mockState.onTrackCallback?.(mockTrack);

    // Simulate an RTP packet
    const fakeRtp = {
      payload: Buffer.from([1, 2, 3, 4]),
      header: { timestamp: 48000 },
    };
    if (onReceiveRtpCallback) {
        (onReceiveRtpCallback as any)(fakeRtp);
    }

    expect(onAudioFrame).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), 48000);
  });

  it('sendAudioFrame injects audio into outbound track', () => {
    const peer = createServerPeer(config);
    const payload = Buffer.from([10, 20, 30]);
    peer.sendAudioFrame(payload, 96000);
    expect(mockState.senderSendRtp).toHaveBeenCalledOnce();
  });

  it('fires onConnectionStateChange when state changes', () => {
    createServerPeer(config);
    mockState.connectionStateCallback?.('connected');
    expect(onConnectionStateChange).toHaveBeenCalledWith('connected');
  });

  it('fires onDisconnected when connection fails', () => {
    createServerPeer(config);
    mockState.connectionStateCallback?.('failed');
    expect(onDisconnected).toHaveBeenCalledOnce();
  });

  it('fires onDisconnected when connection is disconnected', () => {
    createServerPeer(config);
    mockState.connectionStateCallback?.('disconnected');
    expect(onDisconnected).toHaveBeenCalledOnce();
  });

  it('destroy closes the peer connection', () => {
    const peer = createServerPeer(config);
    peer.destroy();
    expect(mockState.pcClose).toHaveBeenCalledOnce();
  });

  it('handleOffer throws if peer is destroyed', async () => {
    const peer = createServerPeer(config);
    peer.destroy();
    await expect(peer.handleOffer('sdp')).rejects.toThrow('Peer is destroyed');
  });

  it('sendAudioFrame is a no-op after destroy', () => {
    const peer = createServerPeer(config);
    peer.destroy();
    peer.sendAudioFrame(Buffer.from([1]), 1000);
    // sendRtp should NOT be called after destroy
    expect(mockState.senderSendRtp).not.toHaveBeenCalled();
  });
});
