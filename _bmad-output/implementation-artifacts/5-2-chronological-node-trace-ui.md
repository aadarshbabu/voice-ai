# Story 5.2: Chronological Node Trace UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to see a step-by-step trace of a specific session,
so that I can understand exactly why an agent reached a certain state.

## Acceptance Criteria

1. **Given** a user is viewing a specific session detail page
2. **When** they select a node from the execution timeline
3. **Then** the UI highlights that node on a read-only React Flow canvas
4. **And** a side panel shows the exact input variables, the LLM decision/prompt used (if applicable), and the resulting output for that specific step
5. **And** the timeline shows Speak/Listen events chronologically

## Tasks / Subtasks

- [x] Task 1: Execution Trace Data Model (AC: 4, 5)
  - [x] Add `ExecutionTrace` model to `prisma/schema.prisma`.
  - [x] Fields: `id`, `sessionId`, `nodeId`, `inputVariables` (Json), `outputData` (Json), `logs` (Json), `createdAt`.
  - [x] Run `npx prisma generate`.
- [x] Task 2: API Layer - Trace Detail (AC: 1, 4)
  - [x] Implement `getTrace` procedure in `workspace-session.ts` router.
  - [x] Should return session metadata + chronological list of traces.
- [x] Task 3: UI Layer - Session Detail Page (AC: 1-5)
  - [x] Create `src/app/editor/[id]/sessions/[sessionId]/page.tsx`.
  - [x] Implement a layout with:
    - **Header**: Session summary (ID, Time, Status).
    - **Sidebar (Left)**: Chronological timeline of executed nodes.
    - **Main Area**: Read-only `WorkflowCanvas` highlighting the currently selected step's node.
    - **Inspector Panel (Right)**: Detail view showing inputs/outputs for the selected trace step.

## Dev Notes

- **Read-only Canvas**: Reuse `WorkflowCanvas` but with `nodesDraggable={false}`, `nodesConnectable={false}`, and disabling all editing features.
- **State Highlighting**: Pass the `nodeId` from the selected trace step to the canvas for highlighting (similar to the simulator logic implemented in Epic 4).
- **Data Volume**: If traces grow large, consider sharding or partial loading, but for now simple fetch is fine.

### Project Structure Notes

- Uses nested routing under editor: `/editor/[id]/sessions/[sessionId]`.
- Reuses canvas components for consistency.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Observability]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2: Chronological Node Trace UI]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Thinking)

### Debug Log References

### Completion Notes List

### File List

- `prisma/schema.prisma`
- `src/server/api/routers/workspace-session.ts`
- `src/app/editor/_components/workflow-canvas.tsx`
- `src/app/editor/[id]/sessions/[sessionId]/page.tsx`
