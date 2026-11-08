# Proposal

## Why

Our current dashboard features rely heavily on route handlers (`/api/...`) tightly coupled with manual `NextRequest`/`NextResponse` parsing, imperative `useEffect` fetching, and cookie-only authentication. As we plan future mobile applications (such as weekly screen-time export from Android/iOS) and modernize web UI mutations, we need a unified backend architecture that prevents code duplication between internal web UI workflows and external mobile integrations while eliminating client-side boilerplate.

## What Changes

- **Layered Service Architecture**: Extract core business logic, database mutations, and conflict reconciliations out of route handlers into transport-agnostic server services (`src/server/services/`).
- **Web Mutations via `next-safe-action`**: Adopt `next-safe-action` for internal web UI mutations (simulator scenario saving, preset adjustments, offer track modifications), replacing manual `fetch` calls with end-to-end type-safe Server Actions with automated Zod validation and session authentication.
- **Versioned Mobile REST API (`/api/v1/`)**: Expose clean, versioned REST endpoints backed by the exact same domain services, authenticated via mobile Bearer API tokens / keys to support external integrations and mobile applications.
- **Client Read Caching via SWR**: Replace manual `useEffect` + `AbortController` boilerplate across dashboard cards with SWR, providing automatic request deduplication, Stale-While-Revalidate caching, and window focus revalidation.
- **Agentic Harness Architecture Skill & Rule**: Introduce `.agents/skills/backend-architecture/SKILL.md` and `.agents/rules/api-architecture.md` to guide future agents to strictly adhere to the layered service and dual-transport conventions.

## Capabilities

### New Capabilities
- `layered-service-architecture`: Transport-agnostic domain service layer with dual-transport exposure (`next-safe-action` Server Actions for web UI, `/api/v1/` REST endpoints for mobile/external clients with Bearer token authentication) and SWR read caching.
- `agent-backend-architecture-skill`: Agentic harness skill and behavioral rules governing service-layer placement, mutation patterns, and API design invariants.

### Modified Capabilities
- `cloud-sync-reconciliation`: Adapt cloud reconciliation interfaces to execute through unified server services accessible by both Web Server Actions and Mobile REST transports.

## Impact

- **Dependencies**: Adds `next-safe-action` and `swr`.
- **Backend Code**: Establishes `src/server/services/`, `src/server/actions/`, and `/api/v1/` routes.
- **Frontend Code**: Simplifies dashboard screens (`mortgage`, `runway`, `time-value`, `offer-comparator`) by adopting SWR for reads and Server Actions for mutations.
- **Security & Auth**: Extends authentication layer to support both cookie-based web sessions and Bearer token / mobile API keys for external endpoints.
- **Agent Tooling**: Adds backend architectural guidelines to `.agents/` to ensure continuity across harnesses.
