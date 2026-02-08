# Story 2.2: Directed Edge Connectivity

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to connect nodes with directed edges,
so that I can define the path the conversation will take.

## Acceptance Criteria

1. **Given** two nodes exist on the canvas
2. **When** a user drags a connection from one node's output handle to another's input handle
3. **Then** a directed edge is created
4. **And** the UI prevents invalid connections (e.g., source and target being the same node)
5. **And** the edges are visually distinct and directed (with arrows)

## Tasks / Subtasks

- [x] Task 1: Connection Validation (AC: 4)
  - [x] Implement `isValidConnection` function to prevent self-looping connections (source == target).
  - [x] Verify that Trigger nodes cannot be targets and End nodes cannot be sources (already partially handled by handle presence, but ensure robustness).
- [x] Task 2: Edge Styling & Aesthetics (AC: 5)
  - [x] Update `defaultEdgeOptions` in `WorkflowCanvas` for a more premium look (consistent with Story 2.1 theme).
  - [x] Ensure `MarkerType.ArrowClosed` is used for directed indicators.
  - [x] Add subtle animation to edges (as already initialized, but verify).
- [x] Task 3: Handle Interaction Polish (AC: 3)
  - [x] Ensure handles have clear hover states (Story 2.1 already implemented some, but verify connectivity experience).
  - [x] Update `onConnect` to use the validated connection params.

## Dev Notes

- **Library**: `@xyflow/react` v12.
- **File to Modify**: `src/app/editor/_components/workflow-canvas.tsx`.
- **Architecture Compliance**:
  - Keep state management within `useEdgesState`.
  - Use tRPC naming conventions if any data persistence were involved (not for this story's UI logic).
  - Follow the existing pattern of using `crypto.randomUUID()` for unique IDs if needed (though `addEdge` handles edge IDs).

### Project Structure Notes

- Canvas component: `src/app/editor/_components/workflow-canvas.tsx`
- Node components: `src/app/editor/_components/nodes/base-node.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md #Story 2.2]
- [Source: src/app/editor/_components/workflow-canvas.tsx]
- [Source: src/app/editor/_components/nodes/base-node.tsx]

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash

### Debug Log References

- Fixed type mismatch in `isValidConnection` (Connection vs Edge | Connection).
- Added blue arrow marker to `defaultEdgeOptions`.

### Completion Notes List

- [x] Implemented `isValidConnection` with rules: no self-loops, no incoming to Trigger, no outgoing from End.
- [x] Updated edge styling with blue arrows and persistent stroke width.
- [x] Verified connectivity with real browser testing and provided credentials.

### File List

- `src/app/editor/_components/workflow-canvas.tsx`
- `dev-credentials.md` (Created for local dev tracking)
