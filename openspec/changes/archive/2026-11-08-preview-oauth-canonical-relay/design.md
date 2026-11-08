# Design: Canonical OAuth Relay for Vercel Preview Deployments

## Context

Google Cloud Console strictly requires exact-match URLs for OAuth 2.0 Client Redirect URIs and prohibits wildcard patterns (e.g. `https://*.vercel.app`). Vercel creates ephemeral URLs for every preview deployment and branch commit. In our existing implementation (`src/app/api/auth/[...auth]/route.ts`), OAuth initiates with the dynamic `host` as the `redirect_uri`, triggering Google's `redirect_uri_mismatch` error on all preview deployments.

Both production and preview environments on Vercel share environment variables configured at the project level, notably `AUTH_SECRET` and `ALLOWED_USER_EMAILS`.

## Goals / Non-Goals

**Goals:**
- Enable seamless, zero-config Google OAuth sign-in on all Vercel Preview deployments.
- Require only a single permanent callback URL registered in Google Cloud Console (`${AUTH_CANONICAL_URL}/api/auth/callback`).
- Secure the relay with HMAC-SHA256 signatures and origin allowlist validation to eliminate open-redirect and authorization code interception risks.
- Maintain identical session cookie behavior (`family_budget_session`) on preview domains without architectural rewrites or external auth dependencies.

**Non-Goals:**
- Cross-domain single sign-on (SSO) sharing session cookies across distinct top-level domains.
- Migrating from our lightweight HMAC session implementation to Supabase Auth or NextAuth.
- Bypassing Google OAuth verification on Vercel previews (our fail-closed security rule remains strictly enforced).

## Decisions

### Decision 1: Signed OAuth State Token (HMAC-SHA256)
- **Choice**: Structure the `state` parameter as a self-contained, signed token: `base64url(payload).signature`, where payload is:
  ```json
  {
    "origin": "https://family-budget-git-feat-xyz-team.vercel.app",
    "returnTo": "/dashboard/family-budget",
    "nonce": "random_32_bytes",
    "exp": 1731065400
  }
  ```
- **Rationale**: Because the user's browser transitions from Preview Origin -> Google -> Canonical Origin, any state cookies set on the Preview domain are inaccessible on the Canonical domain due to browser same-site cookie boundaries. A cryptographically signed `state` query parameter is origin-independent while completely tamper-proof.
- **Alternatives Considered**:
  - *Shared Redis/Postgres state store*: Adds network latency, database migrations, and operational overhead for a 10-minute transient state.
  - *Unsigned state*: Vulnerable to state tampering and open-redirect attacks.

### Decision 2: Canonical Callback Code Relay Protocol
- **Choice**: Canonical callback receives `?code=...&state=...`, verifies the HMAC signature and origin pattern, and issues an immediate `302 Redirect` to `${payload.origin}/api/auth/callback?code=${code}&state=${state}`.
- **Rationale**: Google's authorization code is single-use and short-lived (typically 60 seconds). Forwarding the code allows the preview deployment itself to perform token exchange, verify `ALLOWED_USER_EMAILS`, and attach the `family_budget_session` cookie directly in the browser's final preview context.
- **Alternatives Considered**:
  - *Production exchanges token and relays session*: Requires establishing a custom secondary token exchange protocol between production and preview. Code forwarding uses standard OAuth 2.0 semantics and keeps the session issuance flow uniform.

### Decision 3: Google Code Exchange `redirect_uri` Matching Rule
- **Choice**: During the POST request to `https://oauth2.googleapis.com/token`, the preview deployment MUST pass `redirect_uri: ${AUTH_CANONICAL_URL}/api/auth/callback` if the flow originated through relay.
- **Rationale**: The OAuth 2.0 specification (RFC 6749 §4.1.3) requires that the `redirect_uri` sent during code exchange matches the `redirect_uri` included in the initial authorization request byte-for-byte. Sending the preview URL during code exchange would cause Google to reject the exchange with `redirect_uri_mismatch`.

### Decision 4: Origin Allowlist Defense-in-Depth
- **Choice**: Validate `payload.origin` against:
  1. Any domain ending in `.vercel.app` matching the project prefix (e.g. `^https:\/\/family-budget.*\.vercel\.app$`).
  2. Any custom comma-separated origins listed in `ALLOWED_PREVIEW_ORIGINS`.
- **Rationale**: Even with HMAC signature verification, strict origin regex validation guarantees that even if a secret were compromised, the canonical endpoint will never relay OAuth credentials to an untrusted domain.

## Flow Diagram

```text
+-----------------------+           +--------------------+           +------------------------+
|   Preview Deployment  |           |    Google OAuth    |           |   Canonical / Prod     |
|   (preview-1.vercel)  |           |                    |           |   (budget.domain.com)  |
+-----------------------+           +--------------------+           +------------------------+
           |                                  |                                   |
    1. /api/auth/login                        |                                   |
       redirect_uri = canonical              |                                   |
       state = sign({ origin, returnTo })     |                                   |
           |--------------------------------->|                                   |
           |                                  | 2. User consents                  |
           |                                  |    redirects to canonical         |
           |                                  |---------------------------------->|
           |                                                                      |
           |                                                               3. /api/auth/callback
           |                                                                  - Verify HMAC signature
           |                                                                  - Verify origin is trusted
           | 4. 302 Redirect                                                  - Relay to preview origin
           |    preview-1.vercel/api/auth/callback?code=...&state=...             |
           |<---------------------------------------------------------------------|
           |
    5. Token Exchange:
       POST https://oauth2.googleapis.com/token
       (redirect_uri = canonical)
    6. Verify ALLOWED_USER_EMAILS
    7. Set-Cookie: family_budget_session
    8. 302 Redirect to returnTo
           |
           v
       Logged In!
```

## Risks / Trade-offs

- **[Risk: Origin Spoofing / Code Interception]** → **Mitigation**: Double protection: HMAC-SHA256 signature signed by `AUTH_SECRET` plus regex pattern matching on the target origin.
- **[Risk: Expired State / Replay]** → **Mitigation**: Embed an explicit expiration timestamp (`exp`: 10 minutes) and cryptographically random nonce in the state payload.
- **[Risk: Local Development Regression]** → **Mitigation**: When `AUTH_CANONICAL_URL` is unset or when running locally (`isAuthBypassActive()`), the system preserves existing local behavior without requiring canonical relay.
