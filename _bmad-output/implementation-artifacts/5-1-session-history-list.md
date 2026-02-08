# Story 5.1: Session History & List

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to see a history of all conversations my agent has had,
so that I can review its performance and debug issues.

## Acceptance Criteria

1. **Given** a user is on the "Sessions" tab for a workflow
2. **When** the page loads
3. **Then** they see a table of past sessions with metadata (Session ID, Start Time, Duration, Status)
4. **And** the list is filterable by status (Ended, Error, Active)
5. **And** clicking a session row navigates to the session detail view (Story 5.2)

## Tasks / Subtasks

- [x] Task 1: Database Schema (AC: 1-5)
  - [x] Add `WorkflowSession` model to `prisma/schema.prisma`.
  - [x] Fields: `id` (cuid), `workflowId` (relation), `status` (enum: ACTIVE, COMPLETED, ERROR), `startedAt`, `endedAt`, `metadata` (Json).
  - [x] Run `npx prisma generate`.
- [x] Task 2: API Layer (AC: 2, 4)
  - [x] Create `src/server/api/routers/workspace-session.ts` (using prefix to distinguish from auth sessions).
  - [x] Implement `list` procedure: input `{ workflowId: string, status?: SessionStatus }`.
  - [x] Add to `root.ts`.
- [x] Task 3: UI Layer - Sessions Tab (AC: 1, 3, 4)
  - [x] Implement `SessionsTab` in `src/app/editor/[id]/_components/sessions-tab.tsx`.
  - [x] Use `shadcn/ui` DataTable for the list.
  - [x] Add a status filter dropdown.
  - [x] Integrate into the main Editor layout (new tab).

## Dev Notes

- **Naming Conflict**: Avoid using `Session` as the model name as it's already used for auth sessions. Use `WorkflowSession`.
- **Architecture**: Follow the pattern defined in `architecture.md` for tRPC procedures (`workflowSession.list`).
- **File Locations**: UI components should be in `src/app/editor/[id]/_components/`.

### Project Structure Notes

- Alignment with `src/server/api/routers/` for backend.
- UI co-located in editor feature folder.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5: Observability & Execution Trace UI]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Thinking)

### Debug Log References

### Completion Notes List

### File List

- `prisma/schema.prisma`
- `src/server/api/routers/workspace-session.ts`
- `src/server/api/routers/_app.ts`
- `src/app/editor/[id]/_components/sessions-tab.tsx`
- `src/app/editor/[id]/page.tsx`
