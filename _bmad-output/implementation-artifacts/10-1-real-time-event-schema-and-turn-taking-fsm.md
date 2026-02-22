# Story 10.1: Real-Time Event Schema & Turn-Taking FSM

Status: review

## Story

As a developer,
I want a pure, deterministic state machine (FSM) and a standardized real-time event schema,
so that the platform can manage voice UX states (Listening, Speaking, Thinking, Interrupted) without modifying the existing workflow engine.

## Acceptance Criteria

1. **Event Schema Defined**: A Zod-validated `VoiceEvent` union type is created covering all real-time signals: `USER_SPEECH_START`, `USER_SPEECH_END`, `USER_SPEECH_FINAL`, `AGENT_TTS_START`, `AGENT_TTS_END`, `AGENT_THINKING_START`, `AGENT_THINKING_END`, `SILENCE_TIMEOUT`, `ENGINE_RESULT`, `SESSION_START`, `SESSION_END`, `ERROR`.
2. **FSM States Defined**: The FSM has exactly 5 states: `IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `INTERRUPTED`.
3. **Pure Reducer**: The FSM is implemented as a pure function `turnReducer(state, event) => { newState, effects[] }` with zero I/O, zero async, and zero timers.
4. **Effects System**: The reducer emits an array of typed `Effect` commands (e.g., `STOP_TTS`, `START_ASR`, `CALL_ENGINE`, `EMIT_AUDIO`) instead of performing any side effects directly.
5. **Barge-in Logic**: When in `SPEAKING` state and `USER_SPEECH_START` is received, the FSM immediately transitions to `INTERRUPTED` and emits a `STOP_TTS` effect, then transitions to `LISTENING`.
6. **No Engine Modification**: The existing `src/lib/engine/runner.ts`, `src/lib/engine/advance.ts`, and `src/lib/engine/types.ts` files are NOT modified.
7. **Unit Tested**: At minimum 15 unit tests covering all state transitions, including edge cases (double events, out-of-order events, unknown events).

## Tasks / Subtasks

- [x] Task 1: Define the Real-Time Event Schema (AC: #1)
  - [x] 1.1: Create `src/lib/engine/orchestrator/events.ts` with Zod schemas for all `VoiceEvent` types
  - [x] 1.2: Define timestamp, sessionId, and optional payload fields for each event
  - [x] 1.3: Export a discriminated union type `VoiceEvent` and individual event types
- [x] Task 2: Define the FSM States & Effect Types (AC: #2, #4)
  - [x] 2.1: Create `src/lib/engine/orchestrator/types.ts` with `TurnState` enum (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `INTERRUPTED`)
  - [x] 2.2: Define `TurnContext` interface containing `state`, `sessionId`, `currentNodeId`, `ttsBufferActive`, `asrActive`, `lastTranscript`
  - [x] 2.3: Define `Effect` discriminated union type: `STOP_TTS`, `START_ASR`, `STOP_ASR`, `CALL_ENGINE`, `EMIT_AUDIO`, `LOG_EVENT`, `EMIT_SPEAKING_TEXT`
  - [x] 2.4: Define `TurnResult = { context: TurnContext; effects: Effect[] }`
- [x] Task 3: Implement the Pure Turn-Taking Reducer (AC: #3, #5)
  - [x] 3.1: Create `src/lib/engine/orchestrator/turn-machine.ts`
  - [x] 3.2: Implement `turnReducer(context: TurnContext, event: VoiceEvent): TurnResult`
  - [x] 3.3: IDLE + SESSION_START → LISTENING (effects: START_ASR)
  - [x] 3.4: LISTENING + USER_SPEECH_FINAL → THINKING (effects: STOP_ASR, CALL_ENGINE)
  - [x] 3.5: THINKING + ENGINE_RESULT → SPEAKING (effects: EMIT_SPEAKING_TEXT)
  - [x] 3.6: SPEAKING + AGENT_TTS_END → LISTENING (effects: START_ASR)
  - [x] 3.7: SPEAKING + USER_SPEECH_START → INTERRUPTED (effects: STOP_TTS) → LISTENING (effects: START_ASR)
  - [x] 3.8: Any + SESSION_END → IDLE (effects: STOP_TTS, STOP_ASR)
  - [x] 3.9: Any + ERROR → IDLE (effects: STOP_TTS, STOP_ASR, LOG_EVENT)
  - [x] 3.10: Handle all "no-op" transitions (ignore events that don't apply to current state)
- [x] Task 4: Create the index barrel file (AC: #6)
  - [x] 4.1: Create `src/lib/engine/orchestrator/index.ts` exporting all types, events, and the reducer
- [x] Task 5: Write comprehensive unit tests (AC: #7)
  - [x] 5.1: Create `src/lib/engine/orchestrator/turn-machine.test.ts`
  - [x] 5.2: Test: IDLE → SESSION_START → LISTENING
  - [x] 5.3: Test: LISTENING → USER_SPEECH_FINAL → THINKING
  - [x] 5.4: Test: THINKING → ENGINE_RESULT → SPEAKING
  - [x] 5.5: Test: SPEAKING → AGENT_TTS_END → LISTENING (normal turn cycle)
  - [x] 5.6: Test: SPEAKING → USER_SPEECH_START → INTERRUPTED → LISTENING (barge-in)
  - [x] 5.7: Test: Any → SESSION_END → IDLE with cleanup effects
  - [x] 5.8: Test: Any → ERROR → IDLE with cleanup effects
  - [x] 5.9: Test: IDLE ignores USER_SPEECH_START (no active session)
  - [x] 5.10: Test: LISTENING ignores AGENT_TTS_END (no TTS active)
  - [x] 5.11: Test: Double USER_SPEECH_START while already LISTENING is ignored (idempotent)
  - [x] 5.12: Test: THINKING ignores USER_SPEECH_START (wait for engine before accepting input)
  - [x] 5.13: Test: INTERRUPTED emits both STOP_TTS and START_ASR effects in correct order
  - [x] 5.14: Test: ENGINE_RESULT carries `text` payload that is available in SPEAKING context
  - [x] 5.15: Test: Full conversation cycle: SESSION_START → speech → engine → speak → speech → end
  - [x] 5.16: Test: reducer is pure (same input → same output, no mutation of input)

## Dev Notes

### Critical Architecture Constraint: ZERO Engine Modification

This story introduces the **Superimposed Reactive Layer** documented in `architecture.md § Real-Time Voice Evolution`. The existing engine (`runner.ts`, `advance.ts`, `types.ts`) is the **Logic Core** (the "Brain"). This story builds the **Nervous System** — a separate, parallel state machine that will eventually "consult" the Brain but does NOT modify it.

**DO NOT:**
- Import from `src/lib/engine/runner.ts` or `src/lib/engine/advance.ts`
- Modify any existing types in `src/lib/engine/types.ts`
- Add any audio/ASR/TTS logic to the reducer

**DO:**
- Create all new files under `src/lib/engine/orchestrator/` (new directory)
- Use Zod for all schema definitions (consistent with existing `types.ts` patterns)
- Keep the reducer 100% synchronous — no Promises, no async, no setTimeout

### How This Fits Into the Existing System

```
EXISTING (untouched):
  src/lib/engine/
  ├── advance.ts          ← Pure sync state machine (text simulator)
  ├── runner.ts           ← Async workflow runner (Inngest uses this)
  ├── types.ts            ← ExecutionContext, AdvanceResult, node schemas
  ├── session-emitter.ts  ← EventEmitter for SSE push
  ├── http-client.ts      ← Tool node HTTP execution
  ├── gateway/            ← Intent resolution
  └── providers/          ← LLM, TTS, STT adapters

