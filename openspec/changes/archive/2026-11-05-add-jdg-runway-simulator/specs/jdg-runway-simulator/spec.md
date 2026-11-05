# jdg-runway-simulator Specification

## Purpose

Models household financial runway in the event of Polish B2B (JDG) income loss by combining ExternalProvider multi-currency capital pools, statutory Polish zero-revenue ZUS and health insurance rules, Month-1 cash-basis tax settlement lag (`#VAT-7` and `#PPE`), and interactive category-level austerity sliders.

## ADDED Requirements

### Requirement: Dedicated Runway Simulator route and navigation

The system SHALL provide a dedicated Runway & Income Loss Simulator screen at `/dashboard/family-budget/runway` accessible from the "Family Budget" sidebar navigation group.

#### Scenario: Navigating to the Runway Simulator screen
- **WHEN** the user selects "Runway Simulator" from the "Family Budget" sidebar navigation
- **THEN** the application navigates to `/dashboard/family-budget/runway` and loads live ExternalProvider accounts, currencies, categories, 40-month budget statistics, recent tax transactions, and saved runway scenario settings

### Requirement: Statutory Polish JDG zero-revenue obligation modeling

The system SHALL provide a statutory Polish JDG zero-revenue obligation calculator seeded from the user's active Offer Comparator `"current"` track (when available) or configurable directly on the screen. When JDG client revenue drops to zero, the calculator SHALL set ongoing monthly `#PPE` (Ryczałt / PIT) and `#VAT-7` obligations to `0 PLN` for Month 2 onward while continuing to charge monthly statutory obligations according to the selected JDG operational posture:
1. **Active JDG Posture**: Charges monthly `ZUS Społeczny` (`Duży ZUS`, `Preferencyjny ZUS`, or `Ulga na start`, with configurable voluntary sickness insurance), subtracts any configured PFRON `"Cashback taxes"` rebate (`percentage` of pension and disability ZUS or `fixed_pln`) to derive `Net ZUS Społeczny`, charges monthly `Składka Zdrowotna` based on the selected regime and current-year Ryczałt YTD revenue tier (`Tier 1 <=60k PLN`, `Tier 2 60k–300k PLN`, or `Tier 3 >300k PLN`), and charges the configured monthly accounting fee.
2. **Calendar-Year Ryczałt Health Tier Reset**: When a runway projection spans across December into January of a new calendar year under an Active JDG posture with zero revenue, the calculator SHALL automatically step down the monthly Ryczałt `Składka Zdrowotna` obligation from `Tier 2` or `Tier 3` to `Tier 1` (`<=60k PLN` annual revenue tier) starting in January of the new calendar year.
3. **Wakacje Składkowe Posture**: Allows the user to enable the statutory 1-month-per-calendar-year ZUS contribution holiday (*Wakacje Składkowe*), which sets `ZUS Społeczny` (and the corresponding PFRON rebate for that month) to `0 PLN` in the designated exemption month while keeping `Składka Zdrowotna` active.
4. **Suspended JDG Posture (*Zawieszenie działalności*)**: Sets monthly `ZUS Społeczny`, PFRON rebate, and mandatory JDG `Składka Zdrowotna` to `0 PLN`, while allowing the user to toggle between `0 PLN` spouse UoP NFZ family coverage or a configurable voluntary NFZ health insurance contribution, plus a reduced or zero idle accounting fee.

#### Scenario: Active JDG with zero revenue pays ZUS and Health but zero PPE and VAT-7 in Month 2+
- **WHEN** the user models an Active JDG on `Duży ZUS` with `60%` PFRON rebate and Ryczałt `Tier 3` health insurance after losing B2B income
- **THEN** Month 2 onward charges `0 PLN` for `#PPE` and `0 PLN` for `#VAT-7`, charges statutory `Duży ZUS` minus the `60%` PFRON rebate as `Net ZUS`, charges `Tier 3` `Składka Zdrowotna`, and charges the monthly accounting fee

#### Scenario: Ryczałt Health Insurance steps down from Tier 3 to Tier 1 in January
- **WHEN** the runway simulation starts in October with current-year YTD revenue in `Tier 3` (`>300k PLN`) and zero JDG revenue projected forward
- **THEN** the simulator charges `Tier 3` health insurance (`1,258.39 PLN/mo` indexed) for October, November, and December, and automatically steps down to `Tier 1` health insurance (`419.46 PLN/mo` indexed) starting in January

#### Scenario: Suspending JDG eliminates ZUS and mandatory health contributions
- **WHEN** the user switches the JDG operational posture to "Suspended JDG (Zawieszenie)" with spouse UoP NFZ coverage enabled
- **THEN** monthly `ZUS Społeczny` and `Składka Zdrowotna` drop to `0 PLN` and projected runway months increase accordingly

### Requirement: Month-1 lagged tax tail deduction

The system SHALL model the cash-basis settlement lag where `#VAT-7` (due by the 25th) and `#PPE` / PIT (due by the 20th) for the final active invoicing month (`M0`) are paid out of pocket in Month 1 (`M1`) of income loss. The system SHALL auto-detect the user's most recent active month's `#VAT-7` and `#PPE` outflow totals from ExternalProvider tax transactions as the default Month-1 tax tail and allow the user to toggle or override these amounts.

