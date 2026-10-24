# Proposal

## Why

ExternalProvider categories capture *what* was purchased (e.g., transport, hotels, restaurants, medicine, sport, learning) and in *which currency* (`Medicine PLN`, `Medical services UAH`, `Menthal Health EUR`, `Sport PLN`), but the web dashboard currently lacks both ExternalProvider mobile's **Category-to-Tag drill-down statistics** and cross-category lifestyle intelligence:
1. **Generic Category -> Tag Drill-Down & Tag Trends**: ExternalProvider mobile lets users switch between `Expenses` and `Income` donut charts, toggle between **Category** and **Tag** views, drill into any category (`>`) to see its internal tag breakdown, and plot filtered spending/income curves over custom periods—capabilities not yet available in our web app.
2. **True Event Cost (Travels & Concerts)**: Pre-trip bookings (flights, hotels, concert tickets) happen months before an event, while on-site transactions during the trip or concert weekend are frequently left untagged. Additionally, destination tags like `#Austria` are reused across multiple trips over time, and concerts may occur either locally or inside a larger trip.
3. **Cadence, Pass Efficiency & Multi-Currency Wellness (Health, Mind, Sport & Learning)**: Wellness and personal growth expenses are split across currency-suffixed categories and mix single-visit payments (`Massage`, `Physiotherapy`, regular `Mental Health` visits) with multi-visit passes (`Pilates` 10-session passes, 10-visit `Mental Health` packages) and platform subscriptions (`Learning`), obscuring real session frequency, average gap between visits, and effective cost per session.

## What Changes

- **Expandable Navigation & Shared Lifestyle & Tags Hub**:
  - Add an expandable **Lifestyle & Tags** item under the **Family Budget** sidebar group with routes for **Tag & Category Explorer** (`/dashboard/family-budget/lifestyle`), **Trips & Concerts** (`/dashboard/family-budget/lifestyle/trips-concerts`), **Health & Sport** (`/dashboard/family-budget/lifestyle/health-sport`), and **Learning** (`/dashboard/family-budget/lifestyle/learning`), paired with an in-page navigation switcher across the views.
- **Generic Tag & Category Statistics Explorer (Donut Drill-Down & Filtered Timeline)**:
  - Provide a mobile-style **Expenses | Income** donut chart and ranked percentage breakdown list on `/dashboard/family-budget/lifestyle` supporting **By Category (with `>` chevron drill-down into tags inside a category)**, **Unified Semantic Category** (grouping currency-suffixed categories), and **Global By Tag** modes.
  - Pair the composition donut with a **Filtered Historical Trend Chart** (inspired by ExternalProvider Web's chart window) that plots monthly or custom-period spending/income curves (`Expenses`, `Income`, or `Expenses & Income`) for any selected category, tag, or lifestyle group with period range and zoom controls.
- **Trips & Concerts Cost Analyzer & Untagged Window Linker**:
  - Detect travel episodes using `#travel` and `#end-travel` bookend tags (as well as time-gap clustering >60 days) so reused destination tags (e.g. `#Austria`, `#Malediwy`) split cleanly into distinct trip episodes without requiring double-tagging on every transaction.
  - Attach pre-trip bookings (tagged with the destination/event tag prior to `#travel`) to their corresponding episode.
  - Discover untagged candidate transactions falling within a trip's `[startDate, endDate]` window, highlighting foreign-currency and travel-relevant category charges, and provide an explicit confirmation UI to link selected transactions by persisting the trip/concert tag upstream via `updateTransactionTags`.
  - Support Concert event costing (`#concert` + artist/event tag) across separate same-day ticket purchases, distinguishing **Local (In-Town)** concerts from **Out-of-Town Concert Trips**, and handling **Concert inside a Travel** with Direct Concert Cost vs. Shared Trip Overhead views without double-counting, while reusing the Donut & Timeline breakdown primitives per event.
- **Health, Mind & Sport Cadence & Efficiency Analyzer**:
  - Unify currency-fragmented and renamed categories using currency-suffix-tolerant semantic matchers (`Massage`, `Medicine*` / `Medical services*`, `Menthal Health*` / `Mental Health*`, `Sport*`) normalized to the user's default currency (`PLN`).
  - Provide sub-stream tag classification (`#physio`, `#pilates`, `#exams`, `#vaccine`, etc.) while treating dedicated categories like `Massage` and `Mental Health` automatically without redundant tags.
  - Calculate session frequency, average days between sessions, monthly cadence, and effective cost per session using smart session multipliers (default `10x` for Pilates, `1x` for Massage/Physio/Mental Health, with `#10x` / `#5x` / `#1x` tag overrides and multi-visit package detection).
  - Include an inline **Wellness Tag & Pass Audit** queue to classify untagged `Medicine` transactions or mark multi-session packages directly in ExternalProvider.
- **Extensible Learning & Tag Facet Foundation**:
  - Provide a foundational **Learning** facet view matching `Learning*` / `Education*` categories and sub-tags (`#platform`, `#cert`, `#course`, `#tutor`, `#books`), surfacing recurring subscription run-rates and tag breakdowns, architected to support future material satisfaction and continuation tracking.

## Capabilities

### New Capabilities
- `tag-and-category-statistics`: Generic `Expenses | Income` donut chart and ranked percentage breakdown with `Category -> Tag` chevron drill-down, global `By Tag` mode, currency-unified category grouping, and filtered historical trend chart for any selected category or tag.
- `trip-and-concert-costing`: Episode-based travel and concert TCO analysis (`#travel`/`#end-travel` bookends, reused destination tag splitting, pre-booking attribution, concert local vs. trip multiplier, concert-in-trip overlap, and explicit confirmation UI for linking untagged transactions within an event's date window).
- `wellness-and-learning-cadence`: Multi-currency category unification (`Massage`, `Medicine`, `Medical services`, `Mental Health`, `Sport`, `Learning`), currency-suffix-tolerant semantic matching, multi-visit pass multiplier engine (`10x` Pilates default, per-tx tag overrides), session frequency/cadence analytics, and inline tag/pass remediation.

### Modified Capabilities
<!-- No existing spec requirements are modified; this introduces new lifestyle analytics screens and transforms alongside existing Family Budget routes. -->

## Impact

- **Navigation**: Updates `src/navigation/sidebar/sidebar-items.ts` to add the expandable `Lifestyle & Tags` group under `Family Budget`.
- **Routes & Components**: Adds `src/app/(main)/dashboard/family-budget/lifestyle/` routes (`layout.tsx`, `page.tsx`, `trips-concerts/page.tsx`, `health-sport/page.tsx`, `learning/page.tsx`) and co-located transform/UI components in `src/app/(main)/dashboard/family-budget/_components/`.
- **Data & Upstream API**: Reuses existing `/api/external-provider/Exchange/Ping`, `/api/transaction/get`, `/api/external-provider/stat/ping`, and `/api/transaction/update` (`updateTransactionTags`) endpoints—no new upstream proxy allowlist paths or dependencies required.
