# Design

## Context

See `proposal.md` for background. Server modules currently inspect `process.env` directly with ad-hoc trimming and custom parsing. With the introduction of the ExternalProvider mock adapter and E2E isolation environments, cross-variable assertions (e.g. guaranteeing that mock runs never target production database URLs, and that E2E branches mandate mock mode) are essential to prevent data corruption.

## Goals / Non-Goals

**Goals:**
- Provide a single, centralized Zod schema for all server environment variables (`src/config/env.server.ts`) guarded by `import "server-only"`.
- Provide a dedicated client-safe schema (`src/config/env.client.ts`) for `NEXT_PUBLIC_*` variables.
- Enforce cross-variable invariants via `superRefine()`:
  - Branch `e2e` mandates `EXTERNAL_API_ADAPTER="mock"`.
  - In mock mode, `SUPABASE_MOCK_URL` cannot equal `SUPABASE_URL`.
  - Production deployments forbid `EXTERNAL_API_ADAPTER="mock"`, forbid `AUTH_BYPASS_LOCAL="true"`, and require `AUTH_SECRET` >= 32 chars.
- Execute validation during `next build` inside `next.config.mjs` to fail fast before traffic is served.
- Support test isolation by exposing a pure `validateServerEnv(customEnv)` function alongside the lazy `serverEnv` singleton.

**Non-Goals:**
- Adding third-party packages like `@t3-oss/env-nextjs` (native Zod provides all required functionality with zero extra dependencies).
- Modifying client components or rewriting internal store logic beyond delegating env checks to the centralized configuration.

## Decisions

### Decision 1: Pure Native Zod Implementation
- **Rationale**: `zod: ^4.6.7` is already installed in the repo. Writing a native wrapper avoids adding external dependencies while giving us complete flexibility over `superRefine` error messaging and Next.js server-only boundaries.
- **Alternative considered**: `@t3-oss/env-nextjs`. Rejected because it introduces unnecessary dependency overhead and is less flexible for Vitest unit test isolation where tests test various environment permutations without restarting the process.

### Decision 2: Dual Export Pattern for Test Ergonomics
- **Rationale**: In Vitest, dozens of unit tests test specific edge cases (missing secrets, invalid adapter modes, preview origins) by injecting custom dictionaries. If the environment is parsed once into a frozen global singleton at module load time, those tests cannot safely test alternative states.
- **Pattern**:
  ```ts
  export function validateServerEnv(env: Record<string, string | undefined> = process.env): ServerEnv { ... }
  export const getServerEnv = (): ServerEnv => validateServerEnv(process.env);
  ```
- **Alternative considered**: Global mutable singleton or proxy. Rejected as fragile and error-prone under concurrency.

### Decision 3: Cross-Variable Safety Guards via `superRefine`
- **E2E Branch Safety**: If `VERCEL_GIT_COMMIT_REF === "e2e"`, `EXTERNAL_API_ADAPTER` must be `"mock"`.
- **Database Isolation Guard**: If `EXTERNAL_API_ADAPTER === "mock"`, any configured `SUPABASE_MOCK_URL` must not have the same host/URL as `SUPABASE_URL`.
- **Production Safety**: If `VERCEL_ENV === "production"` or `NODE_ENV === "production"`, `EXTERNAL_API_ADAPTER` cannot be `"mock"`, `AUTH_BYPASS_LOCAL` cannot be `"true"`, and `AUTH_SECRET` must be at least 32 characters long.

### Decision 4: Compile-Time Client Boundary Separation
- **Rationale**: Client components must only access variables prefixed with `NEXT_PUBLIC_*`. Bundlers inline these at build time. Creating `src/config/env.client.ts` ensures client code never imports `src/config/env.server.ts` (which includes `import "server-only"`).

## Risks / Trade-offs

- **[Risk] CI / Local Build Fails on Missing Optional Secrets** → *Mitigation*: Sensible defaults for development (`EXTERNAL_API_ADAPTER="external-provider"`, `EXTERNAL_API_SECRET_SOURCE="keychain"`, optional Supabase URLs with fallback to local JSON/memory stores).
- **[Risk] Test Runner Environment Pollution** → *Mitigation*: Tests call `validateServerEnv(customDict)` directly, leaving `process.env` clean.

## Migration Plan

1. Implement `src/config/env.server.ts` and `src/config/env.client.ts` with comprehensive unit tests.
2. Hook `validateServerEnv(process.env)` into `next.config.mjs` replacing the single-purpose `validateNextConfigAuth` function.
3. Update `src/server/supabase/config.ts` and `src/server/auth/config.ts` to delegate environment reads through the validated server environment.
4. Run static validation (`npm run verify`) and full test suite (`npm test`).
