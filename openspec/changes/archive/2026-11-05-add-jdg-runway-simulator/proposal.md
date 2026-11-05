# Proposal

## Why

In a Polish B2B sole proprietorship (JDG) household, losing client contract revenue does not simply freeze tax outflows or leave living expenses static: revenue-linked taxes (`#VAT-7` and `#PPE` flat-rate income tax) still hit in Month 1 due to cash-basis settlement lag before dropping to zero in Month 2+, while statutory fixed obligations (`ZUS Społeczny` minus any PFRON `"Cashback taxes"` rebate, `Składka Zdrowotna` across Ryczałt YTD tiers with a January Tier 1 reset, and accounting fees) continue every month unless the JDG uses *Wakacje Składkowe* or is formally suspended. A dedicated Runway & Income Loss Simulator is needed so the household can combine live ExternalProvider liquid capital, statutory Polish JDG zero-revenue tax mechanics, and per-category austerity sliders to know exactly how many months of runway they have under normal and survival scenarios.

## What Changes

- Add a new **Runway Simulator** route at `/dashboard/family-budget/runway` and register it in the `"Family Budget"` sidebar group (`src/navigation/sidebar/sidebar-items.ts`), alongside an optional quick-link runway indicator on the Accounts liquidity strip.
- Introduce a **Statutory Polish JDG Zero-Revenue Obligation Engine** (building on `polish-tax-engine.ts` and seeded from the Offer Comparator's active `"current"` track or user controls) that models:
  - Month-1 lagged tax tail (`#VAT-7` and `#PPE` due in Month 1 for the final active invoicing month, dropping to `0 PLN` in Month 2+).
  - Ongoing monthly ZUS Społeczny (`Duży ZUS`, `Preferencyjny ZUS`, `Ulga na start`, optional voluntary sickness) netted against PFRON `"Cashback taxes"` rebates (`percentage` or `fixed_pln`).
  - Ongoing monthly `Składka Zdrowotna` based on current-year Ryczałt YTD revenue tier (`Tier 1 <=60k`, `Tier 2 60k–300k`, `Tier 3 >300k PLN`) with automatic step-down to Tier 1 on January 1 of the following calendar year (plus Liniowy/Skala minimum health support), and ongoing monthly accounting fees.
  - JDG operational postures: **Active JDG**, **Wakacje Składkowe** (1 month/year ZUS Społeczny exemption), and **Suspended JDG** (*Zawieszenie działalności* — `0 PLN` ZUS and optional voluntary NFZ health insurance if not covered by a spouse's UoP).
  - Optional replacement cost for lost employer/client-funded benefits (e.g., private medical or sport coverage from Offer Comparator tracks).
- Introduce a **Capital Pool & FX Stress Configurator** seeded from live ExternalProvider accounts (`Account`, `BankAccount`, `DebtAccount`, `exceptFromBalance` savings accounts, and `Goal` categories) allowing per-account inclusion toggles, an untouchable safety floor (PLN), and a pessimistic foreign-currency haircut slider (`-15%` to `+15%`).
- Introduce an **Interactive Category-Level Burn & Austerity Matrix** seeded from ExternalProvider `/stat/ping` historical averages (`Last 3M`, `Last 6M`, `Last 12M`, or `Selected Month`, with smart multi-currency and Transport/Taxi rollups and automatic exclusion of tax categories to prevent double-counting) where each category/smart-group row provides a quick on/off checkbox toggle and a `0%–150%` retention slider, alongside saved austerity presets persisted in `localStorage`.
- Render a **Runway KPI Strip, Multi-Scenario Capital Depletion Chart, and Month-by-Month Cashflow Projection Table** comparing Baseline Lifestyle vs. Active Austerity scenarios with exact exhaustion dates and month-by-month obligation breakdowns.

## Capabilities

### New Capabilities
- `jdg-runway-simulator`: Dedicated `/dashboard/family-budget/runway` screen, statutory Polish JDG zero-revenue tax & ZUS projection engine (Month-1 `#VAT-7`/`#PPE` lag tail, ZUS Społeczny, PFRON contra-rebate, Ryczałt YTD health tier with January reset, Wakacje Składkowe, JDG suspension), ExternalProvider capital pool selector with FX buffer, category-level austerity toggles/sliders with `localStorage` scenario persistence, and multi-scenario depletion trajectory chart and table.

### Modified Capabilities
- `budget-overview`: Update the `Family Budget screen navigation` requirement to include the `"Runway Simulator"` entry navigating to `/dashboard/family-budget/runway` in the `"Family Budget"` sidebar group.

## Impact

- **Navigation**: `src/navigation/sidebar/sidebar-items.ts`
- **New Route & Components**: `src/app/(main)/dashboard/family-budget/runway/page.tsx` and `src/app/(main)/dashboard/family-budget/runway/_components/*`
- **Reused Engines & Data Transforms**:
  - `src/app/(main)/dashboard/family-budget/offer-comparator/_components/polish-tax-engine.ts` and `offer-repository.ts`
  - `src/app/(main)/dashboard/family-budget/_components/external-provider-data.ts`, `tax-transforms.ts`, `expense-transforms.ts`, and `use-exclusion-presets.ts`
- **Storage**: Browser `localStorage` (`family-budget:runway-simulator:v1`) for persisting JDG posture overrides, capital pool selections, and category austerity slider presets; zero new upstream API endpoints or secrets required.
