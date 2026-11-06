# Proposal

## Why

Deploying the family budget platform to Vercel requires strict access control so only the owner and his wife can access the dashboard and the `/api/external-provider/*` proxy. At the same time, local development on macOS must remain convenient by allowing a controllable local authentication bypass that is strictly impossible to enable on Vercel.

## What Changes

- Add Google OAuth authentication backed by stateless signed/encrypted `HttpOnly` session cookies and secret Vercel environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `ALLOWED_USER_EMAILS`).
- Restrict login exclusively to Google accounts with a verified email matching the comma-separated allowlist in `ALLOWED_USER_EMAILS`; reject all other Google accounts with an unauthorized response/page.
- Enable Next.js 16 request interception in `src/proxy.ts` (replacing `src/proxy.disabled.ts`) and defense-in-depth verification on `/api/external-provider/[...path]` so unauthenticated page requests redirect to `/auth/login` and unauthenticated API calls receive `401 Unauthorized`.
- Add a controllable local development bypass (`AUTH_BYPASS_LOCAL`, defaulting to `"true"` in local non-Vercel development so keychain-based local dev requires no login, and toggleable to `"false"` to test Google OAuth locally).
- Enforce a hard fail-closed guard on Vercel and production builds (`process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV) || process.env.NODE_ENV === "production"`): auth bypass is never permitted on Vercel, and setting `AUTH_BYPASS_LOCAL=true` in a Vercel/production environment fails closed at build/request time.
- Provide a clean Google-only login page and sign-out action, removing unused template email/password and registration entry points from the active auth flow.

## Capabilities

### New Capabilities
- `family-oauth-access-control`: Google OAuth authentication, strict email allowlist authorization (`ALLOWED_USER_EMAILS`), route/API proxy protection, controllable local dev bypass, and hard fail-closed Vercel enforcement.

### Modified Capabilities
<!-- None -->

## Impact

- `src/proxy.ts` (promoted from `src/proxy.disabled.ts`)
- `src/server/auth/` (config, session, Google OAuth handlers, allowlist check, Vercel fail-closed guard)
- `src/app/api/auth/[...auth]/route.ts` and `src/app/api/external-provider/[...path]/route.ts`
- `src/app/(main)/auth/` and `src/app/(main)/unauthorized/page.tsx`
- `.env.example` and `.agents/rules/secrets.md`
