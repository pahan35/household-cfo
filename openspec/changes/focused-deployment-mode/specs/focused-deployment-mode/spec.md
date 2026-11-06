# Spec Delta

## Purpose

Controls whether the application runs in a focused Family Budget deployment mode or in full upstream template showcase mode, isolating navigation, enforcing route boundaries, customizing branding/chrome, and surfacing the authenticated session user without creating upstream template merge conflicts.

## ADDED Requirements

### Requirement: Environment-driven application mode resolution
The system SHALL support two application modes via `NEXT_PUBLIC_APP_MODE`: `"focused"` and `"full"`. When `NEXT_PUBLIC_APP_MODE` is not explicitly set, the system SHALL default to `"focused"` in production or Vercel environments (`NODE_ENV === "production"`, `VERCEL === "1"`, or `VERCEL_ENV` set) and SHALL default to `"full"` in local development.

#### Scenario: Production deployment defaults to focused mode
- **WHEN** the application runs with `NODE_ENV="production"` or `VERCEL="1"` and `NEXT_PUBLIC_APP_MODE` is unset
- **THEN** the resolved application mode is `"focused"` and the home URL resolves to `/dashboard/family-budget`

#### Scenario: Local development defaults to full mode
- **WHEN** the application runs locally with `NODE_ENV="development"` (outside Vercel) and `NEXT_PUBLIC_APP_MODE` is unset
- **THEN** the resolved application mode is `"full"` and the home URL resolves to `/dashboard/default`

#### Scenario: Explicit NEXT_PUBLIC_APP_MODE override
- **WHEN** `NEXT_PUBLIC_APP_MODE` is explicitly set to `"focused"` in local development (or `"full"` in a preview build)
- **THEN** the system uses the explicitly configured mode regardless of environment defaults

### Requirement: Focused navigation and command palette filtering
In `"focused"` mode, the sidebar navigation and the `⌘J` search command dialog SHALL expose ONLY the `Family Budget` navigation items and SHALL omit all upstream template groups (`Dashboards`, `Pages`, `Legacy`, `Misc`). In `"full"` mode, the sidebar and search dialog SHALL display `Family Budget` as the first group followed by all upstream template groups.

#### Scenario: Sidebar and search command palette in focused mode
- **WHEN** the user views the sidebar or opens the `⌘J` search command dialog while the app is in `"focused"` mode
- **THEN** only `Family Budget` routes (`/dashboard/family-budget*`) are listed and searchable, and no upstream template routes (such as `CRM`, `E-commerce`, `Kanban`, or `Login v1`) appear

#### Scenario: Sidebar and search command palette in full mode
- **WHEN** the user views the sidebar or opens the `⌘J` search command dialog while the app is in `"full"` mode
- **THEN** both the `Family Budget` group and all upstream template groups (`Dashboards`, `Pages`, `Legacy`, `Misc`) are listed and searchable

### Requirement: Proxy-level redirection of upstream template routes in focused mode
In `"focused"` mode, the request boundary (`src/proxy.ts`) SHALL intercept browser navigation requests to `/`, `/dashboard`, `/dashboard/default`, and any `/dashboard/*` route outside `/dashboard/family-budget*`, redirecting them to `/dashboard/family-budget` without requiring deletion of upstream template route files on disk.

#### Scenario: Navigating to root or /dashboard in focused mode
- **WHEN** an authorized user requests `/`, `/dashboard`, or `/dashboard/default` in `"focused"` mode
- **THEN** the server redirects the user to `/dashboard/family-budget`

#### Scenario: Navigating directly to an upstream template route in focused mode
- **WHEN** an authorized user navigates directly to a template URL such as `/dashboard/crm`, `/dashboard/finance`, or `/dashboard/products` in `"focused"` mode
- **THEN** the server redirects the user to `/dashboard/family-budget`

#### Scenario: Navigating to Family Budget routes in focused mode
- **WHEN** an authorized user requests `/dashboard/family-budget` or any nested `/dashboard/family-budget/*` route in `"focused"` mode
- **THEN** the request proceeds normally without redirection

### Requirement: Focused branding and removal of template promotional chrome
In `"focused"` mode, the application SHALL display `"Family Budget"` as the application name and page metadata title, SHALL link the sidebar header logo to `/dashboard/family-budget`, and SHALL hide the upstream template promotional widgets (`SupportCard` in the sidebar footer and `GitHubRepositoriesMenu` in the top header).

#### Scenario: Dashboard shell chrome in focused mode
- **WHEN** a user renders any dashboard screen in `"focused"` mode
- **THEN** the sidebar header displays `"Family Budget"` linking to `/dashboard/family-budget`, and neither the `"Have something in mind?"` support card nor the GitHub repositories dropdown button is rendered

#### Scenario: Dashboard shell chrome in full mode
- **WHEN** a user renders any dashboard screen in `"full"` mode
- **THEN** the upstream template chrome (`SupportCard` and `GitHubRepositoriesMenu`) remains visible

### Requirement: Authenticated session user display and logout in dashboard shell
The dashboard layout SHALL resolve the current user from the Google OAuth session cookie (`family_budget_session`)—or provide a local development user identity when `isAuthBypassActive()` is enabled without a cookie—and SHALL display that user's name, email, and avatar in the sidebar `NavUser` menu and header `AccountSwitcher`. In `"focused"` mode, mock user switching and non-existent template menu actions (`Account`, `Billing`, `Notifications`) SHALL be hidden, and selecting `Log out` SHALL sign the user out via `/api/auth/logout`.

#### Scenario: Authenticated Google OAuth user views user menu in focused mode
- **WHEN** an authenticated user with session `{ name: "Jane Doe", email: "jane@example.com", picture: "https://..." }` opens the sidebar user menu or header account menu in `"focused"` mode
- **THEN** the menu displays `"Jane Doe"`, `"jane@example.com"`, and their avatar/initials, omits fake template users and mock `Account`/`Billing`/`Notifications` items, and provides a working `Log out` action targeting `/api/auth/logout`

#### Scenario: Local development with auth bypass active and no session cookie
- **WHEN** a developer runs the dashboard locally with `isAuthBypassActive() === true` and no `family_budget_session` cookie
- **THEN** the dashboard user menus render a fallback local developer identity without throwing or failing
