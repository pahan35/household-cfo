# Spec Delta

## Purpose

Manages server-side resolution of ExternalProvider upstream credentials across local macOS Keychain development and Vercel environment-variable deployments while scrubbing secrets from logs/responses and detecting missing or stale credentials.

## ADDED Requirements

### Requirement: Configurable ExternalProvider credential source with local Keychain default
The server SHALL resolve ExternalProvider credentials according to the `EXTERNAL_API_SECRET_SOURCE` environment variable (`"keychain"` or `"env"`), defaulting to `"keychain"` when `EXTERNAL_API_SECRET_SOURCE` is unset or empty.

#### Scenario: Default local development uses macOS Keychain
- **WHEN** `EXTERNAL_API_SECRET_SOURCE` is unset or set to `"keychain"`
- **THEN** the server reads `external-api-web-cookie`, `external-api-web-user`, and fallback `external-api-token` from the macOS Keychain via `security find-generic-password` using the existing in-memory TTL cache

#### Scenario: Deployed environment mode reads exclusively from environment variables
- **WHEN** `EXTERNAL_API_SECRET_SOURCE` is set to `"env"`
- **THEN** the server reads `EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, and fallback `EXTERNAL_API_TOKEN` exclusively from `process.env` and MUST NOT invoke the macOS `security` command

#### Scenario: Invalid credential source value
- **WHEN** `EXTERNAL_API_SECRET_SOURCE` is set to a value other than `"keychain"` or `"env"`
- **THEN** the server fails closed with a configuration error (`503`) describing the valid `EXTERNAL_API_SECRET_SOURCE` options without logging any secret values

### Requirement: Secret scrubbing across both Keychain and environment modes
The proxy SHALL scrub all resolved credential values (`EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, `EXTERNAL_API_TOKEN`, and Keychain equivalents) from server logs and error responses before returning them to callers.

#### Scenario: Upstream error echoes secret value in env mode
- **WHEN** `EXTERNAL_API_SECRET_SOURCE` is `"env"` and an upstream error response body contains the `EXTERNAL_API_WEB_COOKIE` or `EXTERNAL_API_WEB_USER` value
- **THEN** the proxy replaces every occurrence with `[redacted]` in both console logs and the JSON error response

### Requirement: Missing and stale credential classification and alert hook
The server SHALL distinguish between missing credentials (`503`) and stale/rejected upstream credentials (`401`, `403`, or upstream login redirect/HTML login response) and invoke a server-side credential alert hook with the failure classification and active secret source mode.

#### Scenario: Credentials missing in env mode
- **WHEN** `EXTERNAL_API_SECRET_SOURCE` is `"env"` and neither `EXTERNAL_API_WEB_COOKIE` nor `EXTERNAL_API_TOKEN` is configured in `process.env`
- **THEN** the proxy returns `503 Service Unavailable` and triggers the credential alert hook with status `"missing"` and source `"env"`

#### Scenario: Upstream rejects stale web session cookie
- **WHEN** the ExternalProvider upstream responds with `401`, `403`, an unexpected redirect (`3xx` caught by `redirect: "error"`), or an HTML login page instead of JSON
- **THEN** the proxy invalidates its in-memory credential cache, triggers the credential alert hook with status `"stale"`, and returns a structured upstream authentication failure response without leaking any secret value
