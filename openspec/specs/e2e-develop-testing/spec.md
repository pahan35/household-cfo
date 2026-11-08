# e2e-develop-testing Specification

## Purpose
Provides automated browser-based End-to-End (E2E) testing against the deployed Vercel Develop environment, featuring workflow-side pre-signed session cookie authentication, pre-test mock state resets, failure artifact reporting, and manual GitHub CI workflow orchestration.

## Requirements

### Requirement: Headless Playwright test runner configuration with target environment resolution
The system SHALL provide an E2E test runner configuration using `@playwright/test` that resolves its base target URL from the `E2E_BASE_URL` or `PLAYWRIGHT_TEST_BASE_URL` environment variables. The runner SHALL execute tests headlessly in Chromium with configurable action/navigation timeouts and SHALL capture test traces, full-page screenshots, and failure recordings into `playwright-report/`.

#### Scenario: Running test suite against configured base URL
- **WHEN** the test suite is executed with `E2E_BASE_URL="https://family-budget-git-develop.vercel.app"`
- **THEN** Playwright executes all test navigations and API requests relative to that origin without hardcoded local addresses

#### Scenario: Capturing failure diagnostics
- **WHEN** an assertion fails during an E2E test execution
- **THEN** Playwright persists a trace archive, failure screenshot, and failure video into `playwright-report/`

### Requirement: Workflow-side pre-signed session cookie authentication for protected routes
The E2E test harness SHALL provide an authentication helper that generates an HMAC-SHA256 signed session cookie (`family_budget_session`) using the shared `AUTH_SECRET` for an email address authorized in `ALLOWED_USER_EMAILS`. The test runner SHALL inject this cookie into the browser context so dashboard and protected routes can be navigated without interactive Google OAuth login.

#### Scenario: Injecting valid session cookie bypasses login redirect
- **WHEN** Playwright initializes a browser context with a pre-signed `family_budget_session` cookie created with `AUTH_SECRET` for `e2e-runner@family-budget.internal`
- **THEN** navigating to `/dashboard/family-budget` renders the authenticated dashboard without redirecting to `/auth/login`

#### Scenario: Unauthenticated browser context redirects to login
- **WHEN** Playwright navigates to `/dashboard/family-budget` without a session cookie
- **THEN** the server proxy redirects the browser to `/auth/login` with a `returnTo` query parameter

### Requirement: Vercel deployment automation protection bypass header propagation
When `VERCEL_AUTOMATION_BYPASS_SECRET` is present in the execution environment, the E2E test runner SHALL attach the `x-vercel-protection-bypass` HTTP request header to all browser and API requests issued by Playwright.

#### Scenario: Navigating protected Vercel preview deployment
- **WHEN** `VERCEL_AUTOMATION_BYPASS_SECRET` is configured in the environment
- **THEN** all outgoing Playwright browser requests include the `x-vercel-protection-bypass` header, allowing access through Vercel Deployment Protection

### Requirement: Automated pre-test deterministic mock database reset
The E2E test workflow SHALL support resetting the target Develop environment to the deterministic seed snapshot before test execution by issuing an authenticated `POST /api/v1/external-provider/mock/reset` HTTP request using `Authorization: Bearer <MOBILE_API_TOKENS>`.

#### Scenario: Successful pre-test state reset
- **WHEN** the workflow executes the pre-test reset step against a Develop instance running in `EXTERNAL_API_ADAPTER="mock"` mode
- **THEN** the server returns `200 OK` with the deterministic seed snapshot, restoring account balances, categories, and transactions to their baseline state

#### Scenario: Reset failure halts test workflow
- **WHEN** the reset endpoint fails or returns a non-200 status code
- **THEN** the workflow terminates immediately and does not proceed to test execution

### Requirement: Manual GitHub Actions CI workflow orchestration with artifact reporting
The system SHALL provide a GitHub Actions workflow (`.github/workflows/e2e-develop.yml`) triggered manually via `workflow_dispatch`. The workflow SHALL accept optional inputs for overriding the target URL and toggling mock data reset. The workflow MUST use Node.js anchored to `.nvmrc` (`actions/setup-node@v7`), `actions/checkout@v7`, and `actions/upload-artifact@v7` for publishing `playwright-report/`.

#### Scenario: Manual trigger with default Develop environment
- **WHEN** an operator manually dispatches the E2E workflow without custom inputs
- **THEN** the workflow executes against the default Develop base URL, resets mock data, runs the Playwright test suite, and uploads test artifacts on failure or completion
