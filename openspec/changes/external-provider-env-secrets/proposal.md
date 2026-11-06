# Proposal

## Why

Currently, `src/server/external-provider/token.ts` retrieves ExternalProvider web session credentials (`external-api-web-cookie` and `external-api-web-user`) exclusively from the macOS Keychain via the `security` CLI. To deploy the app to Vercel for shared family use while preserving zero-friction local macOS Keychain development, we need an explicit environment variable control that defaults to reading from the macOS Keychain locally and switches to reading Vercel secret environment variables when configured, along with detection hooks when those credentials are missing or become stale.

## What Changes

- Introduce a credential source control environment variable `EXTERNAL_API_SECRET_SOURCE` (`"keychain"` | `"env"`, defaulting to `"keychain"` when unset).
- Keep `"keychain"` mode reading `external-api-web-cookie`, `external-api-web-user`, and `external-api-token` from the macOS Keychain so local development works identically to today without secrets in `.env.local`.
- Add `"env"` mode in `src/server/external-provider/token.ts` that reads `EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, and fallback `EXTERNAL_API_TOKEN` exclusively from server-side environment variables (treated as encrypted secrets in Vercel) without shelling out to `security`.
- Add credential health classification and staleness detection in `src/server/external-provider/` and `/api/external-provider/[...path]/route.ts` to identify when secrets are missing (`503`) or rejected/expired upstream (`401`, `403`, or login redirect) and invoke a pluggable alert hook + expose a server-side credential health check.
- Update `.env.example` and `.agents/rules/secrets.md` to document the new secret variable names and source toggle without exposing any secret values.

## Capabilities

### New Capabilities
- `external-provider-secret-management`: Configurable ExternalProvider credential resolution (`keychain` vs `env` mode), secret scrubbing guarantees, and missing/stale credential detection hooks.

### Modified Capabilities
<!-- None -->

## Impact

- `src/server/external-provider/token.ts`
- `src/server/external-provider/http.ts`
- `src/app/api/external-provider/[...path]/route.ts`
- `src/server/external-provider/__tests__/proxy-route.test.ts`
- `.env.example` and `.agents/rules/secrets.md`
