# Design

## Context

See `proposal.md` for motivation. Currently `src/proxy.disabled.ts` is inactive, `/api/external-provider/[...path]/route.ts` accepts unauthenticated requests, and the template auth pages under `src/app/(main)/auth/` are static UI mocks. Deploying to Vercel for two users (owner + wife) requires Google OAuth with a strict email allowlist stored in Vercel secret environment variables, while keeping local development frictionless and guaranteeing that local auth bypass can never be active on Vercel.

## Goals / Non-Goals

**Goals:**
- Stateless Google OAuth (OIDC) authentication using signed/encrypted `HttpOnly`, `Secure` (in prod), `SameSite=Lax` cookies—no database required.
- Strict verification against `ALLOWED_USER_EMAILS` (secret env var containing comma-separated allowed email addresses).
- Protect both UI routes (`src/proxy.ts`) and `/api/external-provider/[...path]/route.ts` (defense in depth).
- Local dev bypass (`AUTH_BYPASS_LOCAL`, default `"true"` in local dev, `"false"` to test OAuth locally) with a hard fail-closed guard on Vercel (`VERCEL === "1"`, `Boolean(process.env.VERCEL_ENV)`, or `NODE_ENV === "production"`).

**Non-Goals:**
- User registration, password authentication, or multi-tenant role management.

## Decisions

1. **Two-Layer Fail-Closed Guard Against Auth Bypass on Vercel**
   - *Rationale*: A local bypass flag is convenient for `npm run dev`, but dangerous if accidentally set in production. We enforce two independent safeguards:
     1. **Runtime Guard**: `isVercelOrProd()` checks `process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV) || process.env.NODE_ENV === "production"`. If `isVercelOrProd()` is true, auth bypass is impossible; furthermore, if `process.env.AUTH_BYPASS_LOCAL?.toLowerCase() === "true"` on Vercel, the guard throws a `FatalAuthConfigError` (`500`) and logs a critical security error.
     2. **Build-Time Guard in `next.config.mjs`**: If `process.env.VERCEL === "1"` and `process.env.AUTH_BYPASS_LOCAL?.toLowerCase() === "true"`, `next build` throws immediately so a misconfigured Vercel deployment fails during build before ever receiving traffic.

2. **Defense-in-Depth Enforcement (`src/proxy.ts` + `/api/external-provider/[...path]/route.ts`)**
   - *Rationale*: Next.js 16 uses `src/proxy.ts` as the request interception boundary. `src/proxy.ts` verifies the signed session cookie for all routes (redirecting browser navigations to `/auth/login` and returning `401` for `/api/*`). In addition, `/api/external-provider/[...path]/route.ts` calls `requireAuthorizedSession()` at the top of `handler()` before calling `getWebCredentials()` or `getUpstreamToken()`, ensuring ExternalProvider secrets are never even loaded for unauthenticated callers.

3. **Stateless OIDC + Signed JWS/JWE Session Cookie**
   - *Rationale*: With only two fixed users defined in `ALLOWED_USER_EMAILS`, a database is unnecessary overhead. On Google OAuth callback, the server verifies the ID token / userinfo (`email_verified === true`), checks `allowedEmails.has(email.toLowerCase())`, and issues a stateless `HttpOnly` cookie signed with `AUTH_SECRET` (32+ byte secret in Vercel). Every request also re-checks that the session email is still in `ALLOWED_USER_EMAILS`, so removing an email from `ALLOWED_USER_EMAILS` revokes access immediately on redeploy.

## Risks / Trade-offs

- **Risk**: Template routes like `/auth/v1/register` or `/auth/v2/register` could confuse users into thinking password registration exists.
  → **Mitigation**: Consolidate login onto `/auth/login` featuring only the Google sign-in button and redirect legacy `/auth/v1/*` and `/auth/v2/*` paths to `/auth/login`.
