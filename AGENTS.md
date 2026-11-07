# AGENTS.md

## Project overview

Studio Admin is a responsive admin dashboard built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui.

This repository uses the shadcn `radix-nova` style. The shadcn CLI reports `base: "radix"`, which refers to Radix UI. Always inspect the local components in `src/components/ui/` because individual wrappers may use different primitives.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Secrets

This project proxies a third-party API through `src/app/api/external-provider/[...path]/route.ts`. Credentials are read server-side by `src/server/external-provider/token.ts` from the macOS keychain (in default `EXTERNAL_API_SECRET_SOURCE="keychain"` mode) or from server-side environment variables (`EXTERNAL_API_SECRET_SOURCE="env"` on Vercel). No source file contains a secret.

Never read, print, log, echo, commit, or write a credential into any file. Concretely, do not open `.env` or `.env.*` (`.env.example` holds placeholders only), do not run `security find-generic-password`, and do not dump the environment with `env` or `printenv`. Ask the user to perform keychain operations themselves.

Call `/api/external-provider/...` from client code and let the server attach the credential. Never add a `NEXT_PUBLIC_` variable holding a token, since that prefix inlines the value into the browser bundle. To reach a new upstream endpoint, add an explicit path prefix to `PATH_ALLOWLIST` in `src/server/external-provider/config.ts`; wildcards and empty prefixes are not allowed.

Per-agent enforcement lives in `opencode.json`, `.aiignore`, `.agents/rules/secrets.md`, and `.gitignore`. Keep those in sync when adding a new secret-bearing file type.

## shadcn skill

Use the shadcn skill for all work involving shadcn/ui components, styling, composition, registries, presets, or `components.json`.

If the skill is not available, install it with:

```bash
npx skills add shadcn/ui
```

The skill contains the component, styling, composition, accessibility, and CLI rules. Do not duplicate those rules here. Always inspect the local component source before using it.

Do not modify files inside `src/components/ui/` or `src/components/calendar/`. Keep these components intact and apply styling or customization where they are used.

## Setup

This project uses npm.

```bash
npm install
npm run dev
```

Available commands:

```bash
npm run build
npm run lint
npm run format
npm run check
npm run check:fix
npm run verify
npm test
npm run generate:presets
```

Run build, lint, check, test (`npm test` runs `vitest run`), or other validation commands when verifying relevant code changes or when explicitly requested. For fast static validation, prefer `npm run verify` (`biome check && tsc --noEmit`), which verifies linting, formatting, and full TypeScript strict types in ~5 seconds without the multi-minute overhead of a full production `npm run build`.

## Co-location-based structure

Keep feature code close to the route that owns it.

- Dashboard routes: `src/app/(main)/dashboard/<screen>/page.tsx`
- Screen-specific components, data, and schemas: `src/app/(main)/dashboard/<screen>/_components/`
- Shared dashboard components: `src/app/(main)/dashboard/_components/`
- Shared application components: `src/components/`
- Local shadcn components: `src/components/ui/`
- Shared hooks and utilities: `src/hooks/` and `src/lib/`
- Theme presets: `src/styles/presets/`

Keep a component inside its route until it is reused by another feature. Do not move screen-specific code into a shared directory preemptively.

## Creating or extending a screen

1. Inspect the closest current screen before writing code. Finance, Infrastructure, CRM, and Analytics are useful references. Do not use routes under `(legacy)` as references for new screens unless maintaining a legacy route.
2. When reproducing a UI from a screenshot or image, follow its visual direction closely, including layout, hierarchy, spacing, component structure, and important details. Implement it with the project's existing components and semantic theme tokens rather than copying raw color values. If the design needs a color that is not available through the existing theme tokens, or the user explicitly requests a non-theme color, use a named color from Tailwind's default palette. Do not use arbitrary hex, RGB, HSL, or OKLCH values.
3. Reuse the existing dashboard shell, local components, layout controls, and theme tokens.
4. Break each new page into focused components inside the route's `_components/` directory. Keep `page.tsx` small and focused on composing those pieces.
5. Keep `page.tsx` as a Server Component by default. Move interactive or browser-dependent code into a dedicated Client Component.
6. Add the screen to `src/navigation/sidebar/sidebar-items.ts` when it should appear in the dashboard navigation.
7. Decide the information hierarchy before choosing widgets. Let the content determine the page structure.
8. Keep the established visual rhythm where it fits: compact spacing, clear typography hierarchy, responsive action rows, and grids that collapse cleanly on smaller screens.
9. Widget selection is not a fixed formula. Try different arrangements of cards, resource rows, meters, charts, tabs, empty states, and actions, then keep the version that communicates the content clearly and feels consistent with the project.
10. Match nearby screens in card density, borders, radius, spacing, content width, and responsive behavior.
11. Use semantic theme tokens so new screens work with light mode, dark mode, and the existing theme presets.
12. Handle relevant loading, empty, error, disabled, and overflow states.
13. Keep screens accessible with semantic HTML, keyboard support, visible focus states, labels, and appropriate ARIA attributes.

## Code conventions

- TypeScript strict mode is enabled. Use precise types and avoid `any`.
- Use the existing `@/` import aliases.
- Follow the Biome configuration: double quotes, semicolons, two-space indentation, sorted imports, and a 120-character line width.
- Avoid unnecessary dependencies.
- Keep changes focused and do not refactor unrelated files.

## Operational guardrails & workflow

