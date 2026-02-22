# Story 10.2: The Engine Orchestrator Wrapper

Status: review

## Story

As a system,
I want a wrapper that "consults" the existing `advanceWorkflow` engine and executes the Effects emitted by the turn-taking FSM,
so that I can evolve to real-time voice interactions without breaking the existing text-based simulator or workflow execution logic.

## Acceptance Criteria

1. **State Bridge**: An `EngineOrchestrator` class is implemented that translates FSM `CALL_ENGINE` effects into `runWorkflowUntilWait()` calls, mapping the `AdvanceResult` back into FSM `VoiceEvent`s (e.g., `ENGINE_RESULT`).
2. **Session Persistence**: The orchestrator rehydrates `ExecutionContext` from the database (via Prisma) before each logic step, and persists the updated context after each engine call — consistent with the existing `functions.ts` pattern.
3. **Effect Handler Loop**: A `processEffects()` method iterates over the `Effect[]` array returned by `turnReducer` and dispatches each effect to the appropriate handler (engine call, ASR control, TTS control, logging). Effect handlers are **injected** via a typed `EffectHandlers` interface for testability.
4. **TTS Buffer Management**: When a `STOP_TTS` effect is received (barge-in), the orchestrator invoking the injected TTS handler which signals cancellation. The orchestrator tracks `ttsAbortController` internally so in-flight TTS can be cancelled.
5. **Event Dispatch**: The orchestrator exposes a `dispatch(event: VoiceEvent)` method that feeds events to `turnReducer`, processes resulting effects, and emits status updates via the existing `sessionEmitter`.
6. **No Engine Modification**: The existing `src/lib/engine/runner.ts`, `src/lib/engine/advance.ts`, and `src/lib/engine/types.ts` files are NOT modified. The orchestrator only **imports from** and **calls** the engine.
7. **Unit Tested**: At minimum 15 unit tests covering the orchestrator's dispatch loop, effect routing, engine bridge mapping, session persistence, and error handling — with all external dependencies (DB, TTS, ASR) mocked via injected handlers.

## Tasks / Subtasks

