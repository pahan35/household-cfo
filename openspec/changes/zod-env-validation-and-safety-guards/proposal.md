# Proposal

## Why

Currently, environment variables are parsed in an ad-hoc, decentralized fashion across various server modules with lazy discovery of misconfigurations at runtime. Crucially, as the switchable ExternalProvider mock adapter and E2E isolation support are introduced, there are no cross-variable schema assertions preventing critical human errors—such as running E2E tests against production Supabase databases due to an omitted `EXTERNAL_API_ADAPTER="mock"`, or pointing `SUPABASE_MOCK_URL` to the production database host. Wrapping environment parsing with a centralized Zod schema and build-time validation eliminates these failure modes and guarantees end-to-end blast-radius containment.

## What Changes

- **Centralized Server and Client Zod Environment Schemas**: Introduce `src/config/env.server.ts` and `src/config/env.client.ts` defining strict Zod schemas for all runtime, auth, persistence, mobile API, and ExternalProvider configuration variables.
- **Cross-Variable E2E and Production Safety Guards (`superRefine`)**:
  - Enforce `EXTERNAL_API_ADAPTER="mock"` whenever deploying to the Vercel E2E branch (`VERCEL_GIT_COMMIT_REF="e2e"`).
  - Explicitly reject configurations where `SUPABASE_MOCK_URL` equals `SUPABASE_URL` in mock mode, preventing accidental production database destruction.
  - Reject `EXTERNAL_API_ADAPTER="mock"` on production deployments (`VERCEL_ENV="production"`).
  - Fail closed if `AUTH_BYPASS_LOCAL="true"` or if `AUTH_SECRET` is shorter than 32 characters in production.
- **Fail-Fast Build Validation**: Update `next.config.mjs` to execute `validateServerEnv(process.env)` during `next build`, halting invalid deployments before traffic is served.
- **Isolated Unit Testing Ergonomics**: Export both a lazily evaluated typed `serverEnv` singleton and a pure `validateServerEnv(customEnv)` function so Vitest test suites can test configuration permutations cleanly without mutating global state.

## Capabilities

### New Capabilities
- `env-validation-and-safety-guards`: Centralized Zod schema validation for server and client environment variables, build-time next.config guards, and test-isolated validation helpers.

### Modified Capabilities
- `external-provider-mock-adapter`: Extend mock adapter configuration requirements to enforce `EXTERNAL_API_ADAPTER="mock"` when `VERCEL_GIT_COMMIT_REF="e2e"` and forbid identical URLs for `SUPABASE_MOCK_URL` and `SUPABASE_URL`.

## Impact

- **Configuration & Build**: Updates `next.config.mjs` to validate environment via Zod on build; creates `src/config/env.server.ts` and `src/config/env.client.ts`.
- **Server Configs**: Refactors `src/server/supabase/config.ts` and `src/server/auth/config.ts` to consume validated environment data from the centralized schemas.
- **Dependencies**: Leverages existing `zod: ^4.6.7` with zero additional npm packages.
