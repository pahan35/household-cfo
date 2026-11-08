# Contributing to Household CFO

Thank you for your interest in contributing to **Household CFO**!  
This guide will walk you through setting up your local environment, running the app in mock mode, understanding our architecture, and opening pull requests.

---

## Overview

**Household CFO** is an executive-grade personal and household financial cockpit built with:
- **Next.js 16** (App Router, React 19)
- **TypeScript** (Strict mode)
- **Tailwind CSS v4** & **shadcn/ui**
- **Supabase / PostgreSQL** with an extensible adapter layer for external financial providers
- **Biome** for fast linting & formatting, **Vitest** for testing

---

## Quick Start / Local Setup

### 1. Fork & Clone
Fork the repository on GitHub at [github.com/pahan35/household-cfo](https://github.com/pahan35/household-cfo), then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/household-cfo.git
cd household-cfo
```

### 2. Node Version & Dependencies
This project requires **Node.js 26+** (specified in `.nvmrc` and `package.json` engines).

```bash
# If using nvm / fnm:
nvm use

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy the example environment file:

```bash
cp .env.example .env.local
```

For quick local development without configuring any databases or credentials, Household CFO includes a **zero-dependency mock mode**:

```env
# .env.local
EXTERNAL_API_ADAPTER="mock"
AUTH_BYPASS_LOCAL="true"
```

- In `EXTERNAL_API_ADAPTER="mock"` mode, an in-memory & seeded financial dataset is used. No external tokens or network calls are required.
- In `AUTH_BYPASS_LOCAL="true"` mode, Google OAuth authentication is bypassed for seamless local development.

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Codebase Architecture

We adhere to a **colocation and layered backend architecture**:

```
src/
├── app/
│   ├── (auth)/                               # Google OAuth & session management
│   ├── (main)/
│   │   └── dashboard/
│   │       ├── family-budget/                # Core Household CFO cockpit
│   │       │   ├── _components/              # Feature components, charts, dialogs
│   │       │   ├── lifestyle/                # Discretionary spending, travel assistants
│   │       │   ├── mortgage/                 # Mortgage & prepayment amortization
│   │       │   ├── offer-comparator/         # Total compensation & tax impact comparator
│   │       │   └── runway/                   # Capital pool & runway simulator
│   │       └── ...                           # General admin & analytics screens
│   └── api/
│       ├── external-provider/                # Upstream sync & cron webhooks
│       └── v1/                               # Versioned REST API (mobile & integrations)
├── components/
│   └── ui/                                   # shadcn/ui components (radix-nova)
├── lib/
│   └── schemas/                              # Shared Zod DTO contracts & schemas
├── server/
│   ├── actions/                              # Safe Server Actions (mutations)
│   ├── external-provider/                    # Pluggable adapter interfaces & engines
│   ├── services/                             # Transport-agnostic business logic
│   └── supabase/                             # PostgreSQL connection & config
└── styles/presets/                           # Theme presets (light/dark mode)
```

### Architectural Principles
1. **Colocation**: Keep UI components, client transformers, and feature tests close to their route inside `_components/`.
2. **Layered Backend**: Business logic belongs in `src/server/services/`, web mutations in `src/server/actions/`, and REST endpoints under `/api/v1/`.
3. **Pluggable Adapters**: Financial sync is abstracted via `src/server/external-provider/adapter.ts`, supporting both `"mock"` and live `"external-provider"` modes.
4. **Strict Secrets**: Never hardcode credentials, tokens, or personal identifiers. Follow the guidelines in `.agents/rules/secrets.md`.

---

## Verification & Testing

Always verify that your changes pass linting, formatting, and strict type checking before opening a pull request:

```bash
# Run Biome lint/format + TypeScript strict check (~5s):
npm run verify

# Run unit and integration tests:
npm test

# Auto-fix formatting and imports:
npm run check:fix
```

---

## Contribution Workflow

1. Create a focused branch from `main`:
   ```bash
   git checkout -b feat/runway-scenario-export
   ```
2. Commit your changes using **Conventional Commits**:
   ```bash
   git commit -m "feat(runway): add CSV export for capital pool projections"
   ```
3. Ensure `npm run verify` and `npm test` exit with `0`.
4. Push your branch and open a Pull Request against `pahan35/household-cfo:main`.
5. If your PR introduces visual changes, include screenshots or screen recordings (both light and dark modes).

---

## Upstream Template Synchronization

Household CFO was originally bootstrapped from the open-source [Studio Admin](https://github.com/arhamkhnz/next-shadcn-admin-dashboard) template by Mohammed Arham Khan. We periodically pull and integrate upstream layout, UI component, and design system updates from `upstream/main`.

---

Thank you for helping make Household CFO better! 🚀
