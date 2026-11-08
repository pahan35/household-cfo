---
name: backend-architecture
description: Layered backend architecture for this repo — transport-agnostic services, next-safe-action Server Actions for web mutations, versioned /api/v1 REST for mobile/external clients, and SWR for client reads. Use when adding or changing any database mutation, API route, Server Action, mobile/external integration endpoint, or client data fetching.
---

# Backend architecture

## Layers

```
src/lib/schemas/        Shared Zod DTO contracts (web + mobile)
src/server/services/    Pure domain services: (ctx: AuthContext, input) => result
src/server/actions/     Web mutations: next-safe-action, thin wrappers over services
src/server/auth/        Session + Bearer token resolution (mobile.ts)
src/app/api/v1/         Versioned REST for mobile/external callers, thin controllers
src/app/api/external-provider/ Third-party proxy + cron (preserved, not part of this layering)
```

Business logic lives ONLY in `src/server/services/`. Everything else is transport.

## Services

- Signature: `async function verbNoun(ctx: AuthContext, input: Dto)`; input types are inferred from `src/lib/schemas/`.
- MUST NOT import `next/server`, `next/headers`, or contain `"use server"`.
- Persist through the existing stores (`getXStore()`), so tests use the in-memory stores via `setTestXStore`.
- Fail with `ServiceError(code, message)` (`unauthorized | not_found | invalid | conflict | internal`); use `guard()` to wrap store calls. Never return HTTP shapes.
- Unit-test services directly (`src/server/services/__tests__/`), no request mocking.

## Server Actions (web UI mutations)

- Build on `authActionClient` from `src/server/actions/action-client.ts` (session check happens in middleware, before validation).
- Always `.inputSchema(<zod schema from src/lib/schemas>)`; the handler is one line delegating to a service with `ctx.auth`.
- One `"use server"` file per domain; export only actions.
- After a successful mutation, revalidate SWR (`revalidateScenarios(kind)`, `revalidateExternalProviderQueries()`).
- Client reads `{ data, serverError, validationErrors }`; never hand-roll `fetch` + JSON for web mutations.

## REST `/api/v1/` (mobile & external)

- Route handlers wrap logic in `handleV1(request, async (ctx) => ...)` and validate bodies with `parseJsonBody(request, schema)` (`src/app/api/v1/_lib/handler.ts`).
- Auth: `Authorization: Bearer <token>` (configured via `MOBILE_API_TOKENS`, `label:token` pairs, server-only, never `NEXT_PUBLIC_`), the local dev bypass, or the web session cookie. An invalid Bearer token is always 401.
- `src/proxy.ts` lets `/api/v1/*` requests with a Bearer header through; the route itself verifies the token.
- Map errors with `ServiceError` → status (`serviceErrorStatus`). Return JSON `{ error: { message } }`.
- Breaking contract changes need a new version prefix (`/api/v2/`), not an edit of `/api/v1/`.
- Test with both Bearer and session auth (`src/app/api/v1/__tests__/routes.test.ts`).

## Client reads (SWR)

- Use SWR hooks, not `useEffect` + `AbortController`: `use-external-provider-queries.ts` (categories/currencies/settings) and `use-scenarios-query.ts`.
- Same key ⇒ one in-flight request across widgets. Keys are `[<namespace>, <name>]`; global invalidation helpers filter on the namespace.
- `ExternalProviderSyncProvider` calls `revalidateExternalProviderQueries()` after each sync.

## Checklist for a new feature

1. Add/extend a Zod schema in `src/lib/schemas/`.
2. Implement the service + unit tests.
3. Expose it via a Server Action (web) and, if mobile/external needs it, an `/api/v1/` route.
4. Read via SWR; invalidate after mutations.
5. Run `npm test` and `npm run verify`.

Never put business logic in route handlers or actions, never duplicate it between transports, and never log or return credentials.
