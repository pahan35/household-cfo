# Tasks

## 1. Dependencies & Contracts Setup

- [ ] 1.1 Add `next-safe-action` and `swr` dependencies to `package.json` and verify installation succeeds
- [ ] 1.2 Define shared Zod DTO contracts in `src/lib/schemas/` (scenarios, presets, screen-log ingestion) and verify schema validation tests pass

## 2. Domain Service Layer

- [ ] 2.1 Implement transport-agnostic `src/server/services/mortgage-service.ts` and verify with unit tests
- [ ] 2.2 Implement transport-agnostic `src/server/services/runway-service.ts` and verify with unit tests
- [ ] 2.3 Implement transport-agnostic `src/server/services/presets-service.ts` and verify with unit tests
- [ ] 2.4 Implement transport-agnostic `src/server/services/screen-log-service.ts` for time-value and screen logs, verifying with unit tests

## 3. Web Mutations with `next-safe-action`

- [ ] 3.1 Setup base `actionClient` and authenticated `authActionClient` middleware in `src/server/actions/action-client.ts`
- [ ] 3.2 Implement Server Actions in `src/server/actions/` delegating to domain services and verify with unit tests
- [ ] 3.3 Refactor simulator dashboard components to trigger mutations via Server Actions rather than manual `fetch` calls

## 4. Versioned REST API & Mobile Auth

- [ ] 4.1 Implement Bearer token and mobile API key authentication resolver in `src/server/auth/mobile.ts`
- [ ] 4.2 Implement versioned endpoints under `/api/v1/` (screen-logs, scenarios, presets) delegating to the domain services
- [ ] 4.3 Add integration tests verifying `/api/v1/` routes under both mobile Bearer token and web session authentication

## 5. Client Read Caching with SWR

- [ ] 5.1 Implement shared SWR query hooks (`useCategoriesQuery`, `useScenariosQuery`) with automated request deduplication
- [ ] 5.2 Refactor dashboard cards and simulator views to read data via SWR, linking global revalidation to `useExternalProviderSync`
- [ ] 5.3 Verify that dashboard widgets render without redundant duplicate network requests

## 6. Agentic Harness Skills & Rules

- [ ] 6.1 Create `.agents/skills/backend-architecture/SKILL.md` detailing service layer, Server Actions, and REST API conventions
- [ ] 6.2 Create `.agents/rules/api-architecture.md` and update `AGENTS.md` code conventions to enforce the architecture across all agent sessions

## 7. Verification & Regression Testing

- [ ] 7.1 Run full vitest test suite (`npm test`) and ensure all existing and new unit tests pass
- [ ] 7.2 Run static code verification (`npm run verify`) to ensure zero Biome and TypeScript errors
