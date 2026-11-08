# Household CFO

> **An evolving executive-grade household financial cockpit with pluggable external API adapters — featuring capital runway simulation, mortgage modeling, inflation analytics, and an expanding financial toolkit. Built with Next.js 16, React 19, and Supabase.**

[![GitHub License](https://img.shields.io/github/license/pahan35/household-cfo)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com/)

> [!NOTE]
> 🚧 **Active Development**: Household CFO is actively evolving. New financial simulation models, scenario planning tools, and external provider integrations are continuously in progress.

---

## 🌟 Key Capabilities

### 1. 🚀 Capital Runway & Solvency Engine
- **Liquid Capital Pools**: Aggregate cash, equivalents, and reserve tiers across multi-currency accounts.
- **Scenario Simulation**: Stress-test household solvency across variable income disruption, career transitions, and macro shifts.
- **Burn-Rate Projections**: Dynamic monthly runway forecasting under essential vs. discretionary spending profiles.

### 2. 📈 Macroeconomic Telemetry & Inflation Analytics
- **CPI Inflation Tracking**: Visualize cumulative purchasing power erosion and benchmark nominal expenses against real purchasing power.
- **Multi-Currency & FX Monitoring**: Track cross-currency spending volatility and currency exposure across primary and secondary accounts.

### 3. 💼 Compensation & Offer Comparator
- **Net Budget Impact**: Model multiple job offers side-by-side.
- **Total Rewards Valuation**: Accounts for gross-to-net tax brackets, signing bonuses, and equity compensation to determine actual household cashflow changes.

### 4. 🏠 Mortgage & Debt Payoff Modeler
- **Amortization Simulator**: Model mortgage schedules and visualize interest savings from early prepayments.
- **Capital Trade-Offs**: Compare early mortgage amortization against investing reserve liquidity in conservative capital pools.

### 5. 🔌 Pluggable External API & Storage Architecture
- **Dual-Mode Adapter Layer**:
  - `mock`: Runs fully offline with rich deterministic seed data — zero credentials or external databases required.
  - `external-provider`: Syncs with external financial APIs or self-hosted aggregators using secure server-side tokens and proxy routing.
- **PostgreSQL / Supabase Persistence**: Full relational schema for transactions, categories, and sync metadata with RLS security policies.

### 6. 📱 Mobile & Automation Ready
- **Versioned REST API (`/api/v1`)**: Clean endpoints for categories and transactions, secured by Bearer tokens for integration with iOS/Android Shortcuts or automation webhooks.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Component Library**: [shadcn/ui](https://ui.shadcn.com/) (`radix-nova` primitives)
- **Database & Sync**: [Supabase](https://supabase.com/) (PostgreSQL with RLS)
- **State & Data Fetching**: [SWR](https://swr.vercel.app/) client cache with Next.js Server Actions
- **Validation**: [Zod](https://zod.dev/)
- **Tooling**: [Biome](https://biomejs.dev/) (Linting & Formatting), [Vitest](https://vitest.dev/) (Unit & Integration tests)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `26.0.0` or higher (verified via `.nvmrc`)
- **npm**: `10+`

### 1. Clone & Install

```bash
git clone https://github.com/pahan35/household-cfo.git
cd household-cfo
npm install
```

### 2. Configure Environment

Copy the template environment file:

```bash
cp .env.example .env.local
```

#### Zero-Config Mock Mode (Default for Local Development)
To run immediately without connecting to Supabase or an external financial provider:

```env
# .env.local
EXTERNAL_API_ADAPTER="mock"
AUTH_BYPASS_LOCAL="true"
```

- **`EXTERNAL_API_ADAPTER="mock"`**: Uses an in-memory & file-backed store populated with realistic multi-currency categories and transactions.
- **`AUTH_BYPASS_LOCAL="true"`**: Automatically bypasses Google OAuth in local development.

#### Live Database / Supabase Mode (Optional)
If you wish to connect to a live Supabase instance:

```env
# .env.local
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_SECRET_KEY="sb_secret_..."
EXTERNAL_API_ADAPTER="external-provider"
```

### 3. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## 🧪 Testing & Verification

Household CFO enforces strict type safety and code quality standards:

```bash
# Run Biome lint/format checks and TypeScript strict type checking:
npm run verify

# Run Vitest unit & integration test suites:
npm test

# Automatically fix linting and import order diagnostics:
npm run check:fix
```

---

## 📁 Project Architecture

Feature code is co-located within its dashboard route:

```
src/
├── app/
│   ├── (auth)/                               # OAuth sign-in & session flows
│   ├── (main)/
│   │   └── dashboard/
│   │       ├── family-budget/                # Household CFO core cockpit
│   │       │   ├── _components/              # Visualizations, tables, and dialogs
│   │       │   ├── lifestyle/                # Discretionary spending assistants
│   │       │   ├── mortgage/                 # Mortgage scenario calculator
│   │       │   ├── offer-comparator/         # Compensation net impact comparator
│   │       │   └── runway/                   # Solvency & capital runway simulator
│   │       └── ...                           # Additional admin & analytics views
│   └── api/
│       ├── external-provider/                # Sync engine & cron endpoints
│       └── v1/                               # REST API for mobile clients
├── components/ui/                             # shadcn/ui components
├── lib/schemas/                              # Shared Zod contracts & DTOs
└── server/
    ├── actions/                              # Safe Server Actions
    ├── external-provider/                    # Pluggable adapter interfaces
    ├── services/                             # Transport-agnostic business logic
    └── supabase/                             # Database client & configurations
```

---

## 🤝 Contributing

Contributions, issues, and feature suggestions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for local setup instructions and contribution guidelines.

---

## 🏛️ Acknowledgments & Upstream Template

Household CFO was originally bootstrapped from the open-source [Studio Admin](https://github.com/arhamkhnz/next-shadcn-admin-dashboard) dashboard template by Mohammed Arham Khan. We periodically pull and integrate upstream layout, UI component, and design system updates.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
