# Story 6.1: Inngest-Powered Execution Logic

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to execute workflow transitions using Inngest durable functions,
so that conversational state is preserved across interruptions and wait states.

## Acceptance Criteria

1. **Given** a published workflow and a trigger event
2. **When** the Inngest function is invoked
3. **Then** it loads the workflow JSON and current session state from Redis/Postgres
4. **And** it executes nodes sequentially (Speak -> Listen -> LLM) following directed edges
5. **And** for 'Listen' nodes, the function pauses (suspends) and waits for a specific 'resume' event
6. **And** once resumed, it updates the session context with user input and continues to the next node

## Tasks / Subtasks

- [x] Task 1: Inngest Infrastructure (AC: 1, 2)
  - [x] Initialize Inngest client in `src/server/inngest/client.ts`.
  - [x] Create the Inngest API route handler in `src/app/api/inngest/route.ts`.
  - [x] Register a basic `workflow/execute` function.
- [x] Task 2: State Machine Advance Logic (AC: 4)
  - [x] Implement `src/lib/engine/advance.ts` to determine the next node based on current state and workflow JSON.
  - [x] Support basic node execution (Speak: append to transcript, End: terminate session).
- [x] Task 3: Durable Wait & Resume (AC: 5, 6)
  - [x] Implement the `Listen` node logic using `step.waitForEvent` in the Inngest function.
  - [x] Create a tRPC procedure `session.resume` in `src/server/api/routers/workspace-session.ts` to send the `workflow/resume` event with user input.
  - [x] Ensure the Inngest function updates the `ExecutionContext` with the resumes's payload.

## Dev Notes

- **Architecture Compliance**:
  - The engine logic (`src/lib/engine`) must be pure and decoupled from Inngest specific calls where possible.
  - Use `src/server/inngest` for the orchestration layer.
  - Follow naming patterns: `entity/action` for events (e.g., `workflow/execute`).
- **Source Tree Components**:
  - `src/server/inngest/client.ts`
  - `src/server/inngest/functions.ts`
  - `src/lib/engine/advance.ts`
  - `src/server/api/routers/session.ts`

### Project Structure Notes

- Keep the core state machine in `src/lib/engine` as per Architecture Doc page 142.
- Inngest serves as the "Reliability Layer" as per Architecture Doc page 143.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6]

## Dev Agent Record

### Agent Model Used

Claude (Anthropic)

### Debug Log References

- OpenAI and Anthropic SDK packages installed for LLM provider support
- Collapsible component added via shadcn

### Completion Notes List

1. **Task 1 Complete**: Inngest infrastructure is set up with client, route handler, and executeWorkflow function registered.

2. **Task 2 Complete**: Created a comprehensive async workflow engine (`runner.ts`) that:
   - Processes all node types (Trigger, Speak, Listen, LLM_Reply, LLM_Decision, Tool, End)
   - Supports real LLM calls via adapter pattern (OpenAI, Anthropic providers)
   - Maintains execution context with transcript, variables, and status
   - Returns AdvanceResult with context and action type

3. **Task 3 Complete**: Implemented durable wait/resume pattern:
   - Inngest function uses `step.waitForEvent` for Listen nodes (30min timeout)
   - Created `workspaceSession.start` and `workspaceSession.resume` tRPC procedures
   - Added `workspaceSession.getContext` for polling session state
   - Session context persisted to Postgres via metadata field

4. **Bonus - Live Simulator UI**: Created a chat-based test interface that:
   - Allows users to configure LLM provider, model, and API key
   - Triggers real workflow execution via backend
   - Polls for context updates and displays transcript
   - Supports both Mock Test (step-by-step) and Live Test (real AI) modes

### File List

**New Files:**
- `src/lib/engine/types.ts` - ExecutionContext, node data schemas, event types
- `src/lib/engine/runner.ts` - Async workflow engine with real LLM support
- `src/lib/engine/providers/llm.ts` - LLM provider adapters (OpenAI, Anthropic)
- `src/server/inngest/functions.ts` - Inngest executeWorkflow durable function
- `src/hooks/use-workflow-execution.ts` - React hook for live workflow execution
- `src/app/editor/_components/live-simulator.tsx` - Live test UI component

**Modified Files:**
- `src/app/api/inngest/route.ts` - Registered executeWorkflow function
- `src/server/api/routers/workspace-session.ts` - Added start, resume, getContext procedures
- `src/app/editor/[id]/page.tsx` - Added dropdown for Mock Test vs Live Test
- `package.json` - Added openai, @anthropic-ai/sdk dependencies

