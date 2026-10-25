# job-offer-comparator Specification

## Purpose

Normalizes disparate job offers, current-company compensation restructures, and historical employment tracks into comparable Net Monthly Cashflow (PLN) and Effective Net Hourly Rate metrics against the user's ExternalProvider family budget, while providing a reverse recruiter gross-rate solver, Polish B2B/UoP/PFRON multi-year tax projections, two-layer ExternalProvider benefit valuation, and fractional side-gig capacity simulation.

## Requirements

### Requirement: Dedicated Offer Comparator route and navigation

The system SHALL provide a dedicated Job Offer & Compensation Comparator screen at `/dashboard/family-budget/offer-comparator` accessible from the "Family Budget" sidebar group directly below "Income & Taxes".

#### Scenario: Navigating to the Offer Comparator screen
- **WHEN** the user selects "Offer Comparator" from the "Family Budget" sidebar navigation
- **THEN** the application navigates to `/dashboard/family-budget/offer-comparator` and loads live ExternalProvider currencies, categories, historical budget statistics, and saved offer tracks

### Requirement: Offer tracks, restructure revisions, and historical CPI archive

The system SHALL organize offers into employer/role tracks (`current`, `negotiating`, `past_accepted`, `past_declined`) where each track contains one or more chronological revisions (`OfferRevision`). Users SHALL be able to clone an existing revision to model a compensation or benefit restructure (such as moving from PLN to USD with a rate raise while downgrading Health Insurance from Family to Individual tier) or an annual rate progression at a past company. For revisions with a historical `effectiveDate`, the system SHALL compute both the nominal net compensation at the historical period's exchange rate and the CPI-adjusted real purchasing-power equivalent in today's PLN.

#### Scenario: Modeling a current-company currency and benefit restructure
- **WHEN** the user creates a new revision on their current company track changing compensation from PLN to USD with a higher base rate and changing Health Insurance from `family` to `individual` tier
- **THEN** the system computes a Restructure Impact Diff breaking down the base rate gain, FX spread/buffer impact, and the negative benefit downgrade delta (spouse health insurance replacement cost or uncovered spouse medical spend) to display the net real monthly raise in PLN

#### Scenario: Viewing a past company offer with a 1-year rate raise and CPI adjustment
- **WHEN** the user records a past company track with Revision 1 (`effectiveDate: "2023-03"`, hourly rate `R1`) and Revision 2 (`effectiveDate: "2024-03"`, hourly rate `R2`)
- **THEN** the system displays the Year 1 to Year 2 progression alongside the CPI-inflated purchasing power equivalent in current PLN

### Requirement: Compensation, currency, and time-off normalization engine

The system SHALL normalize Hourly, Monthly, and Annual base rates across `PLN`, `USD`, and `EUR` into an Annualized Net Value based on configurable Polish calendar working days (default `252` days/year including `13` weekday state holidays) and divide by `12` for monthly budget comparison. The system SHALL pull live FX rates from ExternalProvider (`ExchangeKey.Currency`) with a fallback to historical NBP rates, and provide a per-currency manual override and pessimistic buffer slider (e.g., `-15%` to `+15%`). The system SHALL support three Time-Off Models:
- **Model A (Separate Pools)**: Separate paid vacation days, paid sick days (with configurable pay coverage %), and paid state holidays.
- **Model B (Combined PTO Pool)**: A combined paid time-off pool where weekday state holidays are either included separately or deducted from the pool.
- **Model C (Unpaid / Pure Hourly B2B)**: Zero paid days off (or an explicit PTO rate markup formula) where planned vacation days, state holidays taken, and estimated sick days reduce annual billable hours.

#### Scenario: Normalizing an unpaid hourly USD B2B offer with pessimistic FX buffer
- **WHEN** an offer specifies `50 USD/hr` under Model C (Unpaid Time Off) with `24` planned vacation days, `13` state holidays, `5` sick days (`210` billable days = `1,680` billable hours/year), a live USD/PLN rate of `4.00`, and a `5%` pessimistic FX buffer (`3.80 PLN/USD`)
- **THEN** the system calculates annual gross revenue as `1,680 * 50 * 3.80 = 319,200 PLN` (`26,600 PLN/month` gross average) and derives both the Effective Net Monthly Cashflow and Effective Net Hourly Rate

#### Scenario: Comparing Combined PTO Pool with state holidays deducted
- **WHEN** an offer uses Model B with `30` combined paid PTO days and `stateHolidaysDeductedFromPool: true`
- **THEN** the system deducts the `13` weekday state holidays from the `30`-day pool, leaving `17` net discretionary paid vacation days for comparison against Model A offers

