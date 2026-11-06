# Design

## Context

See `proposal.md` for motivation and scope. The application already contains three rich client-side domain engines that hold pieces of the household's financial and lifestyle picture:
1. **Offer Comparator (`src/app/(main)/dashboard/family-budget/offer-comparator/_components/`)**: Persists compensation tracks in `localStorage` (`family-budget:offer-comparator:v1`), calculates B2B/UoP net hourly rates, marginal side-gig net hourly rates (accounting for shared fixed ZUS and *Składka Zdrowotna* thresholds), and models annual time-off policies (`TimeOffPolicy`: Models A, B, and C).
2. **Mortgage & Home Goal Simulator (`src/app/(main)/dashboard/family-budget/mortgage/_components/`)**: Persists primary-market apartment acquisition parameters in `localStorage` (`family-budget:mortgage-simulator:v1`), computes Milestone 1 (*wkład własny* + closing fees) and Milestone 2 (cash renovation) gaps against ExternalProvider Goals, and knows `pricePerSqmPln`.
3. **Lifestyle & Tags (`src/app/(main)/dashboard/family-budget/lifestyle/`)**: Wraps all `/dashboard/family-budget/lifestyle/*` routes in `LifestyleDataProvider` (`use-lifestyle-data.tsx`), providing pre-fetched ExternalProvider `categories`, `currencies`, `settings`, and up to 5,000 `transactions`, plus `computeLearningMetrics` and `computeWellnessMetrics` (`lifestyle-transforms.ts`) and travel episode detection (`trips-concerts-dashboard.tsx`).

## Goals / Non-Goals

**Goals:**
- Build a pure, deterministic calculation engine (`time-value-engine.ts`) and versioned `localStorage` repository (`time-value-repository.ts`) with zero backend database dependencies.
- Design an empathetic, non-judgmental UI that treats **Partner & Home Care**, **Joyful Fun & Recharge**, **Learning**, and **Proper Relax** as first-class successes rather than framing all non-billable hours as "lost money."
- Seamlessly bridge `LocalStorageOfferRepository`, `MortgageRepository`, and `useLifestyleData` without coupling those modules tightly or breaking when any repository uses default state.
- Reserve a clean schema boundary (`WeeklyCheckInEntry`) so future automated Android Digital Wellbeing imports (`android-wellbeing-browser-sync`) can populate draft weekly entries without schema migration.

**Non-Goals:**
- Native Android APK development or direct Google OAuth / Samsung Cloud API integration in this change (deferred to `android-wellbeing-browser-sync`).
- Modifying upstream ExternalProvider categories or transactions from the Time & Opportunity Motivator (all simulations and weekly check-ins are stored locally in `localStorage` with JSON export/import).

## Decisions

### 1. Placement under `/dashboard/family-budget/lifestyle/time-value`
- **Decision**: Co-locate the new route under `src/app/(main)/dashboard/family-budget/lifestyle/time-value/` so it inherits `LifestyleLayoutClient` and `LifestyleDataProvider` automatically, and add a lightweight cross-link banner inside `src/app/(main)/dashboard/family-budget/mortgage/_components/home-goal-tracker-card.tsx`.
- **Rationale**: `LifestyleDataProvider` already fetches all ExternalProvider transactions, categories (including Goals), and currencies needed to compute historical Trip TCO benchmarks, Learning subscription ROI, and Wellness stream context. Placing the screen inside `Lifestyle & Tags` avoids duplicate network fetches when switching between `Trips & Concerts`, `Health & Sport`, `Learning`, and `Time & Opportunity`.
- **Alternatives considered**: Creating a top-level route `/dashboard/family-budget/time-value`. Rejected because it fits naturally alongside `Trips & Concerts`, `Health & Sport`, and `Learning` in the lifestyle habit suite while still being one click away from the Mortgage simulator via the accelerator callout.

