# Proposal

## Why

When deploying the application to production (or running it as a dedicated family finance tool), exposing 35+ upstream "Studio Admin" template demo screens (`/dashboard/crm`, `/dashboard/ecommerce`, landing page, `@arhamkhnz` support card, GitHub template repo links, and mock user profiles) clutters the UI and leaks template scaffolding. At the same time, deleting or heavily editing upstream files would create painful merge conflicts during every `/sync-upstream` update, and we still want to easily run the full template showcase in local development when referencing upstream components.

## What Changes

- **Environment-Controlled Application Mode (`src/config/app-mode.ts`)**: Introduce `NEXT_PUBLIC_APP_MODE` (`"focused"` | `"full"`), defaulting automatically to `"focused"` in production/Vercel (`NODE_ENV === "production"` or `VERCEL === "1"`) and `"full"` in local development, with an `npm run dev:focused` script for one-command local previewing.
- **Zero-Conflict Navigation Isolation (`src/navigation/sidebar/family-budget-items.ts`)**: Extract the `Family Budget` navigation group and its icon imports out of `src/navigation/sidebar/sidebar-items.ts` into a dedicated module. Keep upstream's template groups untouched in `sidebar-items.ts` and conditionally export only `[familyBudgetNavGroup]` in focused mode (which automatically scopes both the sidebar and the `⌘J` `SearchDialog` command palette without modifying `search-dialog.tsx`).
- **Focused Route Boundary Enforcement (`src/proxy.ts` & `/dashboard/page.tsx`)**: In focused mode, intercept requests to `/`, `/dashboard`, `/dashboard/default`, and any non-Family-Budget template route (e.g., `/dashboard/crm`, `/dashboard/finance`, `/dashboard/products`) in `src/proxy.ts` and redirect them to `/dashboard/family-budget`, leaving all upstream page files untouched on disk for conflict-free bulk adoption during `/sync-upstream`.
- **Focused Branding & Chrome (`src/config/app-config.ts`, `app-sidebar.tsx`, `dashboard/layout.tsx`)**: In focused mode, present `"Family Budget"` as the application name/metadata, point the sidebar header logo to `/dashboard/family-budget`, and hide upstream template promotional chrome (`SupportCard` in the sidebar footer and `GitHubRepositoriesMenu` in the header).
- **Authenticated User Profile & Logout in Dashboard Shell (`dashboard/layout.tsx`, `nav-user.tsx`, `account-switcher.tsx`, `src/server/auth/session.ts`)**: Resolve the signed `google-oauth-family-allowlist` session user (`name`, `email`, `picture`) on the server in `dashboard/layout.tsx` (with a sensible local-dev fallback when `isAuthBypassActive()` is enabled), display the authenticated user in `NavUser` and `AccountSwitcher`, hide template mock menu items (`Account`, `Billing`, `Notifications`, and fake user switching) in focused mode, and wire `Log out` to `/api/auth/logout`.

## Capabilities

### New Capabilities
- `focused-deployment-mode`: Environment-driven mode switching (`focused` vs `full`), conflict-free navigation isolation, proxy-level blocking/redirection of upstream template routes, focused Family Budget branding/chrome, and authenticated session user display in the dashboard shell.

### Modified Capabilities
- `family-oauth-access-control`: Update default post-login redirect fallback from hardcoded `/dashboard/default` to the mode-aware home route (`/dashboard/family-budget` in focused mode, `/dashboard/default` in full mode).

## Impact

- **New files (zero upstream overlap)**: `src/config/app-mode.ts`, `src/navigation/sidebar/family-budget-items.ts`, and unit tests.
- **Minimal touchpoints in diverged/shared files**: `src/navigation/sidebar/sidebar-items.ts` (reduces divergence by extracting Family Budget items), `src/config/app-config.ts`, `src/proxy.ts`, `src/app/api/auth/[...auth]/route.ts`, `src/server/auth/session.ts`, `src/app/(main)/dashboard/layout.tsx`, `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx`, `src/app/(main)/dashboard/_components/sidebar/nav-user.tsx`, `src/app/(main)/dashboard/_components/header/account-switcher.tsx`, `package.json`, and `. agents/skills/sync-upstream/SKILL.md`.
