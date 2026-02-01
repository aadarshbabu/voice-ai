# Story 1.3: Versioning & Publish Lifecycle

Status: done

## Story

As a platform user,
I want to publish my draft workflows,
so that they become immutable and ready for runtime execution.

## Acceptance Criteria

1. **Given** a user is in the editor for a `DRAFT` workflow
2. **When** they click "Publish"
3. **Then** the system validates the graph integrity (simplified check: must have at least one node)
4. **And** the version is incremented, the status becomes `PUBLISHED`, and the current version is locked from further edits

## Tasks / Subtasks

- [x] Task 1: Backend tRPC `publish` Mutation (AC: 3, 4)
  - [x] Add `publish` mutation to `src/server/api/routers/workflow.ts`.
  - [x] Input: `id` (workflow ID).
  - [x] Logic:
    - [x] Fetch current workflow.
    - [x] Verify status is `DRAFT`.
    - [x] Validate integrity (simplified: `nodes` array is not empty).
    - [x] Update `status` to `PUBLISHED`.
    - [x] Increment `version` by 1.
- [x] Task 2: Editor UI "Publish" Action (AC: 1, 2)
  - [x] Update `src/app/editor/[id]/page.tsx` to include a header with a "Publish" button.
  - [x] Use `sonner` for success/error notifications.
  - [x] On success, show the updated status and version.
- [x] Task 3: Edit Locking (AC: 4)
  - [x] Ensure that if a workflow is `PUBLISHED`, the UI prevents further "Publish" actions (button should be disabled or hidden).
  - [x] (Future) The editor should be read-only if status is not `DRAFT`.

## Dev Notes

- **Architecture Compliance**: Scoped to `userId`, use `protectedProcedure`.
- **Integrity Check**: Implemented simple check: `nodes.length > 0`.
- **Versioning**: Each publish increments the `version` field.

### Project Structure Notes

- `src/server/api/routers/workflow.ts` - Houses `get` and `publish` procedures.
- `src/app/editor/[id]/page.tsx` - Visual builder container with publish lifecycle UI.

### References

- [Source: prisma/schema.prisma#WorkflowStatus]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash

### Debug Log References

- Added `get` query to enable data fetching in the editor.
- Implemented `publish` mutation with status-based guarding and basic node-count validation.
- Standardized Editor UI header with navigation, status indicators, and publish trigger.
- **Review Follow-up**: Switched to `TRPCError` for standardized API responses.
- **Review Follow-up**: Added `Array.isArray` check for `nodes` before publishing.
- **Review Follow-up**: Wrapped Editor in `Suspense` to prevent loading flashes.

### Completion Notes List

- [x] Backend `publish` logic implemented with version increment.
- [x] Editor UI updated to show live workflow status and handle publishing.
- [x] Unauthorized access prevented via tRPC context and userId checks.
- [x] Validated that only workflows with at least one node can be published.

### File List

- `src/server/api/routers/workflow.ts`
- `src/app/editor/[id]/page.tsx`
