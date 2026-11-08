# Design

## Context

See `proposal.md` for motivation. Currently:
1. `external-provider-mock-adapter` and `external-provider-persistent-sync` enable running the server in `EXTERNAL_API_ADAPTER="mock"` mode with isolated Supabase persistence (`SUPABASE_MOCK_URL`) and deterministic state resets via `POST /api/v1/external-provider/mock/reset`.
2. `src/server/auth/config.ts` strictly forbids `AUTH_BYPASS_LOCAL` on Vercel or in production (`FatalAuthConfigError` fail-closed check), requiring valid HMAC-SHA256 signed `family_budget_session` cookies for dashboard access.
3. The repository has `vitest` for unit tests, but no browser-based E2E framework or GitHub Actions workflow to validate deployed builds.

## Goals / Non-Goals

**Goals:**
- Provide a lightweight, robust Playwright test framework targeting remote deployed Vercel instances (specifically the Develop branch environment).
- Enable clean automated authentication without Google OAuth by injecting pre-signed session cookies created with `AUTH_SECRET` for an allowlisted test email.
- Create initial high-value E2E test suites covering route protection, budget overview cards, and transaction mutations.
- Author a manual GitHub Actions CI workflow (`.github/workflows/e2e-develop.yml`) that adheres strictly to repo workflow invariants (`@v7` actions, `.nvmrc`).

**Non-Goals:**
- Running local Next.js servers inside GitHub Actions CI (to avoid duplicating database/secret configuration in CI).
- Multi-browser cross-testing (Chromium-only for fast, cost-effective CI).
- Full regression testing of legacy dashboards under `(legacy)`.

## Decisions

### 1. Framework Selection: Playwright over Cypress
- **Decision**: Install `@playwright/test` in `devDependencies` and configure `playwright.config.ts`.
- **Rationale**: Modern industry standard for Next.js 16 / React 19 apps with native support for parallel workers, automatic waiting, network header manipulation, and video/trace capture on failure.
- **Alternatives considered**:
  - *Cypress*: Slower execution, heavier setup, and more cumbersome session cookie / multi-tab management.

### 2. Workflow-Side Session Cookie Minting vs Server Auth Bypass
- **Decision**: Playwright creates an authenticated browser context by minting an HMAC-SHA256 signed JWT for `family_budget_session` using the shared `AUTH_SECRET` and Web Crypto (`crypto.subtle`).
- **Rationale**: Completely preserves Vercel's fail-closed auth security (`isVercelOrProd` checks remain intact in `src/server/auth/config.ts`). The test exercises the real production auth path in `src/proxy.ts` (`getSessionFromRequest` and `verifySessionToken`) without needing complex OAuth redirection automation or mock bypass flags on the server.
- **Alternatives considered**:
  - *Automating Google OAuth in UI*: Extremely fragile, blocked by bot detection and 2FA.
  - *Adding `AUTH_BYPASS_E2E` server flag*: Dangerous; risks accidental deployment of an unauthenticated backdoor to production.

### 3. Vercel Deployment Protection Header via Playwright Config
- **Decision**: In `playwright.config.ts`, populate `extraHTTPHeaders` with `x-vercel-protection-bypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET` if the environment variable is present.
- **Rationale**: Vercel branch deployments often have deployment protection (password or Vercel login) enabled. Passing this header bypasses the Vercel gateway before reaching the Next.js application layer.

### 4. Deterministic Pre-Test Reset as an Explicit CI Step
- **Decision**: In `.github/workflows/e2e-develop.yml`, execute `curl -X POST "$TARGET/api/v1/external-provider/mock/reset" -H "Authorization: Bearer $MOBILE_API_TOKENS" --fail` before invoking Playwright.
- **Rationale**: Guarantees that every CI run starts with an identical seed state (categories, initial balance, transactions). If the Develop environment is unreachable or the reset fails, the workflow immediately fails before launching browser processes.

### 5. Strict Workflow Version Invariants
- **Decision**: `.github/workflows/e2e-develop.yml` uses:
  - `actions/checkout@v7`
  - `actions/setup-node@v7` with `node-version-file: ".nvmrc"`
  - `actions/upload-artifact@v7`
- **Rationale**: Adheres to repository rules recorded in `AGENTS.md` and avoids deprecated v4 actions.

## Risks / Trade-offs

- **[Risk: Secret mismatch between Vercel and GitHub Actions]** → *Mitigation*: The test runner will log a clear error if the pre-signed cookie fails verification (e.g. if `AUTH_SECRET` on Develop differs from CI's `AUTH_SECRET`), resulting in a redirect to `/auth/login` which `auth-protection.spec.ts` detects.
- **[Risk: Flaky UI locators on dynamic data]** → *Mitigation*: Tests use accessible role and label selectors (`getByRole`, `getByLabel`, `getByTestId`) and rely on deterministic seed IDs (`Main Account PLN`, `Groceries`) established by `buildMockSeedSnapshot()`.
