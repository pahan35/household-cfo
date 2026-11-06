# Tasks

## 1. Credential Source Control (`keychain` vs `env`)

- [ ] 1.1 Add `getExternalProviderSecretSource()` in `src/server/external-provider/token.ts` reading `EXTERNAL_API_SECRET_SOURCE` (`"keychain"` default when unset/empty, `"env"` when configured, throwing `InvalidSecretSourceError` otherwise); verify with unit tests in `src/server/external-provider/__tests__/`.
- [ ] 1.2 Update `getWebCredentials()` and `getUpstreamToken()` in `src/server/external-provider/token.ts` so `"keychain"` mode reads from macOS Keychain (`external-api-web-cookie`, `external-api-web-user`, `external-api-token`) and `"env"` mode reads normalized `EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, and `EXTERNAL_API_TOKEN` from `process.env` without invoking `security`; verify with unit tests covering both modes.

## 2. Missing & Stale Credential Detection Hook

- [ ] 2.1 Add credential health/staleness classification and a pluggable `notifyCredentialIssue` hook in `src/server/external-provider/` that detects missing secrets (`503`) and stale upstream responses (`401`, `403`, login redirects, or HTML login payloads when JSON was expected) and invalidates cached credentials; verify with unit tests in `src/server/external-provider/__tests__/proxy-route.test.ts`.
- [ ] 2.2 Wire `src/app/api/external-provider/[...path]/route.ts` to classify stale upstream responses, scrub all env/keychain secrets via `scrubSecrets`, and invoke `notifyCredentialIssue`; verify with `npm test` and `npm run verify`.

## 3. Documentation & Secret Rules

- [ ] 3.1 Update `.env.example` and `.agents/rules/secrets.md` with placeholder documentation for `EXTERNAL_API_SECRET_SOURCE`, `EXTERNAL_API_WEB_COOKIE`, `EXTERNAL_API_WEB_USER`, and `EXTERNAL_API_TOKEN`; verify with `npm run verify` and confirm no secret values are present.
