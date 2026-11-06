# Tasks

## 1. Mode Configuration & Navigation Isolation

- [ ] 1.1 Create `src/config/app-mode.ts` with `getAppMode`, `isFocusedMode`, `getHomeUrl`, and `isAllowedFocusedPath`, plus unit tests in `src/config/__tests__/app-mode.test.ts` verifying environment defaults (`focused` in prod/Vercel, `full` in local dev) and `NEXT_PUBLIC_APP_MODE` overrides (`npm test -- src/config/__tests__/app-mode.test.ts`)
- [ ] 1.2 Extract the `Family Budget` navigation group and its icon imports into `src/navigation/sidebar/family-budget-items.ts`, update `src/navigation/sidebar/sidebar-items.ts` to conditionally export `[familyBudgetNavGroup]` in focused mode and `[familyBudgetNavGroup, ...templateSidebarItems]` in full mode, and verify with unit tests in `src/navigation/sidebar/__tests__/sidebar-items.test.ts`
- [ ] 1.3 Add `"dev:focused": "NEXT_PUBLIC_APP_MODE=focused next dev"` to `package.json` and document `NEXT_PUBLIC_APP_MODE` in `.env.example`

## 2. Request Boundary & OAuth Redirect Enforcement

- [ ] 2.1 Update `src/proxy.ts` and `src/app/(main)/dashboard/page.tsx` so that in focused mode, requests to `/`, `/dashboard`, `/dashboard/default`, and non-`/dashboard/family-budget*` page routes redirect to `/dashboard/family-budget`, and verify with unit tests in `src/__tests__/proxy.test.ts`
- [ ] 2.2 Update `src/app/api/auth/[...auth]/route.ts` to use `getHomeUrl()` as the default `returnTo` redirect target instead of hardcoded `/dashboard/default`, and verify with unit tests in `src/app/api/auth/[...auth]/__tests__/route.test.ts`

## 3. Focused Branding, Chrome & Authenticated User Integration

- [ ] 3.1 Update `src/config/app-config.ts`, `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx`, and `src/app/(main)/dashboard/layout.tsx` so focused mode displays `"Family Budget"` branding, links the sidebar logo to `getHomeUrl()`, and hides `SupportCard` and `GitHubRepositoriesMenu`
- [ ] 3.2 Add `getDashboardUserFromCookies` in `src/server/auth/session.ts` (with unit tests in `src/server/auth/__tests__/session.test.ts`), wire `src/app/(main)/dashboard/layout.tsx` to pass the authenticated session user to `AppSidebar` (`NavUser`) and `AccountSwitcher`, hide template mock menu items in focused mode, and wire `Log out` to `/api/auth/logout`

## 4. Upstream Sync Documentation & Final Verification

- [ ] 4.1 Update `.agents/skills/sync-upstream/SKILL.md` to list `src/config/app-mode.ts` and `src/navigation/sidebar/family-budget-items.ts` under `NEVER overwrite` and document the simplified `sidebar-items.ts` merge
- [ ] 4.2 Run `npm run verify` and `npm test` to confirm all linting, formatting, strict TypeScript checks, and unit tests pass
