---
name: sync-upstream
description: Sync changes from the upstream template remote `upstream/main` into this repo. Use when the user asks to sync/check/adopt changes from upstream or the admin dashboard template.
user-invocable: true
---

# Sync Upstream Template (upstream/main)

Upstream remote: `upstream` → `arhamkhnz/next-shadcn-admin-dashboard` (branch `main`).
This repo is a customized family budget dashboard based on the template; upstream changes
are adopted selectively, never merged blindly.

## 0. Preconditions

- Working tree must be clean (`git status --porcelain` empty). Commit or stash first.
- Confirm branch vs `origin` (`git status -sb`).

## 1. Anchor (deterministic — never guess by date)

Every sync commit carries a git trailer pointing at the exact upstream commit it integrated:

```bash
git log --grep='^Upstream-Sync:' -1 --format='%h %(trailers:key=Upstream-Sync,valueonly)'
```

> **Note**: If no commit has an `Upstream-Sync:` trailer yet, use the initial fork baseline:
> `3c5d80523d5a3f11acbc51d8158cd85a76f3a94b`

## 2. Scope the delta (read-only)

Check without fetching: `git ls-remote upstream main`.
For the full scope:

```bash
git fetch upstream main
git log --oneline <anchor-sha>..upstream/main
git diff --name-status <anchor-sha>..upstream/main
```

Find overlapping modifications:

```bash
git diff --name-only <our-last-sync-or-fork-commit> HEAD > /tmp/ours.txt
git diff --name-only <anchor-sha>..upstream/main > /tmp/theirs.txt
comm -12 <(sort /tmp/ours.txt) <(sort /tmp/theirs.txt)
```

Classify each change:
- **Bulk-adopt** (`git checkout upstream/main -- <paths>`): `src/components/ui/*`,
  template dashboard screens, generic utilities, `src/lib/preferences/*`, theme presets.
- **Hand-merge** (we diverge by design):
  - `package.json` (keep family budget deps and dev:focused script; adopt template version bumps)
  - `src/navigation/sidebar/sidebar-items.ts` (keep 2-line focused-mode hook importing `familyBudgetNavGroup` from `./family-budget-items`)
  - `next.config.mjs` (keep `turbopack.root: path.resolve(__dirname)` and any custom config)
  - `biome.json` and `tsconfig.json`
  - `src/app/layout.tsx`
- **NEVER overwrite**:
  - `src/config/app-mode.ts`
  - `src/navigation/sidebar/family-budget-items.ts`
  - `src/server/external-provider/*`
  - `src/app/api/external-provider/*`
  - `src/app/(main)/dashboard/family-budget/*`
  - `openspec/*`
  - `.agents/rules/secrets.md`
- **NEVER adopt**: `vercel.json` (demo redirects), demo README links.
- **API migrations**: If upstream changes shared utilities (e.g. `cn`, table APIs),
  migrate local consumers in budget screens as well.

## 3. Apply

1. Bulk-checkout adopted files; hand-merge diverged ones.
2. **Lockfile & Transitive Alignment**:
   Whenever upstream updated `package.json` or `package-lock.json`:
   - `git checkout upstream/main -- package-lock.json`
   - Run `npm i` to append local dependencies onto upstream's clean transitive tree.
   - Run `npm run format -- package.json` to reconcile with Biome formatting.
3. If `next` was updated, run `rm -rf .next` to invalidate stale caches.

## 4. Verify

```bash
npx biome check $(git status --porcelain | awk '{print $2}' | grep -v '^package-lock.json$')
npm run format
npx tsc --noEmit
npm audit
```

## 5. Commit with the trailer

```bash
git commit -m "chore(template): sync upstream through <new-upstream-sha>" \
  -m "<what was adopted / skipped / fixed>" \
  -m "Upstream-Sync: upstream/main@<new-upstream-sha>"
```
