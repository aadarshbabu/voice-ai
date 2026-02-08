# Story 8.3: Webhook Trigger Node

Status: review

## Story

As a developer,
I want to trigger my workflows via external HTTP webhooks,
so that I can integrate my voice agents with third-party systems like CRMs, payment gateways, or custom automated scripts.

## Acceptance Criteria

1. [x] **New Node Type**: Implementation of a `webhook` node type in the Visual Editor palette and workflow engine.
2. [x] **Node Configuration Profile**:
   - `slug`: A unique URL path segment (e.g., `stripe-payment-success`) used to identify the webhook endpoint.
   - `authType`: Support for `None` or `Bearer Token` authentication.
   - `sharedSecret`: Secure storage (encrypted in DB) for the Bearer token.
   - [x] `variableMapping`: Ability to map JSON payload fields to workflow variables using JSONPath/dot-notation (e.g., `$.body.user.id` -> `user_id`).
3. [x] **Webhook API Endpoint**:
   - Implementation of a public route `/api/webhooks/[slug]` (supporting POST and GET).
   - The route must look up the published workflow associated with the provided slug.
   - If the request is valid (passes auth), it should either:
     - Start a new session if the Webhook node is the Start/Trigger node.
     - Resume an active session if a `sessionId` is provided in the headers or payload and the session is currently waiting at this Webhook node.
4. [x] **Engine Support**:
   - Update `src/lib/engine/runner.ts` to handle the `WEBHOOK` node type.
   - If reached during execution, the engine should transition to a `waiting` state with action type `wait_for_webhook`.
5. [x] **Durable Execution & Observability**:
   - The webhook request body and headers must be saved into the `ExecutionContext` variables for use in subsequent nodes (interpolation).
   - The webhook entry must be visible in the session trace UI.

## Tasks / Subtasks

- [x] **Core Types & Constants** (AC: 1)
  - [x] Add `WEBHOOK` to `NODE_TYPES` in `src/types/nodes.ts`.
  - [x] Define `DEFAULT_NODE_DATA` for the Webhook node.
  - [x] Update `src/lib/engine/types.ts` with `WebhookNodeData` schema.
- [x] **Visual Editor UI** (AC: 2)
  - [x] Create `WebhookNode` component for React Flow.
  - [x] Implement configuration form in the right drawer (slug, auth, mapping).
  - [x] Add validation to ensure slug is set and unique within the workflow.
- [x] **Webhook Gateway Route** (AC: 3, 5)
  - [x] Create `src/app/api/webhooks/[slug]/route.ts`.
  - [x] Implement workflow lookup by slug (Prisma).
  - [x] Implement auth validation (Bearer token check).
  - [x] Implement session start/resume logic via engine runner.
- [x] **Engine Logic** (AC: 4)
  - [x] Add `WEBHOOK` case to `advanceWorkflowAsync` in `src/lib/engine/runner.ts`.
  - [x] Handle variable mapping from request payload to engine context.
  - [x] Implement `wait_for_webhook` action return.
- [x] **Database Schema Update** (AC: 2)
  - [x] Update Prisma schema to support `webhook` related fields if necessary (or verify they fit in `nodes` JSON).
  - [x] *Note: Since node data is stored as JSON in the database, no schema change might be needed, but verify `sharedSecret` encryption requirement.*

## Dev Notes

### Architecture Patterns
- **Trigger Pattern**: Webhooks are triggers. If a Webhook node is the `Start` node, the gateway starts a session.
- **Wait Pattern**: If a Webhook node is in the middle of a flow, it behaves like a `Listen` node but for external HTTP events.
- **Security**: Webhook secrets are encrypted in the database using the AES-256-GCM utility in `workflow` tRPC router.

### Source Tree Components
- `src/types/nodes.ts`: Node type definitions.
- `src/lib/engine/types.ts`: Engine schemas.
- `src/lib/engine/runner.ts`: Execution logic.
- `src/app/api/webhooks/[slug]/route.ts`: NEW Route.
- `src/components/flow/`: UI implementation.

### Testing Standards
- Unit tests for JSONPath mapping logic (integrated into runner).
- Integration test for the webhook endpoint.

## Project Structure Notes
- The new route fits in `src/app/api/webhooks`.
- The engine logic remains isolated in `src/lib/engine`.

## References
- [Source: src/lib/engine/runner.ts#L104] - Existing Trigger node logic.
- [Source: src/app/api/voice/command/route.ts] - Reference for workflow triggering from API.
- [Architecture Document#A-Integration-Layer] - For adapter patterns.

## Dev Agent Record

### Agent Model Used
BMad-Dev (via Antigravity)

### Debug Log References
- Added Webhook node to palette and config drawer.
- Implemented `/api/webhooks/[slug]` route with search-in-json logic.
- Implemented encryption/decryption in tRPC router for `sharedSecret`.
- Updated Inngest `executeWorkflow` to respect `triggerNodeId`.

### Completion Notes List
- [x] All ACs satisfied.
- [x] Encryption working for secrets.
- [x] Manual trigger and resume working via curl tests.

### File List
- `src/types/nodes.ts`
- `src/lib/engine/types.ts`
- `src/lib/engine/runner.ts`
- `src/app/editor/_components/nodes/base-node.tsx`
- `src/app/editor/_components/nodes/webhook-config.tsx`
- `src/app/editor/_components/node-config-drawer.tsx`
- `src/app/editor/_components/node-palette.tsx`
- `src/app/api/webhooks/[slug]/route.ts`
- `src/server/api/routers/workflow.ts`
- `src/server/inngest/functions.ts`
