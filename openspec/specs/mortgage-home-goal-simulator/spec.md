# mortgage-home-goal-simulator Specification

## Purpose

Provides an interactive mortgage and primary-market home purchase planning simulator with ExternalProvider Goal milestone tracking, construction and finishing overlap cashflow modeling, and post-purchase household budget impact analysis.

## Requirements

### Requirement: Dedicated Mortgage & Home Goal route and navigation

The application SHALL provide a dedicated Mortgage & Home Goal simulator screen at `/dashboard/family-budget/mortgage` accessible from the "Family Budget" sidebar navigation group.

#### Scenario: Navigating to Mortgage & Home Goal simulator
- **WHEN** the user selects "Mortgage & Home Goal" from the "Family Budget" sidebar navigation
- **THEN** the application navigates to `/dashboard/family-budget/mortgage` and loads live ExternalProvider categories, currencies, 40-month budget statistics, and saved mortgage scenario settings

### Requirement: Primary market property and upfront cash target modeling

The system SHALL calculate the total upfront cash required and resulting mortgage loan principal for a primary market apartment purchase, including apartment base price (configurable via area `m²` × `PLN/m²` or total price), optional parking space and storage unit appurtenances, primary market closing fees (`0% PCC` tax, notary fees, court mortgage entry, and bank fees), and a turnkey renovation/finishing budget.

#### Scenario: Calculating upfront cash with primary market 0% PCC and appurtenances
- **WHEN** the user configures a 65 m² apartment at 15,000 PLN/m² (975,000 PLN), a 45,000 PLN parking space, a 15,000 PLN storage unit, and selects a 20% down payment (*wkład własny*)
- **THEN** the calculator sets property acquisition price to 1,035,000 PLN, applies 0% PCC tax, computes the 20% down payment as 207,000 PLN, computes statutory notary and court fees, and outputs the resulting loan principal of 828,000 PLN

#### Scenario: Renovation financing mode toggle (Cash vs. Mortgage-Bundled)
- **WHEN** the user specifies a 200,000 PLN renovation budget and toggles between "Cash-Funded" and "Mortgage-Bundled"
- **THEN** in "Cash-Funded" mode the 200,000 PLN is added directly to upfront cash required while loan principal remains 828,000 PLN, and in "Mortgage-Bundled" mode the renovation is rolled into the bank loan, increasing loan principal to 988,000 PLN (828k + 160k) and requiring 20% down payment on renovation (40,000 PLN) in upfront cash

### Requirement: Two-milestone ExternalProvider Goal linking and progress tracking

The system SHALL allow the user to link one or more ExternalProvider `Goal` (`CategoryType.Goal` / `CategoryType.ClassicGoal`) categories to track savings progress across two key purchase milestones:
1. **Milestone 1 (Signing / *Umowa deweloperska*)**: Down payment (`10%`, `15%`, `20%`) + closing and transaction fees.
2. **Milestone 2 (Key Handover & Finishing / *Odbiór kluczy*)**: Cash-funded renovation, furniture buffer, and moving expenses.

The system SHALL compute current accumulated capital across linked Goals (normalized to PLN), determine the remaining cash gap, and calculate the required monthly savings pace to achieve each milestone by user-selected target dates.

#### Scenario: Progress calculation against linked ExternalProvider Goals
- **WHEN** the user links an active ExternalProvider Goal with 120,000 PLN accumulated balance and the upfront Milestone 1 cash target is 220,000 PLN with a target signing date 10 months away
- **THEN** the system displays 54.5% completion toward Milestone 1, identifies a remaining 100,000 PLN cash gap, and calculates a required monthly savings rate of 10,000 PLN/month

#### Scenario: Syncing milestone targets to ExternalProvider Goal limits
- **WHEN** the user clicks "Sync Target to ExternalProvider Goal"
- **THEN** the system updates the linked Goal category's `limitAmount` (total target) and `periodizedLimitAmount` (monthly pace) upstream via `/api/external-provider/Exchange/Ping` and refreshes the local category cache

### Requirement: Historical savings pace audit against ExternalProvider net cashflow margin

The system SHALL evaluate whether the user's required monthly savings pace is realistic by comparing it to historical monthly Net Cashflow Margins (`Net Disposable Income - Living Expenses`) extracted from ExternalProvider `/stat/ping` across selectable lookback windows (3 months, 6 months, 12 months, or all available history).

#### Scenario: Live pace audit indicates on-track savings pace
- **WHEN** the user's required savings pace is 8,000 PLN/month and the 6-month historical average net cashflow margin is 10,500 PLN/month
- **THEN** the system displays an "On Track" status badge showing a +2,500 PLN/month surplus buffer above target

#### Scenario: Live pace audit indicates savings shortfall and projected delay
- **WHEN** the user's required savings pace is 12,000 PLN/month but the 6-month historical average net cashflow margin is only 7,000 PLN/month
- **THEN** the system displays a "Pace Shortfall" warning badge (-5,000 PLN/month deficit) and calculates the projected delay in months to achieve Milestone 1 at the current actual savings velocity

### Requirement: Construction wait and handover overlap cashflow simulation

The system SHALL model the multi-phase cashflow during primary market purchase, accounting for the construction wait (months between signing and handover with interest-only grace period payments on disbursed tranches) and key handover overlap (paying full mortgage + new admin fee while still paying current rental housing expenses).

