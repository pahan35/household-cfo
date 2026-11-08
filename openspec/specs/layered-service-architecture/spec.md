# layered-service-architecture Specification

## Purpose

Provides a clean separation of concerns between core domain business logic and HTTP transport mechanisms, exposing pure server services to both internal web UI Server Actions (via `next-safe-action`) and external mobile/integration REST endpoints (`/api/v1/`) with SWR read caching.

## Requirements

### Requirement: Transport-agnostic domain service layer
The system SHALL isolate all business logic, database mutations, and domain calculations into pure server services (`src/server/services/`). Domain service methods SHALL NOT depend on Next.js transport primitives (`NextRequest`, `NextResponse`, or `"use server"` directives) and SHALL accept strongly typed inputs and standard authentication context objects.

#### Scenario: Executing domain mutations across different callers
- **WHEN** a mutation (e.g., scenario save, preset update, or screen-time import) is requested by either a web Server Action or an external REST endpoint
- **THEN** both transports execute the exact same domain service function with identical business validation and database operations

### Requirement: Type-safe web mutations via Server Actions
The system SHALL use `next-safe-action` to define web UI mutations as Server Actions. Each action SHALL define a Zod input schema, enforce session authentication via client middleware, and return strongly typed result objects (`{ data, serverError, validationErrors }`).

#### Scenario: Executing valid web mutation
- **WHEN** a web component invokes a Server Action with valid payload and active session
- **THEN** the action executes the underlying service and returns a typed `data` payload with zero manual JSON serialization

#### Scenario: Rejecting unauthenticated or malformed web mutation
- **WHEN** an unauthenticated client or invalid payload invokes a Server Action
- **THEN** `next-safe-action` rejects the request before reaching domain logic and returns standardized validation or authentication errors

### Requirement: Versioned REST endpoints for mobile and external integrations
The system SHALL expose versioned REST endpoints under `/api/v1/` to support external callers, automation daemons, and mobile companion applications. These endpoints SHALL support Bearer token or API key authentication in addition to web session cookies.

#### Scenario: Ingesting data from mobile application or automation
- **WHEN** an external companion or mobile app sends a POST request to `/api/v1/...` with a valid Bearer token and JSON body
- **THEN** the endpoint validates the token, delegates to the corresponding domain service, and returns standard HTTP status codes and JSON payloads

### Requirement: Stale-While-Revalidate client query caching with SWR
The web dashboard SHALL use SWR for reading remote resources (ExternalProvider entities, scenario lists, and budget statistics), replacing imperative `useEffect` data loaders. SWR hooks SHALL automatically deduplicate concurrent requests, revalidate on window focus/reconnect, and support global invalidation when sync toolbar triggers complete.

#### Scenario: Revalidating shared data across dashboard widgets
- **WHEN** multiple widgets on the same page request category or currency data
- **THEN** SWR fulfills all components with a single in-flight HTTP request and serves stale data instantly while background revalidation occurs
