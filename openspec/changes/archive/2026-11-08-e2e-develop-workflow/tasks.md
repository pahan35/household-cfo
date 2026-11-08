# Tasks

## 1. E2E Framework & Auth Setup

- [x] 1.1 Install `@playwright/test` in `devDependencies`, add `"test:e2e": "playwright test"` to `package.json`, and create `playwright.config.ts` with base URL resolution, headless Chromium project, failure trace/screenshot capture, and `x-vercel-protection-bypass` header propagation; verify by running `npx playwright --version`
- [x] 1.2 Implement E2E session signing utility and Playwright test fixture (`e2e/fixtures/auth.ts`) generating signed HMAC-SHA256 `family_budget_session` cookies via Web Crypto matching `src/server/auth/session.ts`; verify with unit tests in `src/server/auth/__tests__/e2e-session.test.ts`

## 2. Core E2E Test Suites

- [x] 2.1 Create `e2e/auth-protection.spec.ts` verifying unauthenticated navigation redirects to `/auth/login` and authenticated context accesses `/dashboard/family-budget` without redirects; verify syntax and dry-run locators
- [x] 2.2 Create `e2e/family-budget-overview.spec.ts` asserting that seeded mock categories (`Groceries`, `Housing & Utilities`), account balances (`Main Account PLN`), and budget meters render accurately; verify test assertions against deterministic mock seed
- [x] 2.3 Create `e2e/transaction-mutation.spec.ts` asserting that creating an expense transaction updates category spend and source account balance in the UI; verify test assertions

## 3. GitHub CI Workflow & Validation

- [x] 3.1 Create `.github/workflows/e2e-develop.yml` with `workflow_dispatch` trigger, optional `target_url` and `reset_mock_data` inputs, `actions/checkout@v7`, `actions/setup-node@v7` (Node 26 from `.nvmrc`), Playwright browser install, pre-test mock reset via `curl` to `/api/v1/external-provider/mock/reset`, and `actions/upload-artifact@v7` for `playwright-report/`; verify YAML schema matches repo invariants
- [x] 3.2 Run `npm run verify` and verify that all linting, formatting, and TypeScript strict checks pass
