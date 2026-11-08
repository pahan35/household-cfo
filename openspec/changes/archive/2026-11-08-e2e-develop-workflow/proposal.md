# Proposal

## Why

With the completion of `external-provider-mock-adapter-and-e2e-env`, the backend supports full mock data operations and isolated state resets (`POST /api/v1/external-provider/mock/reset`) without contacting upstream `api.external-provider.example.com` or touching production Supabase tables. However, the repository currently lacks an automated browser-based End-to-End (E2E) testing framework and CI execution pipeline. Adding a manually triggered GitHub CI workflow targeting the deployed Vercel Develop environment enables on-demand verification of full user flows (navigation, authentication boundaries, budget cards, and transaction mutations) on true production-like edge/serverless builds with zero secret duplication.

## What Changes

- **E2E Test Framework (`Playwright`)**: Install `@playwright/test` and introduce `playwright.config.ts` configured for fast headless Chromium execution against a target base URL, capturing traces, screenshots, and videos on failure.
- **Workflow-Side Authentication Fixture**: Implement a Playwright authentication helper (`e2e/fixtures/auth.ts` / `e2e/setup/auth.ts`) that mints valid HMAC-SHA256 signed `family_budget_session` cookies via Web Crypto using `AUTH_SECRET` for a designated test user in `ALLOWED_USER_EMAILS`, bypassing Google OAuth redirects without relaxing Vercel server-side security.
- **Vercel Automation Protection Header Support**: Support `x-vercel-protection-bypass` header propagation in Playwright configuration to cleanly bypass Vercel Deployment Protection on preview/branch deployments.
- **Core Smoke & Functional E2E Suites**: Add initial test suites under `e2e/`:
  - `auth-protection.spec.ts`: Unauthenticated redirection to `/auth/login` and authenticated dashboard access.
  - `family-budget-overview.spec.ts`: Loading budget categories, account balances, and currency totals against the seeded mock state.
  - `transaction-mutation.spec.ts`: Creating/updating a mock transaction and verifying balance/stat recalculation.
- **Manual GitHub CI Workflow (`.github/workflows/e2e-develop.yml`)**: Add a `workflow_dispatch` workflow conforming to repository invariants (Node.js via `.nvmrc`, `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`), resetting the mock seed state before test runs and executing Playwright against the stable Develop environment.
- **NPM Script**: Add `"test:e2e": "playwright test"` to `package.json`.

## Capabilities

### New Capabilities
- `e2e-develop-testing`: Automated browser-level Playwright test execution against a deployed Vercel Develop environment, featuring client-side signed session authentication, automated pre-test mock state resets, failure artifact reporting, and on-demand GitHub CI triggering.

### Modified Capabilities
<!-- None: existing server auth and mock adapter capabilities are consumed without changes to their requirements -->

## Impact

- **CI/CD**: New `.github/workflows/e2e-develop.yml` workflow with `workflow_dispatch` inputs for target URL and mock reset toggle.
- **Dependencies**: Adds `@playwright/test` to `devDependencies`.
- **Repository Structure**: Adds `playwright.config.ts` and `e2e/` test specifications and auth fixtures.
- **Secrets & Configuration**: Consumes `E2E_BASE_URL`, `AUTH_SECRET`, `MOBILE_API_TOKENS`, and optional `VERCEL_AUTOMATION_BYPASS_SECRET` in GitHub Actions; no database credentials required in CI.
