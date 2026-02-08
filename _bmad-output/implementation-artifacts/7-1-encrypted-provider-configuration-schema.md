# Story 7.1: Encrypted Provider Configuration Schema

Status: review

## Story

As a system administrator,
I want to store AI provider credentials in an encrypted database table,
so that I can configure providers at runtime without sensitive data exposure.

## Acceptance Criteria

1. PostgreSQL database with Prisma updated with `provider_configs` table.
2. `provider_configs` table supports `providerType`, `encryptedConfig`, and `isDefault`.
3. A crypto utility implemented using `node:crypto` to encrypt/decrypt the `config_data` using a server-side `ENCRYPTION_KEY`.
4. Encryption uses AES-256-GCM for security.

## Tasks / Subtasks

- [x] Update Prisma schema with `ProviderConfig` model (AC: 1, 2)
  - [x] Add `ProviderType` enum (GOOGLE, ELEVENLABS, OPENAI, etc.)
  - [x] Add `ProviderConfig` model with fields: id, providerType, encryptedConfig, isDefault, userId, orgId, createdAt, updatedAt
  - [x] Run Prisma migration
- [x] Implement Encryption Utility (AC: 3, 4)
  - [x] Create `src/lib/crypto.ts`
  - [x] Implement `encrypt` function using AES-256-GCM
  - [x] Implement `decrypt` function using AES-256-GCM
  - [x] Add `ENCRYPTION_KEY` to `.env` validation
- [x] Create Provider Config Repository/Service (AC: 3)
  - [x] Implement helper to save/load configs with auto-encryption/decryption

## Dev Notes

- Use `aes-256-gcm` as specified in the architecture.
- Store IV and Auth Token alongside the ciphertext.
- Ensure the `ENCRYPTION_KEY` is a 32-byte hex string.

### Project Structure Notes

- Crypto utility: `src/lib/crypto.ts`
- Prisma Schema: `prisma/schema.prisma`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture Updates]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7: Provider Configuration & Vault]

## Dev Agent Record

### Agent Model Used
Antigravity-v1

### Debug Log References
- Prisma migration successful (add_provider_config)
- Crypto unit tests passed (src/lib/crypto.test.ts)

### Completion Notes List
- Implemented AES-256-GCM encryption utility.
- Added ENCRYPTION_KEY to .env.
- Updated Prisma schema with ProviderConfig model.
- Created VoiceProviderService and voiceProviderRouter.

### File List
- prisma/schema.prisma
- src/lib/crypto.ts
- src/lib/crypto.test.ts
- src/server/services/voice-provider-service.ts
- src/server/api/routers/voice-providers.ts
- src/server/api/routers/_app.ts
