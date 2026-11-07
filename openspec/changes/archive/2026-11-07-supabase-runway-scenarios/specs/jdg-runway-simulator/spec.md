# Spec Delta: jdg-runway-simulator

## MODIFIED Requirements

### Requirement: Multi-scenario runway trajectory chart, cashflow table, and persistence
The system SHALL display a summary KPI strip (Usable Capital after Month-1 Tax Tail, Monthly Post-Loss Burn, Projected Runway in Months, and Projected Exhaustion Month/Year), an interactive **Capital Depletion Trajectory Chart** comparing the **Baseline Lifestyle (100% Spend)** curve against the **Configured Austerity** curve (and optional **Suspended JDG** curve), and a **Month-by-Month Cashflow Breakdown Table** showing each future month's starting balance, statutory ZUS/Health/Tax-tail outflows, living expense burn, residual secondary income (if any), and ending balance until depletion. All scenario settings, account selections, and named category austerity slider presets SHALL be persisted in dedicated Supabase PostgreSQL relational tables (`runway_scenarios` and `runway_category_cuts`) for authenticated family users, with graceful client-side fallback/caching in browser `localStorage`.

#### Scenario: Visualizing baseline vs. austerity depletion curves and month-by-month table
- **WHEN** the user configures a runway scenario with `150,000 PLN` usable capital, `15,000 PLN/mo` baseline burn, and `10,000 PLN/mo` austerity burn
- **THEN** the chart plots both capital depletion curves over time showing exhaustion at Month 10 vs. Month 15, and the month-by-month table lists each calendar month's exact JDG obligations, living expenses, and remaining balance

#### Scenario: Persisting runway configuration and austerity slider presets across reloads
- **WHEN** the user adjusts JDG statutory inputs, account checkboxes, and category austerity sliders and reloads the page
- **THEN** the simulator restores the saved configuration and category slider weights from Supabase (or local cache when offline)

#### Scenario: Restoring runway scenarios from Supabase
- **WHEN** the user navigates to `/dashboard/family-budget/runway` while connected
- **THEN** the simulator loads all saved household runway scenarios from Supabase and activates the designated primary scenario

#### Scenario: Creating and switching between multiple named austerity scenarios
- **WHEN** the user creates a new scenario named "Aggressive Winter Freeze" with JDG suspended and deeper austerity cuts
- **THEN** the system persists "Aggressive Winter Freeze" independently in Supabase and allows quick switching between scenarios via a scenario toolbar

#### Scenario: Linking runway baseline to active offer revision
- **WHEN** a runway scenario specifies a linked `baseline_offer_revision_id`
- **THEN** the simulator retrieves the active net compensation from `offer_revisions` in Supabase to calculate pre-loss living cashflow baseline without reading browser-local storage
