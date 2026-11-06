# Design

## Context

See `proposal.md` for motivation. This repository is a customized fork of `arhamkhnz/next-shadcn-admin-dashboard` synchronized selectively via `.agents/skills/sync-upstream/SKILL.md`. Currently:
1. `src/navigation/sidebar/sidebar-items.ts` mixes our 80+ lines of `Family Budget` navigation items and 15 Lucide icon imports directly into the upstream file alongside 35+ template routes (`Dashboards`, `Pages`, `Legacy`, `Misc`), making `sidebar-items.ts` a recurring hand-merge hotspot.
2. `SearchDialog` (`src/app/(main)/dashboard/_components/header/search-dialog.tsx`) computes `searchItems` at module load time directly from `sidebarItems`.
3. `src/app/(external)/page.tsx` serves the "Studio Admin" marketing landing page at `/`, and `src/app/(main)/dashboard/page.tsx` redirects `/dashboard` to `/dashboard/default`.
4. `src/app/(main)/dashboard/layout.tsx` and `app-sidebar.tsx` render template promotional components (`SupportCard`, `GitHubRepositoriesMenu`) and hardcode mock users from `src/data/users.ts` (`Arham Khan`) instead of the authenticated `SessionUser` from `src/server/auth/session.ts`.

## Goals / Non-Goals

**Goals:**
- Provide a deterministic build/runtime mode (`NEXT_PUBLIC_APP_MODE="focused" | "full"`) that defaults to `"focused"` in production/Vercel and `"full"` in local development, with `npm run dev:focused` for instant local previewing.
- Minimize upstream merge surface area so `src/app/(external)/*`, template dashboard screens, `search-dialog.tsx`, `layout-controls.tsx`, and `src/lib/preferences/*` remain 100% untouched on disk ("Bulk-adopt" on `/sync-upstream`).
- Surface the real authenticated Google OAuth user (`email`, `name`, `picture`) in `NavUser` and `AccountSwitcher`, with working `/api/auth/logout` navigation.

**Non-Goals:**
- Adding a dynamic cookie/Zustand toggle inside `LayoutControls` (which would diverge `src/lib/preferences/*`, `layout-controls.tsx`, and `search-dialog.tsx`).
- Deleting upstream template page files from the repository.

## Decisions

1. **Static Environment Mode Module (`src/config/app-mode.ts`)**
   - *Decision*: Create `src/config/app-mode.ts` exporting:
     - `type AppMode = "focused" | "full"`
     - `getAppMode(env = process.env): AppMode` — returns `"focused"` if `env.NEXT_PUBLIC_APP_MODE === "focused"`, `"full"` if `env.NEXT_PUBLIC_APP_MODE === "full"`, and otherwise defaults to `"focused"` when `env.NODE_ENV === "production" || env.VERCEL === "1" || Boolean(env.VERCEL_ENV)` and `"full"` in local development.
     - `isFocusedMode(env = process.env): boolean`
     - `getHomeUrl(env = process.env): string` — returns `"/dashboard/family-budget"` in focused mode and `"/dashboard/default"` in full mode.
   - *Rationale*: Using `NEXT_PUBLIC_APP_MODE` allows both Server Components/Proxy and Client Components (`app-sidebar.tsx`, `sidebar-items.ts`, `APP_CONFIG`) to read the mode synchronously at module initialization time without cookie plumbing or SSR hydration complexity.
   - *Alternatives considered*: Storing mode in `PREFERENCE_REGISTRY` and `LayoutControls`. Rejected because `search-dialog.tsx` evaluates `sidebarItems` once at module import time, and modifying `PREFERENCE_REGISTRY` / `LayoutControls` would create unnecessary upstream sync conflicts.

2. **Isolated Family Budget Navigation (`src/navigation/sidebar/family-budget-items.ts`)**
   - *Decision*: Move the `Family Budget` `NavGroup` and all its specific Lucide icon imports out of `src/navigation/sidebar/sidebar-items.ts` into `src/navigation/sidebar/family-budget-items.ts`. In `sidebar-items.ts`, keep upstream's icon imports and groups in `templateSidebarItems: NavGroup[]`, and export:
     ```ts
     export const sidebarItems: NavGroup[] = isFocusedMode()
       ? [familyBudgetNavGroup]
       : [familyBudgetNavGroup, ...templateSidebarItems];
     ```
   - *Rationale*: Shrinks our diff in `sidebar-items.ts` to 2 lines at the bottom of the file, eliminating top-of-file icon import conflicts during `/sync-upstream` while automatically filtering `SearchDialog` (`⌘J`) in focused mode with zero edits to `search-dialog.tsx`.

3. **Request-Boundary Route Redirection in `src/proxy.ts`**
   - *Decision*: After authentication/bypass checks pass in `src/proxy.ts`, if `isFocusedMode()` is true and the request is not an API/auth/unauthorized/static path (`!pathname.startsWith("/api/")`, `!isPublicPath(pathname)`), check whether `pathname === "/dashboard/family-budget" || pathname.startsWith("/dashboard/family-budget/")`. If not (e.g., `/`, `/dashboard`, `/dashboard/default`, `/dashboard/crm`, etc.), return a `307` redirect to `/dashboard/family-budget`. Also update `src/app/(main)/dashboard/page.tsx` and `/api/auth/[...auth]/route.ts` to use `getHomeUrl()`.
   - *Rationale*: Enforcing route visibility in `src/proxy.ts` means `src/app/(external)/page.tsx` and all 35+ template routes under `src/app/(main)/dashboard/` stay completely untouched on disk and can be bulk-adopted on every upstream sync.

4. **Server-Resolved Session User in `dashboard/layout.tsx`**
   - *Decision*: Add `getDashboardUserFromCookies(cookieStore, env)` in `src/server/auth/session.ts` which verifies the `family_budget_session` cookie via `verifySessionToken`. If valid, it returns `{ id: session.email, name: session.name || session.email.split("@")[0], email: session.email, avatar: session.picture || "", role: "Family Member" }`. When no session cookie is present (e.g., local development with `isAuthBypassActive()`), it falls back to `{ id: "local-dev", name: "Local Dev", email: "dev@localhost", avatar: "", role: "Developer" }` in focused mode or `rootUser` in full mode.
   - Pass this resolved user from `dashboard/layout.tsx` into `<AppSidebar user={currentUser} />` and `<AccountSwitcher users={...} />`.
   - In `NavUser` and `AccountSwitcher`, wire the `Log out` menu item to navigate to `/api/auth/logout` (`<a href="/api/auth/logout">`), and when `isFocusedMode()` is true, hide the mock template menu group (`Account`, `Billing`, `Notifications`).

## Risks / Trade-offs

- **Risk**: Next.js static prerendering caches `NEXT_PUBLIC_APP_MODE` at build time.
  → **Mitigation**: `NEXT_PUBLIC_APP_MODE` is intentionally a deployment/startup-time mode (`npm run dev` vs `npm run dev:focused` vs `npm run build`), and `getAppMode(env)` reads `env.NEXT_PUBLIC_APP_MODE` dynamically in unit tests and server code.
- **Risk**: Upstream updates to `sidebar-items.ts`, `app-sidebar.tsx`, or `dashboard/layout.tsx`.
  → **Mitigation**: Update `.agents/skills/sync-upstream/SKILL.md` to document `src/navigation/sidebar/family-budget-items.ts` and `src/config/app-mode.ts` under "NEVER overwrite" and note the minimal 2-line hook in `sidebar-items.ts`.
