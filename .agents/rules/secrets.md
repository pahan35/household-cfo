---
trigger: always_on
---

# Secret handling

This project proxies a third-party API. A live credential exists on this machine and must never be read, printed, copied, logged, committed, or written into a file.

## Never do these

- Do not read `.env`, `.env.local`, or any `*.env.*` file. `.env.example` is the only one that is safe to open, because it contains placeholders only.
- Do not run `security find-generic-password`, or any other command that prints a value from the macOS keychain.
- Do not run `env`, `printenv`, or `launchctl getenv` to dump the environment.
- Do not echo, log, `console.log`, or throw a variable that holds a token, an `Authorization` header, or a cookie value.
- Do not paste a real token into a source file, a comment, a test fixture, an issue, or a commit message.

## Where the credentials live

Credentials are resolved server-side by `src/server/external-provider/token.ts` according to `EXTERNAL_API_SECRET_SOURCE`:

1. **Keychain Mode (`EXTERNAL_API_SECRET_SOURCE="keychain"`, default)**:
   Credentials are stored in the macOS keychain. Those files contain no secret. If you need to confirm a credential is present, ask the user to run the lookup themselves, or check that the proxy responds without a `503`.

   | Service | Holds | Cache TTL |
   |---|---|---|
   | `external-api-web-cookie` | Full `Cookie:` request-header string for api.external-provider.example.com (primary upstream auth) | 30 s |
   | `external-api-web-user` | Logged-in user id (`window.USER.id`), injected into `/api/transaction/get` bodies | 30 s |
   | `external-api-token` | Bearer token of unknown provenance (fallback only; web backend is cookie-authenticated) | 1 h |

2. **Environment Mode (`EXTERNAL_API_SECRET_SOURCE="env"`, used on Vercel)**:
   Credentials are read from encrypted server-side environment variables without shelling out to the macOS `security` binary:

   - `EXTERNAL_API_WEB_COOKIE`: Full `Cookie:` request-header string for api.external-provider.example.com
   - `EXTERNAL_API_WEB_USER`: Logged-in user id (`window.USER.id`)
   - `EXTERNAL_API_TOKEN`: Optional fallback Bearer token

## Application Authentication & Access Control Secrets

In production on Vercel, the following environment variables configure Google OAuth access control and session signing:

- `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Client Secret (Vercel encrypted secret)
- `AUTH_SECRET`: Secret key (32+ bytes) used for stateless HMAC-SHA256 session cookie signing
- `ALLOWED_USER_EMAILS`: Comma-separated list of authorized family member Google email addresses
- `AUTH_BYPASS_LOCAL`: Local development flag. Defaults to `"true"` in local development; must NEVER be enabled on Vercel or in production (hard fail-closed guard).

Never log or expose `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, or `ALLOWED_USER_EMAILS`. Never expose these variables with a `NEXT_PUBLIC_` prefix.

## Database & Cron Secrets

In production on Vercel, the following environment variables configure the shared PostgreSQL persistence layer and scheduled synchronization jobs:

- `DATABASE_URL`: Direct or pooled PostgreSQL connection string for Supabase
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase secret API key (`sb_secret_...`) or legacy service role key (elevated server-side access to bypass RLS)
- `CRON_SECRET`: Bearer token configured in Vercel project settings to authenticate Vercel Cron invocation of `/api/external-provider/cron/daily-sync`

Never log or expose `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `CRON_SECRET`. Never prefix these with `NEXT_PUBLIC_`.

## How to work with the upstream API

- Call the local proxy at `/api/external-provider/...` from client code. It runs server-side and attaches the credential for you.
- To add an upstream endpoint, add its path prefix to `PATH_ALLOWLIST` in `src/server/external-provider/config.ts`. Do not add a wildcard or an empty prefix; the allowlist must stay an explicit list.
- Never introduce a `NEXT_PUBLIC_` variable that holds a credential. Anything with that prefix is inlined into the browser bundle.
- Do not add a client-side fetch that talks to the upstream origin directly with an `Authorization` header.