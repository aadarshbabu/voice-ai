# Story 11.2: SIP/RTP Media Gateway

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a phone user,
I want to interact with the voice agent via a standard phone call,
so that the platform supports traditional telephony.

## Acceptance Criteria

1. **SIP Trunk Integration**: Implementation of a WebSocket-based media gateway that accepts real-time audio streams from telephony providers (Twilio, Telnyx).
2. **PCMU Transcoding**: A transcoding layer that converts 8kHz G.711 Mu-law (PCMU) audio from the telephone to 16kHz mono PCM for the ASR engine, and back again for TTS output.
3. **RTP-over-WS Handling**: Logic to parse telephony stream envelopes (e.g., Twilio's "media" events) and extract raw audio payloads.
4. **Integration with EngineOrchestrator**: The telephony session bridges into the `EngineOrchestrator` — incoming audio triggers VAD and speech events; outbound TTS audio is streamed back to the telephony call.
5. **Session Mapping**: Mapping telephony Call SIDs to workflow session IDs to maintain conversation state across the telephony bridge.

## Tasks / Subtasks

- [ ] Task 1: Implement Telephony Media API (`/api/voice/telephony/stream`) (AC: #1)
  - [ ] 1.1: Create a WebSocket endpoint (or a route compatible with telephony hooks) for incoming streams.
  - [ ] 1.2: Implement logic to handle provider-specific handshake (e.g., Twilio "start" event with call metadata).
  - [ ] 1.3: Implement parsing for "media" events to extract base64 PCMU audio.

- [ ] Task 2: Implement Telephony Transcoder (`telephony-transcoder.ts`) (AC: #2)
  - [ ] 2.1: Implement PCMU (mu-law) to PCM-16 (linear) decoding.
  - [ ] 2.2: Implement resampling from 8kHz (telephony standard) to 16kHz (ASR standard).
  - [ ] 2.3: Implement PCM-16 to PCMU 8kHz encoding for the return path.

- [ ] Task 3: Implement Telephony Bridge (`telephony-bridge.ts`) (AC: #4)
  - [ ] 3.1: Create a `TelephonyBridge` class similar to `WebRTCBridge`.
  - [ ] 3.2: Wire inbound PCMU → Transcode → VAD → `orchestrator.dispatch()`.
  - [ ] 3.3: Wire `EMIT_SPEAKING_TEXT` effect → TTS → Transcode → Send over WS.

- [ ] Task 4: Telephony Session Manager (AC: #5)
  - [ ] 4.1: Extend `WebRTCSessionManager` or create a shared `MediaSessionManager`.
  - [ ] 4.2: Support lookup by `CallSid` or other telephony identifiers.

- [ ] Task 5: Integration Tests (AC: #)
  - [ ] 5.1: Create test suite for PCMU transcoding.
  - [ ] 5.2: Mock telephony WebSocket stream to verify orchestrator event dispatch.

## Dev Notes

### Architecture Context
This follows the **Superimposed Evolution** pattern. The telephony gateway is just another "Media Host" for the `EngineOrchestrator`. 

**Critical Difference from WebRTC:**
- **Sample Rate**: Telephony is strictly **8000Hz**. The WebRTC bridge used 48kHz/16kHz. DON'T reuse the WebRTC resampler without adjusting the source rate.
- **Codec**: Telephony uses **G.711 PCMU**. You will need a mu-law table or a small helper function (see `g711.js` logic).
- **Transport**: This is a direct WebSocket stream, not an RTCPeerConnection. No SDP/ICE is required.

### Project Structure Notes
- New files should be in `src/lib/engine/orchestrator/telephony/`.
- The entry point for Twilio/Telnyx should be `src/app/api/voice/telephony/route.ts` (for TwiML/webhooks) and a raw WebSocket handler for the stream.

### References
- [Source: epics.md#Story 11.2]
- [Source: architecture.md#Real-Time Voice Evolution]
- [Reference: Twilio Media Streams API Documentation]

## Dev Agent Record

### Agent Model Used
Claude 3.5 Sonnet

### Completion Notes List
- Defined transcoding requirements for 8kHz PCMU.
- Established the Media Gateway pattern using WebSockets.
- Aligned session mapping with Call SIDs.

### File List
- `src/lib/engine/orchestrator/telephony/telephony-transcoder.ts`
- `src/lib/engine/orchestrator/telephony/telephony-bridge.ts`
- `src/app/api/voice/telephony/route.ts`
- `src/lib/engine/orchestrator/telephony/telephony.test.ts`