NEW (this story):
  src/lib/engine/orchestrator/      ← NEW directory
  ├── events.ts                     ← VoiceEvent union type
  ├── types.ts                      ← TurnState, TurnContext, Effect
  ├── turn-machine.ts               ← Pure reducer
  ├── turn-machine.test.ts          ← Unit tests
  └── index.ts                      ← Barrel exports
```

### Naming & Code Conventions (from architecture.md)

- File naming: `kebab-case.ts` (e.g., `turn-machine.ts`)
- Type naming: `PascalCase` (e.g., `TurnContext`, `VoiceEvent`)
- Enum values: `SCREAMING_SNAKE_CASE` (e.g., `USER_SPEECH_START`)
- Zod schemas: Suffix with `Schema` (e.g., `VoiceEventSchema`)
- Exports: Named exports, no default exports

### Testing Framework

- Use the existing test setup (Vitest, co-located `*.test.ts`)
- Tests must be purely in-memory — no DB, no network, no mocking of external services
- The reducer is pure, so tests are trivial: call `turnReducer(state, event)` and assert result

### Effect System Design Rationale

Effects are **commands, not actions**. The reducer says "STOP_TTS should happen" but does NOT call any TTS API. A separate **Orchestrator** (Story 10.2) will read these effects and execute them. This is the Command Pattern — it ensures the FSM remains pure, testable, and debuggable.

```typescript
// Example: The reducer emits effects, it does NOT execute them
const result = turnReducer(currentContext, { type: 'USER_SPEECH_START', ... });
// result.effects = [{ type: 'STOP_TTS' }]
// result.context.state = 'INTERRUPTED'
// An external loop (Orchestrator) reads effects and calls ttsProvider.stop()
```

### Project Structure Notes

- All new files go in `src/lib/engine/orchestrator/` — this maintains the engine isolation boundary documented in architecture.md
- The orchestrator directory is **adjacent** to the existing engine code but does **not** import from `runner.ts` or `advance.ts`
- Future Story 10.2 will create `bridge.ts` in the same directory to connect the FSM to the engine

### References

- [Source: _bmad-output/planning-artifacts/architecture.md § Real-Time Voice Evolution (Superimposed)]
- [Source: _bmad-output/planning-artifacts/architecture.md § Architectural Boundaries → Orchestrator Isolation]
- [Source: _bmad-output/planning-artifacts/epics.md § Epic 10 → Story 10.1]
- [Source: src/lib/engine/types.ts] — Existing Zod patterns to follow
- [Source: src/lib/engine/advance.ts] — Existing pure reducer pattern (reference only, do NOT modify)
- [Source: src/lib/engine/runner.ts] — Existing async runner (reference only, do NOT modify)

## Dev Agent Record

### Agent Model Used
Antigravity (Google DeepMind)

### Debug Log References
- All 22 unit tests passed in 7ms
- Full regression suite: 28 tests passed (1 pre-existing empty test file `crypto.test.ts` not caused by this story)
- Zero modifications to existing engine files verified

### Completion Notes List
- ✅ Task 1: Created `events.ts` with 12 Zod-validated event types as a discriminated union. Each event includes `sessionId`, `timestamp`, and type-specific payloads.
- ✅ Task 2: Created `types.ts` with 5 FSM states (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `INTERRUPTED`), `TurnContext` interface with `speakingText` field (bonus), 7 Effect command types, and `createInitialTurnContext()` factory.
- ✅ Task 3: Implemented `turnReducer` as a pure synchronous function. All state transitions implemented including barge-in (SPEAKING → INTERRUPTED via USER_SPEECH_START), cleanup transitions (SESSION_END, ERROR), and no-op handling. INTERRUPTED state auto-resolves to LISTENING. Cleanup effects are conditional — only emitted for active resources.
- ✅ Task 4: Created barrel `index.ts` with all public exports.
- ✅ Task 5: 22 unit tests (exceeding the min 15 requirement) covering all transitions, edge cases, purity, and a full conversation cycle.
- ⚠️ Pre-existing issue: `src/lib/crypto.test.ts` uses manual test runner instead of Vitest — not caused by this story.

### Change Log
- 2026-02-21: Story 10.1 implemented — Real-Time Event Schema & Turn-Taking FSM (all 5 tasks complete)

### File List
- `src/lib/engine/orchestrator/events.ts` (new) — 12 Zod-validated VoiceEvent types
- `src/lib/engine/orchestrator/types.ts` (new) — TurnState, TurnContext, Effect, TurnResult types
- `src/lib/engine/orchestrator/turn-machine.ts` (new) — Pure turnReducer FSM implementation
- `src/lib/engine/orchestrator/turn-machine.test.ts` (new) — 22 unit tests
- `src/lib/engine/orchestrator/index.ts` (new) — Barrel exports