1. **Mandatory Commits on Completion & Proposal Phases**: Whenever you finish implementing, fixing, completing a requested task, or completing an OpenSpec proposal/planning phase, you **MUST** commit your work before finishing your turn. Do not ask for permission or wait for the user to prompt you to commit.
   - Run formatting (`npm run format`) before committing.
   - Stage modified or untracked files strictly relevant to the completed task or proposal.
   - **Strict Scope Isolation (Parallel Sessions)**: NEVER blanket-stage files (`git add .`, `git add -A`, or directory-wide adds). In multi-agent environments, concurrent sessions or background agents may have in-progress uncommitted changes in the working tree. ONLY stage explicit files directly modified as part of your prompt. Always verify with `git diff --staged --name-only` before committing to ensure no parallel session files are swept in.
   - Commit using a concise Conventional Commits message (e.g., `feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`).
   - Never run `git push` unless explicitly asked.

2. **Spec-Driven Planning (OpenSpec)**: For non-trivial features, refactors, or multi-step capabilities:
   - **Propose & Specify**: Use `/opsx-propose <feature-name>` (or `openspec new change <feature-name>`). OpenSpec scaffolds `proposal.md`, `specs/`, `design.md`, and `tasks.md`.
   - **Multi-Change Batching**: When scaffolding multiple OpenSpec changes using the same schema in one turn, run `openspec instructions <artifact-id> --change <first-change> --json` once per artifact type (`proposal`, `specs`, `design`, `tasks`) rather than repeating identical instruction lookups for every change.
   - **Validate**: Check spec validity with `openspec validate <feature-name>`.
   - **Immediate Proposal Commit**: Commit change artifacts right after proposal and planning artifacts (`proposal.md`, `specs/`, `design.md`, `tasks.md`) are drafted and validated (e.g., `docs(spec): propose <feature-name>`). Commit artifacts carefully with strict scope isolation: stage ONLY explicit files in `openspec/changes/<feature-name>/`, because other agentic sessions may be working in parallel on other non-conflicting changes in the working tree.
   - **Implement**: Implement according to the checklist in `tasks.md` (or `/opsx-apply`). Update `tasks.md` as items complete and commit milestones progressively.
   - **Archive & Living Specs**: On completion, run `openspec archive <feature-name>` to merge the change into living specs (`openspec/specs/`) and commit the archived change.

## Contributions

- Use conventional commit prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, and `chore:`.
- Include screenshots for new screens and material visual changes. Include mobile and dark-theme states when relevant.
- Explain new reusable patterns or dependencies in the pull request.
- Follow `CONTRIBUTING.md` for the contribution workflow.

# Shared Agent Work Protocol (Beads)

This repository uses Beads (`bd`) for cross-harness task and context management.
Every agentic harness (Antigravity, OpenCode, Junie, etc.) must adhere to these rules:

## Sandbox & Execution Environment

In sandboxed agent environments (such as Antigravity):
1. **Always execute all `bd` commands outside the sandbox (`BypassSandbox: true`)**:
   - `bd` requires access to Dolt configuration (`~/.dolt/config_global.json`) and external planning paths (such as `~/.beads-planning`), which reside outside the workspace sandbox.
   - Never attempt to run `bd` in sandboxed mode; always bypass sandbox isolation for any `bd` invocation.
2. **Execute mutating `git` commands outside the sandbox (`BypassSandbox: true`)**:
   - The sandbox blocks creating `.git/index.lock` and writing to `.git/` (failing with exit code `128: Operation not permitted`).
   - Run mutating `git` commands (`git add`, `git commit`, `git stash`, `git rm`, `git mv`) directly with `BypassSandbox: true` as standalone, prefix-matchable commands (never chained with `&&`).
   - Keep read-only `git` commands (`git status`, `git diff`, `git log`, `git show`) inside the sandbox (`BypassSandbox: false`).
3. **Execute Supabase CLI commands outside the sandbox (`BypassSandbox: true`)**:
   - `supabase` is invoked via `npx supabase` and is not installed in local `node_modules`. Package retrieval from registry and remote database interaction (`--remote`) require external network access.
   - Standard sandbox mode blocks network calls with `npm error 403 Forbidden`.
   - Always run `npx supabase ...` with `BypassSandbox: true`.

## Session Start & Context Recovery

1. Never guess the current state or rely on memory summaries. Always inspect the active task graph:
   ```bash
   bd prime
   bd ready
   ```
2. Select the top actionable task from `bd ready`. Inspect its requirements and context:
   ```bash
   bd show <task-id>
   ```
3. Claim the task before making code changes to establish ownership:
   ```bash
   bd update <task-id> --claim
   ```

## During Execution & Handoffs

- If blocked or making architectural decisions that incoming agents must know, record brief notes:
  ```bash
  bd update <task-id> --notes "Decided approach X; blocked on Y"
  ```
- If creating subtasks or dependencies:
  ```bash
  bd create --title "Subtask name" --parent <parent-id>
  bd dep add <blocked-id> <prerequisite-id>
  ```

## Session Close / Quota Exhaustion / Task Completion

- If finished with a task:
  ```bash
  bd close <task-id>
  ```
- If your quota runs out or session ends mid-task:
  1. Stash or commit clean working changes in git.
  2. Update the claimed task with progress notes (`bd update <task-id> --notes "Stopped at step N: ..."`).
  3. Leave the task open so the next harness can immediately pick it up via `bd ready`.
