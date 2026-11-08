# Proposal: Canonical OAuth Relay for Vercel Preview Deployments

## Why

On Vercel, every Preview deployment generates a unique, ephemeral host (e.g. `https://family-budget-git-feat-branch-user.vercel.app`), while Google OAuth strictly requires exact match callback URLs and disallows wildcards. Consequently, signing in via Google OAuth on Preview deployments currently fails with `Error 400: redirect_uri_mismatch`.

We need a secure, zero-friction authentication flow for Preview deployments so family members and reviewers can log in and test features without manually adding ephemeral URLs to Google Cloud Console or compromising our strict fail-closed security posture on Vercel.

## What Changes

- **Canonical OAuth Relay Protocol**: Support initiating Google OAuth from preview deployments using a single registered canonical callback URL (`AUTH_CANONICAL_URL` or production host).
- **Cryptographic State Signing (HMAC-SHA256)**: Encode target preview origin, original return route, and a cryptographic nonce into the `state` parameter signed with `AUTH_SECRET`.
- **Relay Handshake on Canonical Callback**: When the canonical callback receives an authorization code intended for a preview origin, verify the HMAC signature and origin pattern, then redirect the browser to the preview origin's callback.
- **Relay Code Exchange**: The preview callback endpoint exchanges the authorization code using the canonical `redirect_uri` (as required by Google OAuth spec), verifies `ALLOWED_USER_EMAILS`, and issues a secure `family_budget_session` cookie directly on the preview domain.
- **Strict Allowed Origin Validation**: Prevent open-redirect vulnerabilities by validating that relay target origins match trusted Vercel preview host patterns or configured allowed domains.

## Capabilities

### Modified Capabilities
- `family-oauth-access-control`: Add canonical OAuth relay requirements for non-canonical/preview deployments, ensuring secure OAuth initiation, HMAC state verification, trusted origin forwarding, and code exchange while preserving strict email allowlisting.

## Impact

- **Affected Files**:
  - `src/server/auth/config.ts`: Add `AUTH_CANONICAL_URL` / `ALLOWED_PREVIEW_ORIGINS` config helpers and URL resolution logic.
  - `src/server/auth/session.ts`: State signing and verification utilities with HMAC-SHA256.
  - `src/app/api/auth/[...auth]/route.ts`: Updated `handleLogin` and `handleCallback` to support relay handshake and code exchange.
  - `.env.example`, `.agents/rules/secrets.md`: Document `AUTH_CANONICAL_URL`.
- **APIs & Dependencies**: No external package additions (uses native Web Crypto `SubtleCrypto` HMAC-SHA256). Backward-compatible with standard production and local dev workflows.
