# Story 1.2: Create New Workflow Draft

Status: done

## Story

As a platform user,
I want to create a new voice agent project,
so that I can start designing a new conversation flow.

## Acceptance Criteria

1. **Given** the user is on the dashboard
2. **When** they click "Create New Workflow" and provide a name
3. **Then** a new workflow record is created in PostgreSQL with status `DRAFT`
4. **And** the user is redirected to the `/editor/[id]` page

## Tasks / Subtasks

- [x] Task 1: Database Schema & Migration (AC: 3)
  - [x] Add `Workflow` model to `prisma/schema.prisma` with fields: `id`, `name`, `status` (Enum: DRAFT, PUBLISHED), `version`, `nodes` (JSON), `edges` (JSON), `userId`, `orgId`, `createdAt`, `updatedAt`.
  - [x] Run `npx prisma migrate dev --name add_workflow_model`. (Note: Used db push due to migration drift)
- [x] Task 2: Backend tRPC Mutation (AC: 3)
  - [x] Create `src/server/api/routers/workflow.ts` (if not exists) and add `create` mutation. (Note: Exists at `src/server/routers/workflow.ts`)
  - [x] Use Zod for validation (name: string, description: string).
  - [x] Ensure `userId` and `orgId` are captured from `ctx.auth` (Note: Using Better Auth `ctx.user.id`, `orgId` currently null as orgs not yet configured).
  - [x] Initialize `nodes` and `edges` as empty arrays `[]`.
- [x] Task 3: Dashboard UI Implementation (AC: 1, 2)
  - [x] Create a `CreateWorkflowDialog` component using shadcn/ui `Dialog`.
  - [x] Implement a simple form with `name` field using `react-hook-form` and `zod`.
  - [x] Add the "Create New Workflow" button to the `/dashboard` page.
- [x] Task 4: Navigation & Redirect (AC: 4)
  - [x] On successful tRPC mutation, use `router.push('/editor/' + workflowId)` from `next/navigation`.
  - [x] Create a placeholder page at `src/app/editor/[id]/page.tsx` to handle the redirect.

## Dev Notes

- **Tech Stack**: Next.js 15, Prisma, tRPC, Better Auth, shadcn/ui.
- **Patterns**: tRPC mutations for data integrity; Zod for schema validation.
- **Naming**: `Workflow` model in Prisma (PascalCase), `create` procedure in tRPC (camelCase).
- **Security**: All workflow operations must be scoped to the `userId`.

### Project Structure Notes

- `src/server/routers/workflow.ts` - tRPC router for workflow operations.
- `src/app/dashboard/_components/create-workflow-dialog.tsx` - UI component for the creation flow.
- `src/app/dashboard/_components/create-workflow-button.tsx` - Dialog trigger.

### References

- [Source: .github/workflow_based_voice_ai_agent_platform_project_plan.md#Workflow Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash

### Debug Log References

- Schema drift resolved via `npx prisma db push`.
- tRPC 11 mutation pattern adjusted to use `useMutation(trpc.procedure.mutationOptions())`.
- Redirect implemented to `/editor/[id]` with placeholder page.
- **Review Follow-up**: Fixed security leak in `list` procedure.
- **Review Follow-up**: Connected dashboard to real tRPC `workflow.list` using new `WorkflowTable` component.
- **Review Follow-up**: Relocated routers to `src/server/api/routers` for architectural consistency.
- **Review Follow-up**: Consolidated Zod schemas into `src/types/workflow.ts`.

### Completion Notes List

- [x] Workflow model updated with `orgId`, `version`, and `PUBLISHED` status.
- [x] Dashboard now shows REAL workflows from the database.
- [x] "Create New Workflow" button opens a dialog and updates the table on success.
- [x] Successful creation redirects to the editor placeholder.
- [x] All procedures are protected and filtered by `userId`.

### File List

- `prisma/schema.prisma`
- `src/app/dashboard/page.tsx` (Modified)
- `src/app/dashboard/_components/create-workflow-dialog.tsx` (Modified)
- `src/app/dashboard/_components/create-workflow-button.tsx` (Modified)
- `src/app/dashboard/_components/workflow-table.tsx` (New)
- `src/app/editor/[id]/page.tsx` (New)
- `src/server/api/routers/workflow.ts` (Relocated & Modified)
- `src/server/api/routers/_app.ts` (Relocated & Modified)
- `src/types/workflow.ts` (New)
- `src/lib/trpcClient.ts` (Modified)
- `src/server/trpc/server.tsx` (Modified)
