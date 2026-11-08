# Tasks: Canonical OAuth Relay for Vercel Preview Deployments

## 1. Auth Configuration & Cryptographic State Utilities

- [x] 1.1 Add `AUTH_CANONICAL_URL` and `ALLOWED_PREVIEW_ORIGINS` configuration resolvers and origin matcher in `src/server/auth/config.ts`, and verify with unit tests in `src/server/auth/__tests__/config.test.ts` via `npx vitest run src/server/auth/__tests__/config.test.ts`.
- [x] 1.2 Implement HMAC-SHA256 signed OAuth state helpers (`createOAuthStateToken` and `verifyOAuthStateToken`) in `src/server/auth/session.ts`, and verify tamper resistance and expiration checks in `src/server/auth/__tests__/session.test.ts` via `npx vitest run src/server/auth/__tests__/session.test.ts`.

## 2. OAuth Route Relay Handshake

- [x] 2.1 Update `handleLogin` in `src/app/api/auth/[...auth]/route.ts` to use canonical redirect URI and signed state token when running on preview or non-canonical origins, and verify with unit tests in `src/app/api/auth/[...auth]/__tests__/route.test.ts`.
- [x] 2.2 Update `handleCallback` in `src/app/api/auth/[...auth]/route.ts` on the canonical host to intercept relay states, verify origin against allowlist, and 302 redirect code and state to preview callback, and verify with unit tests.

## 3. Preview Code Exchange & Verification

- [x] 3.1 Update `handleCallback` token exchange logic to pass canonical redirect URI when exchanging relayed codes on preview origins, verify `ALLOWED_USER_EMAILS`, and attach session cookie, and verify with route tests in `src/app/api/auth/[...auth]/__tests__/route.test.ts`.
- [x] 3.2 Update `.env.example` and `.agents/rules/secrets.md` documenting `AUTH_CANONICAL_URL` and `ALLOWED_PREVIEW_ORIGINS`, and run full quality gates via `npm run verify`.
