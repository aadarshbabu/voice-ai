# Story 1.4: LLM Credentials Vault & Mistral Support

Status: review

## Story

As a platform user,
I want to securely store my own API keys for various LLM providers and use Mistral models,
So that I can bring my own billing and use the models I prefer.

## Acceptance Criteria

1.  **Vault UI:**
    *   Create a new "Settings" or "Vault" page/tab in the Dashboard.
    *   Allow users to input and save API keys for: OpenAI, Anthropic, Google Gemini, and **Mistral**.
    *   Keys should be masked in the UI (only show last 4 chars if possible, or just masked input).
    *   Store these keys associated with the user/organization in the database.

2.  **Database Schema:**
    *   Update Prisma schema to include a model for `LLMCredential` or similar.
    *   Fields: `id`, `userId` (or `orgId`), `provider`, `model`,  (enum: OPENAI, ANTHROPIC, GOOGLE, MISTRAL), `apiKey` (text).
    *   *(Note: For MVP, simple storage is acceptable, but encryption is recommended if possible/easy).*

3.  **Mistral Integration:**
    *   Implement `MistralProvider` in `src/lib/engine/providers/llm.ts`.
    *   Support `generateResponse` and `generateDecision` interfaces.
    *   Default model: `mistral-medium-latest`.
    *   Handle API errors and rate limits gracefully.

4.  **Engine Integration:**
    *   Update `callLLM` and `callLLMDecision` to look up the user's API key from the database if not provided in the `config` object directly (or if the `config` specifies to use the stored vault key).
    *   Ensure the `provider` factory supports 'mistral'.

## Tasks / Subtasks

- [x] **Database & Backend**
    - [x] Update `schema.prisma` with `LLMCredential` model.
    - [x] Run `npx prisma db push`.
    - [x] Create tRPC router `credentials.ts` for CRUD operations (save, list status - *never return full key*).

- [x] **Mistral Implementation**
    - [x] Install Mistral SDK or use `fetch` with the `curl` example provided.
    - [x] Implement `MistralProvider` class in `llm.ts`.
    - [x] Add 'mistral' to the provider factory.

- [x] **Frontend - Vault Page**
    - [x] Create `/dashboard/settings` or similar route.
    - [x] Build a form with tabs/sections for each provider.
    - [x] Use `shadcn/ui` components (Input, Button, Card).
    - [x] Connect to `credentials.router` to save keys.

- [x] **Frontend - Workflow Editor**
    - [x] Update LLM Node config drawer (Node 3.2 logic) to populate the "Model" dropdown with Mistral options if selected.
    - [x] (Optional for this story, but ensure backend support) Ensure runtime fetches the key.

## File List

*   `prisma/schema.prisma`
*   `src/server/api/routers/credentials.ts`
*   `src/server/api/routers/_app.ts`
*   `src/lib/engine/types.ts`
*   `src/lib/engine/providers/llm.ts`
*   `src/server/inngest/functions.ts`
*   `src/app/dashboard/settings/page.tsx`
*   `src/app/editor/_components/nodes/llm-model-config.tsx`
*   `src/app/editor/_components/nodes/llm-reply-config.tsx`
*   `src/app/editor/_components/nodes/llm-decision-config.tsx`

## Change Log

*   **2026-02-05**: Added `LLMCredential` to schema and ran migration. Implemented `credentials` router. Added `MistralProvider` and DB lookup logic to engine. Created Settings page for Vault UI. Updated LLM node configs with Mistral support.

## Dev Notes

*   **Mistral API Details:**
    *   Endpoint: `https://api.mistral.ai/v1/chat/completions`
    *   Headers: `Authorization: Bearer $KEY`, `Content-Type: application/json`
    *   Body: `{ model: "mistral-medium-latest", messages: [...] }`
*   **Security:**
    *   Do NOT return the full API key to the client after saving. only return "Configured" status or last 4 chars.
    *   When the Engine runs (server-side), it will retrieve the cleartext key to make the API call.

### Project Structure Notes

*   Follow `src/server/api/routers/` for the new router.
*   Update `src/lib/engine/providers/llm.ts`.

### References

*   [Mistral API Docs](https://docs.mistral.ai/)
*   Existing `llm.ts` for Provider pattern.
