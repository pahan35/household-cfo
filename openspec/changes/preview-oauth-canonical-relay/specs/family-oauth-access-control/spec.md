# Spec Delta: family-oauth-access-control

## ADDED Requirements

### Requirement: Canonical OAuth relay for dynamic Preview deployments
When running on a non-canonical host (such as a Vercel Preview deployment) where `AUTH_CANONICAL_URL` is configured, the system SHALL initiate Google OAuth with the canonical callback URL and an HMAC-SHA256 signed `state` payload containing the originating preview URL. The canonical callback SHALL verify the HMAC signature and origin allowlist before redirecting to the originating preview URL, and the preview callback SHALL complete token exchange using the canonical `redirect_uri` before establishing an authenticated session.

#### Scenario: Initiating sign-in from a Vercel Preview deployment
- **WHEN** a user initiates sign-in at `/api/auth/login` on an origin different from `AUTH_CANONICAL_URL`
- **THEN** the server configures Google OAuth with `redirect_uri` pointing to `${AUTH_CANONICAL_URL}/api/auth/callback` and sets a signed `state` query parameter containing the preview origin, return route, timestamp, and HMAC-SHA256 signature generated with `AUTH_SECRET`

#### Scenario: Canonical callback receives authorization code intended for a preview origin
- **WHEN** the canonical callback at `/api/auth/callback` receives an OAuth callback containing a valid HMAC-signed `state` whose target origin matches an allowed preview origin pattern (e.g., `*.vercel.app` or configured allowed origins)
- **THEN** the canonical server redirects (`302`) to the preview origin's `/api/auth/callback` preserving `code` and `state` parameters without establishing a session on canonical

#### Scenario: Canonical callback receives tampered state or disallowed target origin
- **WHEN** the canonical callback receives an OAuth callback with an invalid HMAC signature, expired timestamp, or a target origin not matching allowed preview origin patterns
- **THEN** the canonical server rejects the relay request, refrains from redirecting to the untrusted origin, and redirects to `/auth/login?error=invalid_relay_state` on canonical

#### Scenario: Preview deployment exchanges authorization code forwarded by canonical relay
- **WHEN** the preview deployment callback receives an authorization code and valid signed state from the canonical relay
- **THEN** the preview server exchanges the code with Google using `redirect_uri: ${AUTH_CANONICAL_URL}/api/auth/callback`, verifies `ALLOWED_USER_EMAILS`, issues a signed session cookie on the preview origin, and redirects the user to the requested `returnTo` route
