# Story 4.2: Step-by-Step Text Simulator

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to test my workflow in a text-based simulator within the editor,
so that I can verify the logic before running real voice sessions.

## Acceptance Criteria

1. **Given** a valid workflow draft
2. **When** the user clicks "Test Workflow" (or enters "Simulate Mode")
3. **Then** a side panel or modal chat-like simulator opens
4. **And** as the simulation progresses (e.g., clicking 'Next' or entering text), the current active node is visually highlighted on the React Flow canvas (e.g., glowing border)
5. **And** the user can see current variable states updated in real-time in the simulator side panel
6. **And** the simulator behaves according to the node configuration (Speak -> Show text, Listen -> Wait for input, LLM -> Simulate decision/reply).

## Tasks / Subtasks

- [x] Task 1: Simulation State Management (AC: 4, 5, 6)
  - [x] Implement a `useSimulator` hook to track the "Active Node" and "Execution Context" (variables).
  - [x] Implement a `stepForward(input?)` function that mimics the backend engine logic.
- [x] Task 2: Simulator UI Panel (AC: 3)
  - [x] Create a `WorkflowSimulator` component (likely a shadcn `Drawer` or `Sheet`).
  - [x] Add a chat-like interface to display agent messages (Speak) and user inputs (Listen).
  - [x] Add a "Variables" inspector to see the JSON state.
- [x] Task 3: Canvas Integration (AC: 4)
  - [x] Pass the `activeNodeId` from the simulator back to the `WorkflowCanvas`.
  - [x] Apply a "is-active" style Class to the target node in React Flow.
  - [x] Ensure the canvas scrolls to/centers on the active node during simulation.

## Dev Notes

- **Architecture Compliance**:
  - Reuse the logic from `src/lib/engine/advance.ts` (from Story 6.1) if available, or implement a mirrored lightweight version for the client.
  - Use `framer-motion` for the node highlight animation if possible to make it feel premium.
- **Source Tree Components**:
  - `src/app/editor/_components/simulator/workflow-simulator.tsx` (New)
  - `src/hooks/use-simulator.ts` (New)
  - `src/app/editor/_components/workflow-canvas.tsx` (Update to support simulation overlay)

### Project Structure Notes

- Simulation should be isolated from the "Save" state; it should work on the current local session of nodes/edges.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: src/lib/engine/types.ts]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Flash)

### Debug Log References

### Completion Notes List

### File List
