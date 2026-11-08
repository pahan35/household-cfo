# family-oauth-access-control Specification

## Purpose

Restricts platform login and API access exclusively to allowlisted family email addresses authenticated via Google OAuth, while providing a controllable local development bypass that is strictly impossible to enable on Vercel.

## Requirements

### Requirement: Google OAuth login with strict verified-email allowlist
The system SHALL authenticate users via Google OAuth (OpenID Connect) and SHALL grant a session ONLY when Google returns `email_verified: true` and the normalized lowercase email address is present in the secret `ALLOWED_USER_EMAILS` environment variable.

#### Scenario: Allowlisted family member signs in with Google
- **WHEN** a user completes Google OAuth with a verified email matching an entry in `ALLOWED_USER_EMAILS` (case-insensitive, comma-separated)
- **THEN** the server issues an encrypted/signed `HttpOnly` session cookie and redirects the user to the requested dashboard route (or to `/dashboard/family-budget` in `"focused"` mode and `/dashboard/default` in `"full"` mode when no specific `returnTo` route was requested)

#### Scenario: Non-allowlisted Google account attempts to sign in
- **WHEN** a user completes Google OAuth with a Google account whose email is not in `ALLOWED_USER_EMAILS` (or whose email is not verified)
- **THEN** the server refuses to create an authenticated session, clears any existing session cookie, and redirects the user to `/unauthorized`

#### Scenario: Missing or empty ALLOWED_USER_EMAILS when auth is enforced
- **WHEN** Google OAuth is active and `ALLOWED_USER_EMAILS` is unset or empty
- **THEN** the server fails closed and denies all sign-in attempts with a configuration error

### Requirement: Route and ExternalProvider API proxy protection
The system SHALL require a valid authenticated session (or active local-only development bypass) for all dashboard/application page routes and all `/api/external-provider/*` proxy requests.

#### Scenario: Unauthenticated browser request to a protected page
- **WHEN** an unauthenticated user requests `/dashboard/*` or `/` while auth enforcement is active
- **THEN** Next.js `src/proxy.ts` redirects the request to the Google sign-in page (`/auth/login`)

#### Scenario: Unauthenticated request to ExternalProvider API proxy
- **WHEN** an unauthenticated client sends a request to `/api/external-provider/*` while auth enforcement is active
- **THEN** the server rejects the request with `401 Unauthorized` before resolving any ExternalProvider secret or contacting the upstream ExternalProvider origin

### Requirement: Controllable local development bypass
In local development (`NODE_ENV !== "production"` and not running on Vercel), the system SHALL allow bypassing Google OAuth via `AUTH_BYPASS_LOCAL` (defaulting to `"true"` when unset in local development, and configurable to `"false"` to test Google OAuth locally).

#### Scenario: Default local development bypasses Google OAuth
- **WHEN** the app runs locally outside Vercel (`VERCEL` and `VERCEL_ENV` unset, `NODE_ENV === "development"`) and `AUTH_BYPASS_LOCAL` is unset or `"true"`
- **THEN** page routes and `/api/external-provider/*` requests are permitted without requiring Google OAuth login

#### Scenario: Disabling bypass locally to test Google OAuth
- **WHEN** the app runs locally and `AUTH_BYPASS_LOCAL` is set to `"false"`
- **THEN** the system enforces the full Google OAuth login and `ALLOWED_USER_EMAILS` verification flow locally

### Requirement: Hard fail-closed guard against auth bypass on Vercel and production
The system MUST NEVER permit authentication bypass when running on Vercel (`process.env.VERCEL === "1"` or `Boolean(process.env.VERCEL_ENV)`) or when `process.env.NODE_ENV === "production"`, regardless of the value of `AUTH_BYPASS_LOCAL`.

#### Scenario: Vercel deployment with AUTH_BYPASS_LOCAL unset or false
- **WHEN** the app runs with `VERCEL="1"`, `VERCEL_ENV` set, or `NODE_ENV="production"`
- **THEN** authentication bypass is disabled and every protected route and API request requires a valid Google OAuth session matching `ALLOWED_USER_EMAILS`

#### Scenario: Misconfigured AUTH_BYPASS_LOCAL=true on Vercel
- **WHEN** the app is built or executed on Vercel (`VERCEL="1"` or `VERCEL_ENV` set) with `AUTH_BYPASS_LOCAL="true"`
- **THEN** the server fails closed by throwing a fatal security misconfiguration error (`500`) and refusing to serve protected routes or bypass authentication

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