### Requirement: Pluggable Polish tax, multi-year ZUS, and PFRON B2B-vs-UoP engine

The system SHALL provide a per-offer tax calculator supporting:
1. **B2B Ryczałt** (configurable rate, default `12%`, presets `8.5%`, `12%`, `15%`, `17%`): ZUS Społeczny, 3-tier annual revenue Składka Zdrowotna (`<60k PLN`, `60k–300k PLN`, `>300k PLN`), `50%` health contribution deduction from revenue, and monthly accounting costs.
2. **B2B Podatek Liniowy (`19%` PIT + `4.9%` Zdrowotna)** and **B2B Skala (`12%`/`32%` PIT + `9%` Zdrowotna)** with deductible business costs.
3. **UoP (Umowa o Pracę)**: Employee ZUS (`13.71%` with the annual `30x` pension/disability cap), `9%` health insurance, progressive PIT (`12%` up to `120k PLN`, `32%` above, `30k PLN` tax-free allowance), optional joint spouse filing, PPK employee/employer contributions, and **50% KUP (Author's Copyright / AKUP)** with a configurable creative work percentage capped at `120k PLN` deduction/year.
4. **Custom Fallback Formula**: `<Percentage of Gross Income> + <Static Monthly Payment>`.
5. **1–3 Year Horizon & ZUS Stage Progression**: Projects Year 1, Year 2, and Year 3 net cashflow across ZUS stages (`Ulga na start` -> `Preferencyjny ZUS` -> `Duży ZUS`) and an annual static ZUS inflation slider.
6. **PFRON & Disability B2B-vs-UoP Modeling**: Models PFRON ZUS Społeczny cash rebates (`"Cashback taxes"`, e.g., `30%`, `60%`, `100%`, or custom PLN) on B2B (scaling with ZUS base inflation in Years 1–3) versus transitioning to UoP (where direct PFRON cash rebate drops to `0 PLN`, while optionally applying statutory UoP disability entitlements of `35h/week` full-pay norm and `+10` extra paid vacation days).

#### Scenario: Projecting 3-year B2B Ryczałt cashflow with ZUS stage transitions and PFRON rebate
- **WHEN** a B2B Ryczałt offer starts on `Preferencyjny ZUS` in Year 1, transitions to `Duży ZUS` in Year 2 with `8%` annual ZUS base inflation, and has a `60%` PFRON ZUS Społeczny rebate enabled
- **THEN** the engine outputs Year 1, Year 2, and Year 3 monthly net cashflow projections showing both the gross ZUS jump and the corresponding PFRON rebate offset

#### Scenario: Evaluating B2B to UoP transition impact on PFRON and working hours
- **WHEN** the user compares a B2B offer with PFRON ZUS cashback against a UoP offer with 50% AKUP and disability statutory rights enabled
- **THEN** the UoP projection sets direct PFRON ZUS cash rebate to `0 PLN`, models the `35h/week` (`7h/day`) statutory norm and `+10` paid vacation days, and highlights both the monthly cashflow delta and the effective hourly rate gain

### Requirement: Two-layer benefit and equity valuation mapped to ExternalProvider categories

The system SHALL allow each offer revision to include modular benefits (`Learning`, `Health & Medical`, `Sport & Wellness`, `Lunch Cards`, `Occasion/Birthday Gifts`, `Equipment/Remote Stipends`, `Paid Sabbatical`, `Bonuses`) and equity grants (`RSU` vs. `ESOP`), valued across two distinct layers:
1. **Budget Offset (Layer 1 — Hard Cashflow Equivalent)**: Links to a unified ExternalProvider expense category or tag stream and specifies the monthly PLN amount that directly replaces existing household out-of-pocket spending, reducing required monthly cash expenses. Includes spouse/family tier downgrade adjustments (where losing `family` tier adds either a monthly spouse co-pay deduction or uncovered `#wife` medical spend).
2. **Subjective Utility Weight (Layer 2 — Total Perceived Comp)**: Applies a `0%–100%` subjective weight to non-cash perks that do not replace existing spending (e.g., MultiSport valued at `30%` because it does not replace `#pilates`).
3. **Company Equity**: Liquid public RSUs (with vesting schedule, cliff, volatility discount %, and `19%` Belka capital gains tax) SHALL be optionally amortized into post-cliff net cashflow, whereas illiquid Stock Options / ESOP SHALL be tracked as paper upside and excluded from monthly budget cashflow.

#### Scenario: Valuing MultiSport vs. Family Health Insurance against ExternalProvider spend
- **WHEN** an offer includes MultiSport (`150 PLN` nominal, `0 PLN` budget offset because `#pilates` is not covered, `30%` utility weight) and Individual Health Insurance where the user must pay `300 PLN/mo` co-pay to keep spouse coverage (`#wife` medical stream)
- **THEN** Hard Monthly Cashflow Equivalent deducts the `300 PLN/mo` spouse co-pay and adds `0 PLN` for MultiSport, while Total Perceived Comp includes `45 PLN/mo` (`30%` of `150 PLN`) for MultiSport

#### Scenario: Separating liquid RSUs from illiquid ESOP options
- **WHEN** Offer A includes `20,000 USD` in public RSUs (`4-year` vest, `1-year` cliff, `15%` volatility discount, `19%` Belka tax) and Offer B includes `40,000 USD` in startup ESOP options
- **THEN** Offer A displays post-cliff net monthly RSU value after discount and Belka tax while Offer B excludes ESOP value from monthly budget cashflow and badges it as illiquid paper upside

### Requirement: Part-time / side-gig fractional capacity simulator

The system SHALL allow each primary offer to specify `realExpectedWeeklyHours` (e.g., `35h` vs. `45h`) and an `allowsSideGig` exclusivity flag, and provide an optional **Side-Gig Add-on Slot** (`hoursPerWeek`, rate, currency, tax regime). When enabled, the simulator SHALL compute combined net monthly income and total weekly hour load while accounting for:
1. **Shared Fixed ZUS**: If the primary offer already covers mandatory ZUS Społeczny (via B2B or UoP above minimum wage), the side B2B gig pays only Składka Zdrowotna and income tax without duplicating ZUS Społeczny.
2. **Tax & Health Threshold Spillover**: Combines annual revenue/income to detect if the side gig pushes B2B Ryczałt over the `60k PLN` or `300k PLN` Składka Zdrowotna thresholds or pushes Skala/UoP over the `120k PLN` `32%` tax bracket, attributing the marginal tax jump accurately.

#### Scenario: Adding a 10h/week B2B side gig that crosses the 300k PLN Ryczałt health threshold
- **WHEN** a primary B2B Ryczałt offer generates `280,000 PLN` annual revenue and the user enables a `10h/week` side gig generating `60,000 PLN` annual revenue (`340,000 PLN` combined)
- **THEN** the simulator does not charge duplicate ZUS Społeczny on the side gig, deducts the higher `>300k PLN` tier Składka Zdrowotna step-up from the side gig's marginal net yield, and displays the true marginal net hourly rate of those extra `10` hours/week

### Requirement: Reverse Recruiter Quick-Quote Calculator

The system SHALL provide a Reverse Recruiter Calculator that takes a **Target Net Monthly Cashflow** (seeded from ExternalProvider baseline living expenses plus a configurable monthly savings goal) and solves backwards across piecewise tax/ZUS thresholds to output the **Required Gross Rate** simultaneously across B2B Hourly (Model C unpaid time off vs. Model A/B paid time off), B2B Monthly (Ryczałt vs. Liniowy), and UoP Monthly (0% AKUP vs. configured 50% AKUP) in `PLN`, `USD`, and `EUR` (incorporating the active FX pessimistic buffer).

#### Scenario: Generating recruiter quotes for a target monthly net budget
- **WHEN** the user sets Target Net Monthly Cashflow to `18,000 PLN` (`12,000 PLN` ExternalProvider expenses + `6,000 PLN` savings goal) with `42` total non-working days/year
- **THEN** the calculator solves and displays the exact required gross hourly, monthly, and annual quotes across B2B and UoP in `PLN`, `USD`, and `EUR` so the user can quote a recruiter immediately on a call

### Requirement: LocalStorage offer repository with JSON export and import

The system SHALL persist all offer tracks, revisions, benefit templates, and global comparator settings in browser `localStorage` through a modular repository interface (`OfferRepository`), and provide one-click **Export JSON** and **Import JSON** actions with schema validation to back up or restore comparator state.

#### Scenario: Exporting and importing offer comparator state
- **WHEN** the user clicks "Export JSON" and later imports the downloaded JSON file via "Import JSON"
- **THEN** all offer tracks, historical revisions, tax profiles, benefit mappings, and global settings are validated and restored without data loss