- [x] Task 1: Define the `EffectHandlers` interface and `OrchestratorConfig` types (AC: #3, #4)
  - [x] 1.1: Create `src/lib/engine/orchestrator/effect-handlers.ts` with the `EffectHandlers` interface
  - [x] 1.2: Define handler signatures: `onStartASR()`, `onStopASR()`, `onStopTTS()`, `onCallEngine(transcript)`, `onEmitSpeakingText(text, nodeId)`, `onEmitAudio(text, nodeId)`, `onLogEvent(message, level)`
  - [x] 1.3: Define `OrchestratorConfig` type with `sessionId`, `workflowId`, `handlers`, `prisma` (optional for DI), and `llmConfig` (optional)
  - [x] 1.4: Export a `createNoopHandlers()` factory that returns safe no-op implementations (useful for testing)

- [x] Task 2: Implement the `EngineOrchestrator` class (AC: #1, #2, #5)
  - [x] 2.1: Create `src/lib/engine/orchestrator/engine-orchestrator.ts`
  - [x] 2.2: Implement constructor accepting `OrchestratorConfig`
  - [x] 2.3: Implement `dispatch(event: VoiceEvent): Promise<void>` — calls `turnReducer`, then `processEffects()`
  - [x] 2.4: Implement `processEffects(effects: Effect[]): Promise<void>` — iterates effects and calls appropriate handler
  - [x] 2.5: Implement `handleCallEngine(transcript: string): Promise<void>` — the State Bridge:
    - Load workflow from DB (nodes, edges)
    - Rehydrate `ExecutionContext` from DB session metadata (same pattern as `functions.ts`)
    - Call `runWorkflowUntilWait(nodes, edges, context, transcript, llmConfig)`
    - Map `AdvanceResult.action` → FSM `VoiceEvent`:
      - `speak` → `ENGINE_RESULT { text, nodeId }`
      - `wait_for_input` → `ENGINE_RESULT { actionType: 'wait_for_input', nodeId }`
      - `completed` → `SESSION_END { reason: 'completed' }`
      - `error` → `ERROR { message }`
    - Persist updated `ExecutionContext` back to DB
    - Re-dispatch the mapped `VoiceEvent` into the FSM via `_processEvent()` (avoids dispatch queue deadlock)
  - [x] 2.6: Implement `getContext(): TurnContext` — returns the current FSM state (read-only copy)
  - [x] 2.7: Implement `destroy(): void` — cleanup method to release resources

- [x] Task 3: Implement TTS Buffer Management (AC: #4)
  - [x] 3.1: Track a `ttsAbortController: AbortController | null` inside the orchestrator
  - [x] 3.2: On `EMIT_SPEAKING_TEXT` effect → create new `AbortController`, pass signal to TTS handler
  - [x] 3.3: On `STOP_TTS` effect → call `ttsAbortController.abort()` before invoking `handlers.onStopTTS()`
  - [x] 3.4: Ensure abort is idempotent (safe to call if no TTS is active)

- [x] Task 4: Integrate with `sessionEmitter` for SSE push (AC: #5)
  - [x] 4.1: After each `dispatch()` cycle, call `sessionEmitter.notifyUpdate()` with updated context
  - [x] 4.2: On `SESSION_END` or `ERROR` → also call `sessionEmitter.notifyComplete()`
  - [x] 4.3: Emit FSM state changes as part of the update payload (so the frontend knows `LISTENING`, `SPEAKING`, etc.)

- [x] Task 5: Update the barrel export (AC: #6)
  - [x] 5.1: Update `src/lib/engine/orchestrator/index.ts` to re-export `EngineOrchestrator`, `EffectHandlers`, `OrchestratorConfig`, and `createNoopHandlers`

- [x] Task 6: Write comprehensive unit tests (AC: #7)
  - [x] 6.1: Create `src/lib/engine/orchestrator/engine-orchestrator.test.ts`
  - [x] 6.2: Test: `dispatch(SESSION_START)` triggers `handlers.onStartASR()`
  - [x] 6.3: Test: `dispatch(USER_SPEECH_FINAL)` triggers `handlers.onStopASR()` then `handlers.onCallEngine(transcript)`
  - [x] 6.4: Test: `handleCallEngine` maps `speak` action → `ENGINE_RESULT` → `SPEAKING` state
  - [x] 6.5: Test: `handleCallEngine` maps `completed` action → `SESSION_END` → `IDLE` state
  - [x] 6.6: Test: `handleCallEngine` maps `error` action → `ERROR` → `IDLE` state with cleanup
  - [x] 6.7: Test: Barge-in: `USER_SPEECH_START` during `SPEAKING` triggers `handlers.onStopTTS()` and aborts `AbortController`
  - [x] 6.8: Test: `SESSION_END` triggers cleanup effects (`STOP_TTS` + `STOP_ASR`)
  - [x] 6.9: Test: Effect handler errors are caught and routed to `LOG_EVENT` (graceful degradation)
  - [x] 6.10: Test: `getContext()` returns a copy (not a reference) of the current state
  - [x] 6.11: Test: `destroy()` aborts any active TTS and marks orchestrator as destroyed
  - [x] 6.12: Test: Multiple rapid `dispatch()` calls are serialized (no race conditions on context)
  - [x] 6.13: Test: `SILENCE_TIMEOUT` in LISTENING state triggers engine call with last transcript
  - [x] 6.14: Test: Session persistence — `ExecutionContext` is loaded and saved via Prisma mock
  - [x] 6.15: Test: `sessionEmitter.notifyUpdate()` is called after each dispatch with FSM state
  - [x] 6.16: Test: Full conversation cycle via dispatch: SESSION_START → SPEECH_FINAL → ENGINE_RESULT → TTS_END → SPEECH_FINAL → SESSION_END


## Dev Notes

### Critical Architecture Constraint: Engine as a "Consultant"

This story implements the **Wrapper (Consultant) Pattern** from `architecture.md § Real-Time Voice Evolution`. The orchestrator does NOT modify or extend the engine — it **calls** the engine as-is, using `runWorkflowUntilWait()`. The engine remains pure and untouched.

```
┌──────────────────────────────────────────────┐
│                  ORCHESTRATOR (Bridge)        │
│                                              │
│  dispatch(event) ──► turnReducer(ctx, evt)   │
│         │                   │                │
│         ▼                   ▼                │
│   processEffects()     { newCtx, effects[] } │
│         │                                    │
│   ┌─────┴─────┐                              │
│   │ CALL_ENGINE│──────► runWorkflowUntilWait │
│   │ STOP_TTS   │──────► handlers.onStopTTS() │
│   │ START_ASR  │──────► handlers.onStartASR()│
│   │ LOG_EVENT  │──────► handlers.onLogEvent()│
│   └────────────┘                              │
│                                              │
│   After effects: sessionEmitter.notifyUpdate │
└──────────────────────────────────────────────┘
```

### How `AdvanceResult` Maps to FSM Events

The core translation logic in `handleCallEngine`:

| `AdvanceResult.action.type` | FSM `VoiceEvent` emitted | Notes |
|---|---|---|
| `speak` | `ENGINE_RESULT { text, nodeId }` | Agent has something to say → FSM → SPEAKING |
| `wait_for_input` | `ENGINE_RESULT { actionType: 'wait_for_input', nodeId }` | Engine waiting for user → FSM stays LISTENING |
| `completed` | `SESSION_END { reason: 'completed' }` | Workflow done → FSM → IDLE |
| `error` | `ERROR { message }` | Engine error → FSM → IDLE with cleanup |
| `continue` | (internal) Re-call engine | Should not occur since `runWorkflowUntilWait` handles this loop |
| `wait_for_webhook` | `ENGINE_RESULT { actionType: 'wait_for_webhook' }` | Webhook wait → may require special handling |

### Dispatch Serialization (Critical!)

The `dispatch()` method MUST serialize calls. If `USER_SPEECH_START` arrives while `handleCallEngine()` is mid-flight, the barge-in must:
1. Immediately abort TTS via `AbortController`
2. Queue the FSM transition until the current engine call settles
3. Then process the queued event

Use a **dispatch queue** pattern (e.g., a `Promise` chain or `p-queue` with concurrency=1). This prevents race conditions on `TurnContext`.

```typescript
// Simplified serialization pattern
private dispatchQueue: Promise<void> = Promise.resolve();

async dispatch(event: VoiceEvent): Promise<void> {
  this.dispatchQueue = this.dispatchQueue.then(() => this._processEvent(event));
  return this.dispatchQueue;
}
```

### Session Persistence Pattern (from functions.ts)

Follow the **exact same pattern** used in `src/server/inngest/functions.ts`:

```typescript
// LOAD context (rehydrate)
const session = await prisma.workflowSession.findUnique({ where: { id: sessionId } });
const metadata = session?.metadata as SessionData;
const context = normalizeContext(metadata.context);

// SAVE context (persist)
await prisma.workflowSession.update({
  where: { id: sessionId },
  data: {
    metadata: { context: updatedContext, llmConfig } as object,
    status: mapStatus(updatedContext.status),
  },
});
```

### Dependency Injection for Testability

The `EffectHandlers` interface is the **seam** that makes this testable. In real usage, the handlers will call actual TTS/ASR SDKs. In tests, they're simple mock functions:

```typescript
interface EffectHandlers {
  onStartASR: () => Promise<void>;
  onStopASR: () => Promise<void>;
  onStopTTS: () => Promise<void>;
  onCallEngine: (transcript: string) => Promise<AdvanceResult>;
  onEmitSpeakingText: (text: string, nodeId?: string) => Promise<void>;
  onEmitAudio: (text: string, nodeId?: string) => Promise<void>;
  onLogEvent: (message: string, level?: 'info' | 'warn' | 'error') => Promise<void>;
}
```

### Previous Story (10.1) Intelligence

**Files created in 10.1 that this story imports from:**
- `src/lib/engine/orchestrator/events.ts` — `VoiceEvent`, individual event types
- `src/lib/engine/orchestrator/types.ts` — `TurnContext`, `TurnResult`, `Effect`, `createInitialTurnContext()`
- `src/lib/engine/orchestrator/turn-machine.ts` — `turnReducer()`

**Key decisions from 10.1 to maintain:**
- Effects are **commands, not actions** — the orchestrator executes them
- `INTERRUPTED` is a transient state that auto-resolves to `LISTENING`
- `transitionToIdle()` emits conditional cleanup effects (only for active resources)
- The `speakingText` field on `TurnContext` tracks what the agent is currently saying

**What 10.1 Dev Agent noted:**
- All 22 unit tests pass in 7ms
- Pre-existing `crypto.test.ts` uses manual runner (not a regression)
- Zero modifications to engine files

### Naming & Code Conventions (from architecture.md)

- File naming: `kebab-case.ts` (e.g., `engine-orchestrator.ts`, `effect-handlers.ts`)
- Type naming: `PascalCase` (e.g., `EngineOrchestrator`, `EffectHandlers`)
- Class naming: `PascalCase` (e.g., `EngineOrchestrator`)
- Exports: Named exports, no default exports
- Tests: Co-located `*.test.ts` files

### Testing Framework

- Use Vitest (already configured, `vitest.config.ts` present)
- Mock `prisma` using `vi.mock()` — do NOT use a real database
- Mock `runWorkflowUntilWait` with `vi.mock('@/lib/engine/runner')`
- Mock `sessionEmitter` with `vi.mock('@/lib/engine/session-emitter')`
- Inject mock `EffectHandlers` using `createNoopHandlers()` + `vi.fn()` overrides
- Tests must be purely in-memory — no DB, no network, no actual TTS/ASR

### Project Structure

```
EXISTING (DO NOT MODIFY):
  src/lib/engine/
  ├── advance.ts          ← Pure sync state machine
  ├── runner.ts           ← Async workflow runner (imports from here)
  ├── types.ts            ← ExecutionContext, AdvanceResult (imports from here)
  ├── session-emitter.ts  ← Event emitter for SSE (imports from here)
  └── providers/          ← LLM, TTS, STT adapters

  src/server/inngest/
  └── functions.ts        ← Existing Inngest workflow execution (pattern reference only)

STORY 10.1 (DO NOT MODIFY):
  src/lib/engine/orchestrator/
  ├── events.ts           ← VoiceEvent union type (imports from here)
  ├── types.ts            ← TurnState, TurnContext, Effect (imports from here)
  ├── turn-machine.ts     ← Pure reducer (imports from here)
  └── turn-machine.test.ts

NEW (this story):
  src/lib/engine/orchestrator/
  ├── effect-handlers.ts          ← EffectHandlers interface + createNoopHandlers()
  ├── engine-orchestrator.ts      ← EngineOrchestrator class
  ├── engine-orchestrator.test.ts ← Unit tests
  └── index.ts                    ← Updated barrel exports
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md § Real-Time Voice Evolution (Superimposed)]
- [Source: _bmad-output/planning-artifacts/architecture.md § Architectural Boundaries → Orchestrator Isolation]
- [Source: _bmad-output/planning-artifacts/architecture.md § Project Structure → orchestrator/bridge.ts]
- [Source: _bmad-output/planning-artifacts/epics.md § Epic 10 → Story 10.2]
- [Source: _bmad-output/implementation-artifacts/10-1-real-time-event-schema-and-turn-taking-fsm.md — Previous story dev notes and file list]
- [Source: src/lib/engine/types.ts § AdvanceResult — Action types that must be mapped]
- [Source: src/lib/engine/runner.ts § runWorkflowUntilWait — The engine entry point]
- [Source: src/lib/engine/runner.ts § advanceWorkflowAsync — Single-step engine logic]
- [Source: src/server/inngest/functions.ts — Session persistence pattern to replicate]
- [Source: src/lib/engine/session-emitter.ts — SSE notification integration point]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (Antigravity)

### Debug Log References

- Initial test run: 11 failures (all timeouts due to recursive `dispatch()` deadlock in `handleCallEngine`) — resolved by using `_processEvent()` directly for internal re-dispatch since we are already inside the serialized queue.
- Second test run: 1 failure (`INTERRUPTED` vs `LISTENING` for barge-in test) — fixed by aligning test expectation with FSM behavior from Story 10.1 where `INTERRUPTED` is a transient state.
- Final run: 39/39 tests passing (22 from 10.1 + 17 from 10.2), 885ms total.

### Completion Notes List

- ✅ **AC #1 (State Bridge):** `EngineOrchestrator.handleCallEngine()` translates `CALL_ENGINE` effects into `runWorkflowUntilWait()` calls and maps `AdvanceResult` back to FSM `VoiceEvent`s — tested by 6.4, 6.5, 6.6.
- ✅ **AC #2 (Session Persistence):** `loadExecutionContext()` and `saveExecutionContext()` follow the exact Prisma patterns from `functions.ts` — tested by 6.14.
- ✅ **AC #3 (Effect Handler Loop):** `processEffects()` iterates `Effect[]` and dispatches to injected `EffectHandlers`. Errors are caught and routed to `LOG_EVENT` for graceful degradation — tested by 6.9.
- ✅ **AC #4 (TTS Buffer Management):** `ttsAbortController` is created on `EMIT_SPEAKING_TEXT` and aborted on `STOP_TTS`. Abort is idempotent — tested by 6.7, 6.11.
- ✅ **AC #5 (Event Dispatch):** `dispatch()` method serializes calls via promise queue, preventing race conditions. `sessionEmitter.notifyUpdate()` called after each dispatch — tested by 6.12, 6.15.
- ✅ **AC #6 (No Engine Modification):** Zero changes to `runner.ts`, `types.ts`, or `session-emitter.ts`. Orchestrator only imports from and calls the engine.
- ✅ **AC #7 (Unit Tested):** 17 unit tests (exceeds minimum of 15), all passing in 22ms.
- 🔧 **Critical Bug Fix:** Recursive `dispatch()` inside `handleCallEngine` created a promise chain deadlock. Resolved by using `_processEvent()` directly when already inside the serialized dispatch queue.
- 📝 **Design Decision:** `PrismaLike` interface provides a minimal DI surface for the Prisma client, keeping the orchestrator testable without importing the full generated Prisma client.
- 📝 **Design Decision:** `EffectHandlers` intentionally excludes `onCallEngine()` — the engine call is orchestrator-internal, not delegated to handlers.

### Change Log

- 2026-02-21: Story 10.2 implemented — EngineOrchestrator class, EffectHandlers interface, barrel export, 17 unit tests.

### File List

- `src/lib/engine/orchestrator/effect-handlers.ts` — NEW: EffectHandlers interface, PrismaLike interface, OrchestratorConfig type, createNoopHandlers() factory
- `src/lib/engine/orchestrator/engine-orchestrator.ts` — NEW: EngineOrchestrator class with dispatch serialization, effect routing, engine bridge, TTS abort, SSE notification
- `src/lib/engine/orchestrator/engine-orchestrator.test.ts` — NEW: 17 unit tests covering all acceptance criteria
- `src/lib/engine/orchestrator/index.ts` — MODIFIED: Added barrel exports for EngineOrchestrator, EffectHandlers, OrchestratorConfig, PrismaLike, createNoopHandlers