#### Scenario: Deducting Month-1 VAT-7 and PPE settlement tail from starting capital
- **WHEN** the user enables the "Month-1 Tax Settlement Tail" option with `8,000 PLN` in final `#VAT-7` and `4,500 PLN` in final `#PPE`
- **THEN** Month 1 of the cashflow projection includes the `12,500 PLN` tax tail outflow in addition to Month 1 ZUS, health, and living expenses, and Month 2 onward excludes `#VAT-7` and `#PPE`

### Requirement: Capital pool selection and foreign-currency stress buffer

The system SHALL populate the available emergency capital pool from live ExternalProvider categories (`Account`, `BankAccount`, `DebtAccount`, `exceptFromBalance` off-balance savings accounts, and `Goal` / `ClassicGoal` categories), displaying each item's native balance and converted PLN value. Users SHALL be able to toggle individual accounts or goals in or out of the runway pool, configure an untouchable safety floor in PLN, and apply a foreign-currency stress haircut slider (`-15%` to `+15%`) to non-PLN balances.

#### Scenario: Customizing usable runway capital with account toggles, FX buffer, and safety floor
- **WHEN** the user includes a `100,000 PLN` bank account and a `10,000 USD` savings account (at `4.00 PLN/USD`), applies a `-5%` pessimistic FX buffer (`3.80 PLN/USD`), and sets a `15,000 PLN` untouchable safety floor
- **THEN** the simulator calculates Total Usable Runway Capital as `100,000 + 38,000 - 15,000 = 123,000 PLN`

### Requirement: Category-level burn baseline and austerity sliders

The system SHALL compute baseline monthly living expenses per category from ExternalProvider `/stat/ping` historical data across a selectable lookback window (`Last 3 Months Avg`, `Last 6 Months Avg`, `Last 12 Months Avg`, or `Latest Active Month`), applying canonical multi-currency and Transport/Taxi smart-group rollups and automatically excluding dedicated tax categories (`#PPE`, `#VAT-7`, `#zus`, `#health`) so taxes are never double-counted against the statutory JDG engine. Each category or smart group row SHALL provide:
1. An **Include / Zero-Out Checkbox Toggle** (`0%` vs. active).
2. A **Retention Percentage Slider** (`0%` to `150%`, with quick percentage presets) that scales the category's monthly burn in the active austerity scenario.
3. Visual distinction between **Fixed / Non-Controllable Categories** (seeded from the active exclusion preset's `expenseExclusions`, such as Rent or Tuition) and **Controllable Living Categories**.

#### Scenario: Adjusting category sliders updates monthly burn and runway extension
- **WHEN** the user unchecks `Trips & Concerts` (`1,800 PLN/mo` baseline -> `0%`) and slides `Restaurants & Cafes` (`1,200 PLN/mo` baseline) to `25%` (`300 PLN/mo`)
- **THEN** the category matrix reduces monthly living burn by `2,700 PLN/mo` and immediately displays the resulting runway gain in months (`+X.X months`) compared to the 100% baseline lifestyle

#### Scenario: Tax categories are excluded from category living burn matrix
- **WHEN** the category burn matrix loads historical spending from `/stat/ping`
- **THEN** dedicated tax categories (`Tax PLN`, `Taxes & ZUS`, `Podatki`, etc.) are omitted from the living expense rows because JDG taxes and social contributions are modeled explicitly by the statutory JDG obligation engine

### Requirement: Multi-scenario runway trajectory chart, cashflow table, and persistence

The system SHALL display a summary KPI strip (Usable Capital after Month-1 Tax Tail, Monthly Post-Loss Burn, Projected Runway in Months, and Projected Exhaustion Month/Year), an interactive **Capital Depletion Trajectory Chart** comparing the **Baseline Lifestyle (100% Spend)** curve against the **Configured Austerity** curve (and optional **Suspended JDG** curve), and a **Month-by-Month Cashflow Breakdown Table** showing each future month's starting balance, statutory ZUS/Health/Tax-tail outflows, living expense burn, residual secondary income (if any), and ending balance until depletion. All scenario settings, account selections, and named category austerity slider presets SHALL be persisted in browser `localStorage`.

#### Scenario: Visualizing baseline vs. austerity depletion curves and month-by-month table
- **WHEN** the user configures a runway scenario with `150,000 PLN` usable capital, `15,000 PLN/mo` baseline burn, and `10,000 PLN/mo` austerity burn
- **THEN** the chart plots both capital depletion curves over time showing exhaustion at Month 10 vs. Month 15, and the month-by-month table lists each calendar month's exact JDG obligations, living expenses, and remaining balance

#### Scenario: Persisting runway configuration and austerity slider presets across reloads
- **WHEN** the user adjusts JDG statutory inputs, account checkboxes, and category austerity sliders and reloads the page
- **THEN** the simulator restores the saved configuration and category slider weights from `localStorage`
