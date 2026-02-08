# Story 8.1: Voice Capture & Gateway Entry

Status: review

## Story

As a user,
I want to click a mic button and speak my intent,
so that I can start a workflow without typing.

## Acceptance Criteria

1. **Audio Recording**: Clicking the "Mic" button initializes the `MediaRecorder` and captures user speech chunks.
2. **Gateway Submission**: On recording stop, the audio blob is sent via `POST` to `/api/voice/command`.
3. **UI Feedback**: The UI visually indicates 'Listening', 'Recording', and 'Processing' states.
4. **Chat Compatibility**: The new voice functionality must coexist with the existing chat-based workflow interface without causing regressions or breaking layout. (CRITICAL)
5. **STT Integration**: The backend endpoint correctly receives the stream and uses the configured STT provider (Deepgram or Google AI) to produce a transcript.

## Tasks / Subtasks

- [x] Implement `MediaRecorder` hook/component (AC: 1, 3)
  - [x] Create `use-voice-recorder.ts` to handle browser audio stream
  - [x] Add visual intensity feedback for voice activity
- [x] Create Voice Gateway API Route (AC: 2, 5)
  - [x] Implement `src/app/api/voice/command/route.ts`
  - [x] Integrate with `VoiceProviderService` to fetch default STT provider
  - [x] Implement STT transcription logic using the secret key from the Vault
- [x] Update UI with Mic Entry Point (AC: 3, 4)
  - [x] Add Mic button to Dashboard or Sidebar
  - [x] Ensure layout is responsive and does not shift existing chat buttons
- [x] Implement Error Handling (AC: 3)
  - [x] Handle "Microphone permission denied" gracefully
  - [x] Show toast notification if STT fails or network is unstable

## Dev Notes

### Architecture Patterns
- **Provider Pattern**: Use the `VoiceProviderService` and its adapters to perform STT. 
- **Stateless Gateway**: The `/api/voice/command` should be a clean entry point that converts audio to text before passing it to the `IntentResolver` (Story 8.2).
- **Streaming chunks**: While initially a post-stop upload is acceptable, aim for architecture that supports streaming if the STT provider allows it.

### Source Components
- `src/components/voice/mic-overlay.tsx`: For global voice control.
- `src/app/api/voice/command/route.ts`: API entry point.
- `src/lib/engine/providers/adapters/`: Source for STT implementations.

### Compatibility Analysis (CRITICAL)
- **Chat Interface**: The current chat interface uses SSE for engine traces. The voice gateway will eventually trigger these same SSE-enabled sessions. We must ensure that a session started by voice still renders correctly in the `ExecutionTrace` viewer.

## References
- [Architecture: Voice Gateway Model](/_bmad-output/planning-artifacts/architecture.md#voice--workflow-integration-architecture-update)
- [Epic 8: Voice Gateway & Intent Parsing](/_bmad-output/planning-artifacts/epics.md#epic-8-voice-gateway--intent-parsing)

## Dev Agent Record

### Agent Model Used
Gemini 2.5 Pro

### Debug Log References
- Dev server verified running on localhost:3000
- Voice Gateway API responding correctly (405 on GET as expected)

### Completion Notes List
- ✅ Created `use-voice-recorder.ts` hook with MediaRecorder API, audio level analysis (RMS), max duration timeout, and cleanup
- ✅ Created `/api/voice/command` API route with Deepgram and Google STT support
- ✅ Integrated Mic button into LiveSimulator with visual audio level indicator
- ✅ Added toast notifications for voice errors and transcription results
- ✅ Error handling for microphone permission denial, STT failures, and network issues
- ✅ Chat input coexists with voice button without layout regression

### File List
- `src/hooks/use-voice-recorder.ts` (NEW)
- `src/app/api/voice/command/route.ts` (NEW)
- `src/app/editor/_components/live-simulator.tsx` (MODIFIED)
