# Tasks

## 1. Auth Configuration & Fail-Closed Vercel Guard

- [x] 1.1 Create `src/server/auth/config.ts` implementing `ALLOWED_USER_EMAILS` parsing, `AUTH_BYPASS_LOCAL` resolution (default `"true"` in local non-Vercel dev, `"false"` to test OAuth locally), and the hard fail-closed guard when `process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV) || process.env.NODE_ENV === "production"`; verify with unit tests in `src/server/auth/__tests__/config.test.ts`.
- [x] 1.2 Add a build-time guard in `next.config.mjs` that throws a fatal error if `VERCEL === "1"` (or `VERCEL_ENV` is set) and `AUTH_BYPASS_LOCAL === "true"`; verify via config unit tests and `npm run verify`.

## 2. Stateless Google OAuth & Session Management

- [x] 2.1 Implement stateless signed/encrypted `HttpOnly` session cookie creation, verification, and clearing in `src/server/auth/session.ts` (re-checking that the session email is present in `ALLOWED_USER_EMAILS` on every verification); verify with unit tests in `src/server/auth/__tests__/session.test.ts`.
- [x] 2.2 Implement Google OAuth 2.0 / OIDC login initiation, callback verification (`email_verified === true` + `ALLOWED_USER_EMAILS` check), and sign-out route handlers under `src/app/api/auth/[...auth]/route.ts` (redirecting non-allowlisted accounts to `/unauthorized`); verify with route handler unit tests.

## 3. Proxy & API Route Protection

- [x] 3.1 Replace `src/proxy.disabled.ts` with active `src/proxy.ts` that enforces session or local-bypass authentication across all page routes (redirecting unauthenticated users to `/auth/login`) and returns `401 Unauthorized` for unauthenticated `/api/external-provider/*` requests; verify with unit tests.
- [x] 3.2 Add defense-in-depth session/bypass verification at the start of `src/app/api/external-provider/[...path]/route.ts` before any ExternalProvider secret resolution; verify with `src/server/external-provider/__tests__/proxy-route.test.ts`.

## 4. Login UI & Documentation

- [x] 4.1 Create the Google-only login screen at `src/app/(main)/auth/login/page.tsx`, redirect legacy `/auth/v1/*` and `/auth/v2/*` routes to `/auth/login`, and update `src/app/(main)/unauthorized/page.tsx` with a link back to `/auth/login`; verify with `npm run verify`.
- [x] 4.2 Document `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `ALLOWED_USER_EMAILS`, and `AUTH_BYPASS_LOCAL` placeholders in `.env.example` and `.agents/rules/secrets.md`; verify with `npm run verify` and `npm test`.
