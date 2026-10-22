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

## Where the credential lives

The token is stored in the macOS keychain under the service name `external-api-token`, and it is read at runtime by `src/server/external-provider/token.ts`. That file contains no secret. If you need to confirm the credential is present, ask the user to run the lookup themselves, or check that the proxy responds without a `503`.

## How to work with the upstream API

- Call the local proxy at `/api/external-provider/...` from client code. It runs server-side and attaches the credential for you.
- To add an upstream endpoint, add its path prefix to `PATH_ALLOWLIST` in `src/server/external-provider/config.ts`. Do not add a wildcard or an empty prefix; the allowlist must stay an explicit list.
- Never introduce a `NEXT_PUBLIC_` variable that holds a credential. Anything with that prefix is inlined into the browser bundle.
- Do not add a client-side fetch that talks to the upstream origin directly with an `Authorization` header.