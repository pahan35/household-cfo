# Tasks

## 1. Zod Environment Schemas & Test Isolation Helpers

- [ ] 1.1 Create `src/config/env.server.ts` with `serverEnvSchema`, `superRefine()` cross-variable guards (E2E branch enforces mock, mock URL cannot match prod URL, production forbids mock mode and requires `AUTH_SECRET` >= 32 chars), `validateServerEnv()`, and lazy `getServerEnv()`; verify with unit tests in `src/config/__tests__/env.server.test.ts`
- [ ] 1.2 Create `src/config/env.client.ts` with `clientEnvSchema` validating safe `NEXT_PUBLIC_*` properties without leaking server secrets; verify with unit tests in `src/config/__tests__/env.client.test.ts`

## 2. Integration & Build-Time Fail-Closed Guard

- [ ] 2.1 Update `next.config.mjs` to execute `validateServerEnv(process.env)` during `next build` so invalid configurations halt deployment before traffic is served; verify build validation with unit tests in `src/config/__tests__/build-validation.test.ts`
- [ ] 2.2 Refactor `src/server/supabase/config.ts` and `src/server/auth/config.ts` to consume typed environment properties from `getServerEnv()` while preserving parameter-injection signatures for existing unit test isolation; verify with `src/server/supabase/__tests__/config.test.ts` and `src/server/auth/__tests__/config.test.ts`

## 3. End-to-End Blast-Radius & System Verification

- [ ] 3.1 Verify that the mock adapter reset endpoint (`POST /api/v1/external-provider/mock/reset`) inferrably verifies mock adapter mode and mock Supabase persistence; verify with unit tests in `src/app/api/v1/__tests__/routes.test.ts`
- [ ] 3.2 Run full test suite (`npm test`) and strict static checks (`npm run verify`) to ensure zero regressions across all domain stores, auth flows, and configurations
