# Design

## Context

Current backend logic is located inside Next.js App Router route handlers (`src/app/api/...`), directly handling `NextRequest`/`NextResponse`, JSON parsing, and database transactions. The frontend uses manual `useEffect` fetching with `AbortController` and manual state handling for reads and mutations.

As we prepare for mobile integrations (e.g., Android Digital Wellbeing screen-time exports) and cleaner web mutations, we require an architecture that avoids duplicating business logic across web and mobile transports.

## Goals / Non-Goals

**Goals:**
- Separate core domain logic and persistence into pure, testable server services (`src/server/services/`).
- Adopt `next-safe-action` for internal web UI mutations to achieve end-to-end type safety, automated Zod input parsing, and built-in CSRF protection.
- Establish clean, versioned REST endpoints (`/api/v1/...`) powered by the same domain services, authenticated via mobile Bearer tokens or API keys.
- Adopt SWR for client-side reads, eliminating manual effect coordinators and deduplicating network calls across dashboard cards.
- Establish a permanent agent skill (`.agents/skills/backend-architecture/SKILL.md`) and rule so all future AI agent sessions adhere to these conventions.

**Non-Goals:**
- Replacing existing third-party proxy endpoints (`/api/external-provider/[...path]`), Vercel cron endpoints, or OAuth callback handlers with Server Actions.
- Rewriting database schemas or replacing Supabase PostgreSQL persistence.
- Implementing the mobile UI itself in this change (this change establishes the backend service, auth, and API contracts for mobile ingestion).

## Decisions

### 1. Hexagonal Service Layer Architecture
- **Decision**: Domain logic lives in `src/server/services/<domain>.ts` as pure TypeScript functions taking `(ctx: AuthContext, input: TInput)`.
- **Rationale**: Keeps business rules and database mutations completely independent of Next.js HTTP transports. Unit tests can execute service logic directly without mocking `NextRequest` or cookies.
- **Alternatives considered**:
  - *Keep logic in route handlers*: Blocks mobile reuse or forces copy-pasting code into Server Actions.
  - *Put logic in Server Actions*: Server Actions cannot be called reliably from outside the web bundle (e.g. mobile apps or background daemons).

### 2. `next-safe-action` for Web UI Mutations
- **Decision**: Use `next-safe-action` with an `authActionClient` middleware.
- **Rationale**: Provides strict Zod validation before handlers execute, end-to-end TypeScript types from server to client, safe error handling (`ActionError`), and seamless integration with React 19 transitions.
- **Alternatives considered**:
  - *Raw `"use server"` functions*: Prone to security oversights (missing auth or validation checks) and untyped error handling.
  - *Keep `fetch("/api/...")` in client*: Boilerplate-heavy and requires manual typing of request/response payloads.

### 3. Dual Authentication (Session Cookie + Mobile Bearer Token)
- **Decision**: Unified `AuthContext` resolved at the transport layer:
  - Web Server Actions resolve session via `getSessionFromCookie()`.
  - `/api/v1/` route handlers check `Authorization: Bearer <token>` or fallback to session cookie.
- **Rationale**: Allows mobile clients to authenticate with a persistent API token without managing browser OAuth cookies.

### 4. SWR for Dashboard Reads
- **Decision**: Adopt `swr` for data fetching in client components.
- **Rationale**: Stale-While-Revalidate caching serves instant cached data while background revalidation updates the UI. Automatically deduplicates multiple widgets requesting the same categories or transactions on the same page.
- **Alternatives considered**:
  - *TanStack Query*: 3x larger bundle size (~13 kB vs ~4 kB) and excess complexity for this app's relatively simple GET queries.

### 5. Directory Layout
```
src/
├── lib/
│   └── schemas/             # Shared Zod schemas (DTO contracts for Web & Mobile)
├── server/
│   ├── services/            # Pure domain services (database, business rules, reconciliation)
│   ├── actions/             # Web mutations via next-safe-action
│   └── auth/                # Session and Bearer token resolution
└── app/
    ├── api/
    │   ├── v1/              # Versioned REST endpoints (mobile & external integration)
    │   └── externalProvider/      # Proxy and Cron routes (preserved)
```

## Risks / Trade-offs

- **[Risk: Accidental business logic in Server Actions]** → *Mitigation*: Enforce via `.agents/rules/api-architecture.md` that actions must be thin wrappers calling domain services.
- **[Risk: SWR cache desynchronization after Server Action mutation]** → *Mitigation*: Use SWR's `mutate()` in Server Action completion callbacks or action hooks (`onSuccess`).
- **[Risk: Increased dependencies]** → *Mitigation*: `swr` (~4.3 kB) and `next-safe-action` (~3 kB) have minimal footprint and zero runtime bloat.
