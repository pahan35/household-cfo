# API architecture

Read `.agents/skills/backend-architecture/SKILL.md` before touching backend code. Hard rules:

- Business logic, database mutations, and reconciliation live in `src/server/services/`. Services take `(ctx: AuthContext, input)`, never import `next/server` or `next/headers`, and never use `"use server"`.
- Web UI mutations are `next-safe-action` Server Actions in `src/server/actions/`, built on `authActionClient` with a Zod `inputSchema` from `src/lib/schemas/`. Actions and route handlers are thin: validate, authenticate, delegate to a service.
- Mobile/external endpoints live under `/api/v1/`, use `handleV1` + `parseJsonBody`, accept Bearer tokens (`MOBILE_API_TOKENS`) or the web session, and call the same services as the Server Actions. Do not copy logic between transports.
- Shared DTO schemas live in `src/lib/schemas/`; do not redeclare request shapes inline.
- Client reads use SWR hooks (`use-external-provider-queries.ts`, `use-scenarios-query.ts`), not `useEffect` + `fetch`/`AbortController`. Invalidate SWR after mutations.
- Leave `/api/external-provider/[...path]`, cron, and OAuth routes as route handlers.
- New services need unit tests; new `/api/v1/` routes need tests for Bearer and session auth.
- Secrets follow `.agents/rules/secrets.md`: never log, return, or `NEXT_PUBLIC_`-prefix `MOBILE_API_TOKENS`.
