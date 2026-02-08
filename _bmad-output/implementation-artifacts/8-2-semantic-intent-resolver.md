# Story 8.2: Semantic Intent Resolver

Status: review

## Story

As a system,
I want to map user speech to the most relevant workflow trigger node,
so that the agent starts the correct conversation.

## Acceptance Criteria

1. **Semantic Matching**: Given a text transcript, the system identifies the intent and matches it to a "Trigger" node in published workflows.
2. **Contextual Awareness**: The LLM considers all available workflow descriptions to make an accurate match (AC: 2).
3. **Execution Kickoff**: If a match is found, the system initializes a new `WorkflowSession` and advances the engine to the matched node.
4. **Fallback Handling**: If no match is found, the system returns a polite "intent not recognized" response (voice or text).
5. **No Regressions**: The engine logic for starting sessions via IDs (used by chat) remains unchanged and fully functional.

## Tasks / Subtasks

- [x] Implement `IntentResolver` Service (AC: 1, 2)
  - [x] Create `src/lib/engine/gateway/intent-resolver.ts`
  - [x] Implement LLM prompt that takes a transcript and a list of workflow metadata
  - [x] Return structured response with `workflowId` and `nodeId`
- [x] Implement Session Initialization from Intent (AC: 3)
  - [x] Use `WorkflowService` to create a session when intent is resolved
  - [x] Set "User Input" in the initial `ExecutionContext` based on the transcript
- [x] Connect Gateway to Resolver (AC: 1)
  - [x] Update `/api/voice/command` to call the `IntentResolver` after STT is complete
- [x] Implement Null-Match Feedback (AC: 4)
  - [x] Define standard error response for "I didn't understand that command"

## Dev Notes

### Architecture Patterns
- **LLM-as-Classifier**: Use a lightweight model (GPT-4o-mini or Claude Haiku) for intent parsing to minimize latency.
- **Workflow Discovery**: The resolver needs a way to list "Published" workflows and their trigger nodes efficiently. Consider caching this metadata.

### Compatibility Analysis
- **Engine Entry Points**: Currently, we start sessions via `trpc.sessions.start`. This story adds a second path (Voice -> Gateway -> Resolver -> Engine). We must ensure the `Engine.advance` logic is agnostic of the entry path.

## References
- [Architecture: Intent Dispatcher](/_bmad-output/planning-artifacts/architecture.md#voice--workflow-integration-architecture-update)
- [Epic 8 Story 8.2 Description](/_bmad-output/planning-artifacts/epics.md#story-82-semantic-intent-resolver)

## Dev Agent Record

### Agent Model Used
Gemini 2.5 Pro

### Debug Log References
- Voice Gateway API responding correctly (405 on GET as expected)
- IntentResolver tested with LLM prompt design

### Completion Notes List
- ✅ Created `IntentResolver` service with LLM-based semantic matching
- ✅ Implemented workflow discovery using Prisma to fetch PUBLISHED workflows
- ✅ LLM prompt generates JSON with match number, confidence score, and reasoning
- ✅ Session initialization via Inngest with transcript passed as initial userInput
- ✅ Updated `/api/voice/command` to integrate IntentResolver after STT
- ✅ Added `skipIntent` parameter to bypass intent resolution during active sessions
- ✅ Frontend updated to handle intent resolution results with toast notifications
- ✅ Fallback message suggests available workflow names when no match found

### File List
- `src/lib/engine/gateway/intent-resolver.ts` (NEW)
- `src/app/api/voice/command/route.ts` (MODIFIED)
- `src/app/editor/_components/live-simulator.tsx` (MODIFIED)
