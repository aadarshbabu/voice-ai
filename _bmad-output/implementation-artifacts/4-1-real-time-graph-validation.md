# Story 4.1: Real-time Graph Validation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to see visual warnings if my workflow graph is invalid,
so that I don't publish broken agents.

## Acceptance Criteria

1. **Given** a user is designing a graph
2. **When** a change is made (add/remove node or edge)
3. **Then** a background validation runner checks:
    - Is there exactly one Start (Trigger) node?
    - Are there any isolated (orphaned) nodes?
    - Are all Decision branches connected to an outgoing edge?
    - Are there any endless loops without an 'End' or 'Speak'/'Listen' node? (Basic cycle detection)
4. **And** invalid nodes/edges are visually highlighted (e.g., red border, warning icon, or toast notification).
5. **And** the "Publish" button is disabled if critical validation errors exist.

## Tasks / Subtasks

- [x] Task 1: Validation Engine Logic (AC: 3)
  - [x] Implement a `validateGraph(nodes, edges)` utility function in `src/lib/validation/graph.ts`.
  - [x] Check for:
    - [x] Missing or multiple `trigger` nodes.
    - [x] Nodes with no incoming or outgoing edges (except trigger/end).
    - [x] `llm-decision` nodes where configured outcomes don't match outgoing edge IDs.
- [x] Task 2: Real-time Integration (AC: 1, 2)
  - [x] Integrate the `validateGraph` call into the `WorkflowCanvas`'s `useEffect` (debounced alongside auto-save).
  - [x] Store validation errors in a local state `validationErrors`.
- [x] Task 3: Visual Feedback (AC: 4, 5)
  - [x] Map validation errors to specific node/edge IDs.
  - [x] Update `BaseNode` or use React Flow's `errorMessage` property to show warnings.
  - [x] Display a summary toast or sidebar list of current errors.
  - [x] Disable the "Publish" action if errors exist in the state.

## Dev Notes

- **Architecture Compliance**:
  - Validation logic should be pure and separated from the UI (`src/lib/validation`).
  - Use `sonner` for non-intrusive warnings.
  - Follow the existing pattern for debounced updates in `workflow-canvas.tsx`.
- **Source Tree Components**:
  - `src/lib/validation/graph.ts` (New)
  - `src/app/editor/_components/workflow-canvas.tsx` (Update)
  - `src/app/editor/_components/nodes/base-node.tsx` (Update for visual feedback)

### Project Structure Notes

- Keep the validation logic in `src/lib/validation` to allow re-use on the server during the publish phase (Epic 1.3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- [Source: src/types/nodes.ts]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Flash)

### Debug Log References

### Completion Notes List

### File List