#### Scenario: Modeling interest-only developer tranche payments during construction
- **WHEN** the user specifies an 18-month construction period with loan tranches disbursed progressively and an active reference interest rate of 6.85% (WIBOR + margin)
- **THEN** the simulator projects the monthly tranche interest obligations during the grace period (*karencja w spłacie kapitału*) alongside current monthly rent

#### Scenario: Peak overlap stress during finishing window
- **WHEN** the user configures a 3-month finishing window post-handover before moving in
- **THEN** the simulator highlights the peak combined monthly housing expense comprising current rent, full mortgage installment (equal or decreasing), and new apartment community administration fee (*czynsz administracyjny*)

### Requirement: Post-move-in household budget impact and interest rate stress testing

The system SHALL project the steady-state household budget after moving in, replacing current ExternalProvider rent expenses with the new mortgage installment and community administration fee. The system SHALL support both Equal Installments (*Raty równe*) and Decreasing Installments (*Raty malejące*), compute the new Debt-to-Income (DTI %) ratio, and provide an interactive interest rate stress slider (`-2.0%` to `+3.0%`).

#### Scenario: Equal vs Decreasing installment comparison with rent substitution
- **WHEN** the user switches between Equal and Decreasing installment schedules
- **THEN** the simulator recalculates the initial monthly payment, shows the net monthly cashflow delta compared to current rent, and displays total loan interest paid over the mortgage term

#### Scenario: Interest rate stress test slider
- **WHEN** the user adjusts the interest rate stress slider by +2.0% (e.g. from 6.85% to 8.85%)
- **THEN** the simulator recalculates the monthly mortgage installment, updates post-purchase net cash margin, and indicates the impact on household Debt-to-Income ratio

### Requirement: Local persistence of mortgage scenarios

The system SHALL persist all simulator inputs, property assumptions, financing options, linked Goal IDs, and milestone dates in a dedicated Supabase PostgreSQL relational table (`mortgage_scenarios`) for authenticated family users, with graceful client-side fallback/caching in browser `localStorage`. The system SHALL support creating, renaming, duplicating, and deleting multiple named scenarios, with one designated as the primary household scenario.

#### Scenario: Restoring saved mortgage scenario on page reload
- **WHEN** the user modifies mortgage parameters and refreshes `/dashboard/family-budget/mortgage`
- **THEN** the simulator restores all property parameters, selected financing structure, and linked ExternalProvider Goal configuration from Supabase (or local cache when offline)

#### Scenario: Restoring saved mortgage scenario from Supabase
- **WHEN** the user opens or refreshes `/dashboard/family-budget/mortgage` while connected
- **THEN** the simulator loads the household's saved mortgage scenarios from Supabase and activates the designated primary scenario

#### Scenario: Offline or disconnected fallback
- **WHEN** the user opens `/dashboard/family-budget/mortgage` while disconnected or without Supabase access
- **THEN** the simulator falls back to the locally cached scenario in browser `localStorage` and alerts the user that changes are saved locally

#### Scenario: Creating and switching between multiple scenarios
- **WHEN** the user creates a new scenario named "Wola 68m²" and modifies its property parameters
- **THEN** the system persists "Wola 68m²" independently in Supabase without overwriting the previous scenario, and allows instantaneous switching between scenarios via a scenario selector toolbar

### Requirement: Multi-scenario comparison matrix

The system SHALL provide an interactive scenario comparison tool allowing users to select two or more saved mortgage scenarios and view a side-by-side delta matrix highlighting total acquisition costs, upfront cash required, monthly mortgage payments under current and stressed interest rates, overlap carrying costs, and time to down payment completion.

#### Scenario: Comparing two property purchase scenarios
- **WHEN** the user opens the scenario comparison matrix with "Mokotów 75m²" and "Wola 68m²" selected
- **THEN** the system displays side-by-side columns with exact values and visual deltas for total cost, upfront cash needed, monthly installment difference, and timeline to Milestone 1

### Requirement: Side-Hustle and Reclaimed Time Accelerator integration in Mortgage Goal Tracker
The Mortgage & Home Goal Simulator (`/dashboard/family-budget/mortgage`) SHALL read persisted Time & Opportunity Motivator projections (`family-budget:time-value-motivator:v1`) when available and display an interactive **Side-Hustle & Reclaimed Time Accelerator** callout inside the Home Goal Tracker card. Users SHALL be able to toggle the accelerator on or off to preview how adding their monthly side-hustle / reclaimed screen-time cashflow affects their required savings pace, pace audit status (`On Track` vs. `Pace Shortfall`), and projected months to achieve Milestone 1 (*Umowa deweloperska* / 1st mortgage payment) and Milestone 2 (*Odbiór kluczy* / finishing), with a direct link to `/dashboard/family-budget/lifestyle/time-value`.

#### Scenario: Previewing Milestone 1 acceleration with reclaimed screen-time cashflow enabled
- **WHEN** the user views `/dashboard/family-budget/mortgage` with a configured Time & Opportunity Motivator yielding `+2,500 PLN/month` in household side-hustle cashflow and toggles "Include Side-Hustle Time Accelerator" on
- **THEN** the Home Goal Tracker card displays the accelerated completion timeline (months saved toward Milestone 1 and Milestone 2) alongside the baseline timeline and provides a link to adjust hours in the Time & Opportunity Motivator