### 2. Empathetic "Joy vs. Drift" Partitioning Instead of Fixed Penalty Thresholds
- **Decision**: Model each partner's weekly gaming and social-network time as `totalHours = joyfulFunHours + driftHours`, where the user controls the split via a "Joy vs. Drift" slider (seeded with a configurable default healthy recharge baseline, e.g., `5h/week` gaming + `3h/week` social, but always adjustable per week based on how the time *actually felt*).
- **Rationale**: A rigid formula (`max(0, hours - threshold) * rate`) punishes weeks where a partner genuinely enjoyed a new game on vacation or relaxed after a heavy care week. By celebrating `joyfulFunHours` explicitly and only routing `driftHours` into the 3-Way Reallocation Portfolio, the UX stays positive and motivating—especially for the spouse.

### 3. Three-Way Drift Reallocation & Dual-Player Value Models
- **Decision**: Allow each partner's `driftHours` to be partitioned by percentage or hours across three buckets:
  1. `sideHustleHours` (multiplied by a realistic focus conversion factor `focusEfficiencyPct`, default `75%`)
  2. `learningHours` (connected to trailing monthly ExternalProvider `Learning` spend from `computeLearningMetrics` to show effective cost per study hour and a configurable career rate lift preview)
  3. `properRelaxHours` (intentional offline/wellness recharge credited toward a household Recharge Balance indicator)
- **Spouse Value Model (`wife`)**:
  - **Partner & Home Care Foundation**: Dedicated `careHoursPerWeek` input (default e.g. `25h/week`) with an appreciation card and optional reference replacement value (e.g., `40 PLN/hr` household/concierge equivalent shown strictly as recognition, never as "convertible drift").
  - **Opportunity Tracks**:
    - *Freelancing / Part-Time Track*: Configurable net hourly rate or per-task bounty (`PLN`).
    - *Family Pet Project & Automation Track*: Combines `monthlyExpenseSavedPln`, `weeklyHouseholdHoursSaved * valuedAtPlnPerHour`, `projectedLaunchMonthlyPln`, and `milestoneBountyPln` (a concrete family reward transferred to her chosen goal upon milestone completion).
- **Primary Partner Value Model (`me`)**:
  - Auto-syncs marginal net hourly rate from the active `current` track in `LocalStorageOfferRepository` (falling back to effective net hourly rate or manual override).
  - **Vacation Relax vs. Day-Off Monetization Dial**: Reads total annual days off (`paidVacationDays` / `combinedPtoDays` / `plannedVacationDays` + `stateHolidays`) from the active offer revision and lets the user split them between **Sacred Unplug Vacation Days** and **Monetized / Side-Project Days Off**, dividing annual net day-off revenue by `12` to show the monthly goal boost.

```text
  +-------------------------------------------------------------------+
  |               TIME-VALUE-ENGINE DATA FLOW                         |
  +-------------------------------------------------------------------+
  |                                                                   |
  |  [Offer Comparator Repo] ---> Primary Marginal Net Rate (PLN/hr)  |
  |                          ---> Annual Days-Off Pool (Vacation Dial)|
  |                                                                   |
  |  [Mortgage Simulator Repo] -> Milestone 1 & 2 Gaps (PLN)          |
  |                            -> Apartment Price per m2 (PLN/m2)     |
  |                                                                   |
  |  [LifestyleDataProvider] ---> Past Trip TCOs (Madeira, etc.)      |
  |                          ---> Monthly Learning & Wellness Spend   |
  |                          ---> ExternalProvider Goal Balances            |
  |                                                                   |
  |  [TimeValueRepo (v1)] ------> Me & Wife Profiles + Weekly Logs    |
  |                       ------> Pet Projects + Personal Goals       |
  +-------------------------------------------------------------------+
```

## Risks / Trade-offs

- **[Risk] Cross-screen `localStorage` staleness if user edits Mortgage or Offer Comparator in another tab** → Mitigation: Read `MortgageRepository` and `LocalStorageOfferRepository` on mount and listen to `window` `"storage"` events so changes reflect immediately.
- **[Risk] Overwhelming number of sliders on a single screen** → Mitigation: Organize the page into clear, progressive sections using `Tabs` and focused cards: (1) Top KPI & Co-op Goal Accelerator Strip, (2) Dual-Player Weekly Reflection & Care Cards (`Me` & `My Wife`), (3) Opportunity & Day-Off Monetization Studio, (4) Goal Translators (1st Mortgage, Trips, Her & Shared Wishlist Goals), and (5) Weekly Check-In History Log.
