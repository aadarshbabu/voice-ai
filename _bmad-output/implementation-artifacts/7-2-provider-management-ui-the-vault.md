# Story 7.2: Provider Management UI (The Vault)

Status: review

## Story

As a platform user,
I want a secure settings page to input my AI provider keys,
so that I can enable voice features for my workflows on demand.

## Acceptance Criteria

1. Secure settings page at `/dashboard/vault`.
2. UI supports configuring Google, ElevenLabs, OpenAI, and Deepgram.
3. Form fields include API Key (masked), Base URL, and provider-specific fields (e.g., Voice ID for ElevenLabs).
4. Keys are encrypted and saved via the `voiceProvider` tRPC router.
5. UI displays "Configured" status for providers with existing credentials.

## Tasks / Subtasks

- [x] Update `Vault` page to use `voiceProvider` tRPC router (AC: 4)
  - [x] Switch from `credentials` router to `voiceProvider` router
  - [x] Update data fetching and mutation calls
- [x] Refine Provider List and Cards (AC: 2, 3, 5)
  - [x] Add ElevenLabs and Deepgram to the provider list
  - [x] Update `ProviderCard` to support specific fields (Voice ID, Region)
  - [x] Ensure masking and security placeholders match the encrypted nature
- [x] Add Form Validation (AC: 3)
  - [x] Validate required fields (API Key) before submission
- [x] Implement Delete/Reset (AC: 4)
  - [x] Allow users to remove credentials securely

## Dev Notes

- The page already exists at `src/app/dashboard/vault/page.tsx`, but it's using the old `credentials` router.
- Use `ProviderType` enum from Prisma for consistent keys.
- ElevenLabs needs `voiceId` support in the config object.

### Project Structure Notes

- Main Page: `src/app/dashboard/vault/page.tsx`
- TRPC Router: `src/server/api/routers/voice-providers.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Vault UI Specifications]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7: Provider Configuration & Vault]

## Dev Agent Record

### Agent Model Used
Antigravity-v1

### Debug Log References
- UI migrated to trpc.voiceProvider.list/save/delete
- Manual verification of form layouts for ElevenLabs (voiceId) and Google (region)

### Completion Notes List
- Migrated Vault UI to use encrypted ProviderConfig schema via tRPC.
- Added visual branding/icons for OpenAI, Google, ElevenLabs, and Deepgram.
- Implemented provider-specific fields (Voice ID for ElevenLabs, Region for Google/Deepgram).
- Ensured security-first UI (no plaintext keys shown, encrypted at rest).

### File List
- src/app/dashboard/vault/page.tsx
