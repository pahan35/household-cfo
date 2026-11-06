# Tasks

## 1. Domain Models, Calculation Engine & Persistence Repository

- [ ] 1.1 Create `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-types.ts` defining dual-player profiles (`me` on Pixel 9 Pro + PC/Console and `wife` on Galaxy S24 + Mobile/Games), Partner & Home Care hours, Joy vs. Drift screen-time splits, 3-way drift reallocation (`sideHustle`, `learning`, `properRelax`), Vacation vs. Day-Off Monetization settings, Spouse Freelancing & Family Pet Project models, Personal/Shared Goals, and `WeeklyCheckInEntry` records; verify with `npx tsc --noEmit`.
- [ ] 1.2 Create `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-engine.ts` implementing pure calculations for Joy vs. Drift partitioning, 3-way reallocation, Offer Comparator marginal net hourly rate & day-off monetization yield, Spouse freelancing and pet-project compound value (money saved, hours saved, future revenue, milestone bounty), Learning subscription ROI (`computeLearningMetrics`), and Goal Accelerators (Mortgage Milestone 1 & 2 months saved + `m²` unlocked, Trip TCO multiples, and Personal Goals); verify with unit tests or `npm run verify`.
- [ ] 1.3 Create `src/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository.ts` persisting state under `family-budget:time-value-motivator:v1` with default starter profiles, weekly logs, pet projects, personal goals, and validated JSON export/import helpers; verify with `npm run verify`.

## 2. Navigation & Route Setup

- [ ] 2.1 Add `"Time & Opportunity"` (`/dashboard/family-budget/lifestyle/time-value`) to `LIFESTYLE_NAV_ITEMS` in `src/app/(main)/dashboard/family-budget/lifestyle/lifestyle-layout-client.tsx` and to the `Lifestyle & Tags` sub-menu in `src/navigation/sidebar/sidebar-items.ts`; verify navigation links render and typecheck via `npm run verify`.
- [ ] 2.2 Create the Server Component route `src/app/(main)/dashboard/family-budget/lifestyle/time-value/page.tsx` and main client container `time-value-dashboard.tsx` reading `useLifestyleData()`, `MortgageRepository`, `LocalStorageOfferRepository`, and `TimeValueRepository`; verify the route compiles and renders without errors via `npm run verify`.

## 3. Dual-Player UI Components & Goal Translators

- [ ] 3.1 Build `dual-player-reflection-cards.tsx` for `Me` and `My Wife`, featuring the celebratory **Partner & Home Care** foundation section on the spouse's card, **Joy vs. Drift** screen-time sliders (Mobile/Video Games & Social Networks), zero-blame celebration badges for fun recharge time, and 3-way drift reallocation sliders (`Side Hustle / Pet Project`, `Learning`, `Proper Relax`); verify component types and lint rules with `npm run verify`.
- [ ] 3.2 Build `opportunity-monetization-studio.tsx` with the primary partner's **Offer Comparator Rate & Vacation vs. Day-Off Monetization Dial** (protecting sacred unplug vacation days while calculating net PLN from monetized days off) and the spouse's **Freelancing + Family Pet Projects & Automation** studio (monthly savings, hours saved, future income, and Family Milestone Bounty); verify with `npm run verify`.
- [ ] 3.3 Build `goal-accelerators-grid.tsx` and `learning-relax-roi-card.tsx` translating reclaimed time into (a) **1st Mortgage Down Payment (*Wkład własny*) & Finishing** months saved + apartment `m²` per year, (b) **Dream Trip Benchmarks** from historical ExternalProvider trips, (c) **Personal / Her-Preference Goals** manager, and (d) **Learning Subscription ROI & Restorative Relax Balance**; verify with `npm run verify`.
- [ ] 3.4 Build `weekly-checkin-log-card.tsx` allowing the couple to log weekly screen time, care hours, Joy vs. Drift reflections, and actual side-hustle/learning/relax hours, plus JSON Export/Import controls in the dashboard header; verify with `npm run verify`.

## 4. Mortgage Goal Tracker Integration & End-to-End Verification

- [ ] 4.1 Update `src/app/(main)/dashboard/family-budget/mortgage/_components/home-goal-tracker-card.tsx` to read `TimeValueRepository` (`family-budget:time-value-motivator:v1`) and render an interactive **Side-Hustle & Reclaimed Time Accelerator** callout toggle showing accelerated Milestone 1 & Milestone 2 timelines with a link to `/dashboard/family-budget/lifestyle/time-value`; verify with `npm run verify`.
- [ ] 4.2 Run `npm run verify` (`biome check && tsc --noEmit`) across the workspace to confirm zero lint, formatting, or TypeScript strict mode errors.
