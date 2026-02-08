# Story 2.3: Workflow Serialization & Auto-Save

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want my visual design to be automatically saved as a JSON schema,
so that I don't lose my work and the engine can execute it later.

## Acceptance Criteria

1. **Given** the user has modified the canvas (moved nodes, added edges)
2. **When** a "Save" event is triggered (manual or debounced auto-save)
3. **Then** the React Flow state is transformed into the platform's Workflow JSON format (Normalizing nodes and edges)
4. **And** the JSON is successfully stored in the PostgreSQL database via a tRPC call.
5. **And** a visual indicator (e.g., "Saved" or "Saving...") is displayed to provide feedback to the user.

## Tasks / Subtasks

- [x] Task 1: Define Update Schema and tRPC Procedure (AC: 4)
  - [x] Add `UpdateWorkflowSchema` to `src/types/workflow.ts` that includes matching `nodes` and `edges` as `z.any()` (or more specific if possible).
  - [x] Implement `update` mutation in `src/server/api/routers/workflow.ts`.
  - [x] Ensure only the owner can update the workflow.
- [x] Task 2: Implement Debounced Auto-Save in Canvas (AC: 1, 2)
  - [x] Use `useDebounce` hook or a similar mechanism in `src/app/editor/_components/workflow-canvas.tsx`.
  - [x] Trigger the tRPC `update` mutation whenever `nodes` or `edges` changes (excluding `onNodesChange`/`onEdgesChange` which might fire too often during dragging, consider focusing on `onNodeDragStop` and `onConnect`).
- [x] Task 3: Transformation & Feedback (AC: 3, 5)
  - [x] Ensure the serialized JSON matches the `Workflow` model expectations in Prisma.
  - [x] Add a small status indicator in the editor UI to show the current sync status (Saved, Saving, Error).

## Dev Notes

- **Architecture Compliance**:
  - Follow the `src/server/api/routers/workflow.ts` pattern for tRPC procedures.
  - Use Prisma for database operations as defined in `prisma/schema.prisma`.
  - Maintain the pure logic separation where possible (though this is primarily integration).
- **Source Tree Components**:
  - `src/server/api/routers/workflow.ts`
  - `src/app/editor/_components/workflow-canvas.tsx`
  - `src/types/workflow.ts`
- **Previous Story Learnings (Story 2.2)**:
  - React Flow v12 handles the state via `useNodesState` and `useEdgesState`.
  - IDs are generated using `crypto.randomUUID()`.

### Project Structure Notes

- Canvas component: `src/app/editor/_components/workflow-canvas.tsx`
- tRPC Router: `src/server/api/routers/workflow.ts`
- Types: `src/types/workflow.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: prisma/schema.prisma]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Flash)

### Debug Log References

- Encountered "Type instantiation is excessively deep" error in `workflow-canvas.tsx` due to complex tRPC/Zod types; suppressed with `@ts-expect-error` after verifying runtime safety.
- Fixed `useNodesState`/`useEdgesState` type inference by adding explicit generic types.
- Handled `Json` to `Node[]`/`Edge[]` conversion with intermediate `unknown` cast as required by TypeScript.

### Completion Notes List

- [x] Implemented `UpdateWorkflowSchema` in `src/types/workflow.ts` for type-safe saves.
- [x] Added `update` mutation to `src/server/api/routers/workflow.ts` with ownership checks.
- [x] Created `useDebounce` hook in `src/hooks/use-debounce.ts`.
- [x] Integrated debounced auto-save in `src/app/editor/_components/workflow-canvas.tsx`, triggering on node/edge changes.
- [x] Added a visual sync status indicator (Saved, Saving, Error) in the editor panel.
- [x] Ensured initial workflow state is correctly rehydrated from the database on editor load.

### File List

- `src/server/api/routers/workflow.ts` (Modified)
- `src/app/editor/_components/workflow-canvas.tsx` (Modified)
- `src/types/workflow.ts` (Modified)
- `src/hooks/use-debounce.ts` (Created)
- `_bmad-output/implementation-artifacts/2-3-workflow-serialization-auto-save.md` (Modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (Modified)
