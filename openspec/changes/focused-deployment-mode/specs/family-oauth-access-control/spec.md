# Spec Delta

## MODIFIED Requirements

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
