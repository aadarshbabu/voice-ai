# Story 3.1: Speak & Listen Node Configuration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to configure the speech text and listening variables for my agent,
so that I can define what the agent says and what it waits for.

## Acceptance Criteria

1. **Given** a Speak or Listen node is selected on the canvas
2. **When** the user clicks the node
3. **Then** a right drawer (shadcn Sheet) opens
4. **And** for a **Speak** node, the user can enter text with `{{variable}}` interpolation support (monospaced editor preferred)
5. **And** for a **Listen** node, the user can define the `variableName` to store the result and the `silenceTimeout` (seconds)
6. **And** changes are automatically persisted to the node's `data` object in the React Flow state (triggering auto-save)

## Tasks / Subtasks

- [x] Task 1: Node Selection & Config Drawer (AC: 1, 2, 3)
  - [x] Implement `onNodeClick` handler in `WorkflowCanvas`.
  - [x] Add a `Sheet` (Drawer) component from shadcn/ui to the canvas wrapper.
  - [x] Determine selected node type and pass its data to the drawer.
- [x] Task 2: Speak Node Form (AC: 4, 6)
  - [x] Create `SpeakNodeConfig` form component with a `Textarea` for the message.
  - [x] Add visual hints for `{{variable}}` interpolation.
  - [x] Implement live updates to the node's `data.text` property.
- [x] Task 3: Listen Node Form (AC: 5, 6)
  - [x] Create `ListenNodeConfig` form component with inputs for `variableName` and `timeout`.
  - [x] Ensure `timeout` is a numeric input.
  - [x] Implement live updates to the node's `data.variableName` and `data.timeout`.

## Dev Notes

- **Architecture Compliance**:
  - Use `src/app/editor/_components/workflow-canvas.tsx` as the main container for the drawer.
  - Follow the existing pattern of using tRPC for persistence (already handled by auto-save in 2.3).
  - Use shadcn/ui `Sheet`, `Label`, `Input`, `Textarea`.
- **Source Tree Components**:
  - `src/app/editor/_components/workflow-canvas.tsx`
  - `src/app/editor/_components/node-config-drawer.tsx` (New)
  - `src/app/editor/_components/nodes/speak-config.tsx` (New)
  - `src/app/editor/_components/nodes/listen-config.tsx` (New)

### Project Structure Notes

- Keep configuration components in `src/app/editor/_components/nodes/` for modularity.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- [Source: src/types/nodes.ts]

## Dev Agent Record
 
 ### Agent Model Used
 
 Antigravity (Gemini 2.0 Flash)
 
 ### Debug Log References
- Handled JSX interpolation error for `{{variable}}` by wrapping in string literals.
- Installed `vitest` and `@testing-library/react` to support TDD/TDR workflow.
- Fixed `Textarea` missing component.

 ### Completion Notes List
- [x] Drawer opens on node click with smooth shadcn transition.
- [x] Speak node configuration supports multiline text and variable hints.
- [x] Listen node configuration supports variable mapping and numeric timeout.
- [x] Real-time data updates verified; automatically picked up by auto-save mechanism.

 ### File List
- `src/app/editor/_components/workflow-canvas.tsx` (Modified)
- `src/app/editor/_components/node-config-drawer.tsx` (Created)
- `src/app/editor/_components/nodes/speak-config.tsx` (Created)
- `src/app/editor/_components/nodes/listen-config.tsx` (Created)
- `src/components/ui/textarea.tsx` (Created)
- `src/app/editor/_components/workflow-canvas.test.tsx` (Created)
- `vitest.config.ts` (Created)
- `src/test/setup.ts` (Created)
