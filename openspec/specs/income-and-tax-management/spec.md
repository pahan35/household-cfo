# income-and-tax-management Specification

## Purpose

Provides income source lifecycle management (ordering, soft-archiving, budgeting), multi-currency tax transaction breakdown by tag, missing tax tag auditing with quick-fix remediation, and net disposable income analytics.

## Requirements

### Requirement: Income source listing and metrics

The system SHALL list all non-deleted ExternalProvider income sources (`CategoryType.Income`) with their active period received amount, budgeted target (`limitAmount` in Month Mode, or annualized `limitAmount` in Year Mode), assigned currency read directly from `category.currencyId`, and last transaction summary (date, counterpart, amount). Active income sources SHALL be displayed in ascending `category.order` sequence. The Income & Taxes screen (`/dashboard/family-budget/income`) SHALL also provide an action to open the shared Category Normalization Assistant pre-selected to the `Income` tab so users can normalize and audit income source names alongside their ordering. The Income Sources card header SHALL separate the `Total Inflow` summary from secondary management actions (`Normalize Categories`, `Show archived`) so the card title and description are never compressed into a narrow vertical column.

Multi-currency income presentation and target adherence SHALL adhere to canonical money rules:
1. Each income source SHALL resolve its currency directly from `category.currencyId` on the ExternalProvider category entity (falling back to default reporting currency only when `currencyId` is absent) and display its received amount and target amount in its **native category currency primary** (e.g., `$5,000.00` received of `$5,000.00` target for a USD client contract).
2. Converted amounts in the dashboard reporting currency (`PLN`) SHALL be displayed **secondary** (e.g., `≈ PLN 20,250.00`) using current exchange rates whenever the native received amount is non-zero; when the period received amount is zero (`0.00`), the redundant `≈ PLN 0.00` secondary line SHALL be omitted.
3. Budget adherence percentage (`% of target`) SHALL be computed by comparing native period receipts against the period-scaled native `limitAmount` ($5,000 / $5,000 = 100\% in Month Mode) rather than comparing multi-month sums against a 1-month target or converted PLN receipts against native foreign targets.
4. The system SHALL NEVER format converted PLN figures with foreign currency symbols (e.g., displaying `20,000 PLN` as `$20,000.00`).
5. Last transaction badges SHALL resolve the counterpart currency using the canonical money resolver and format the badge in the counterpart's native currency.

#### Scenario: Viewing active income sources in native currency
- **GIVEN** an income source named `"Client ACME USD"` with `currencyId: "USD"` and target `limitAmount: 5000`
- **WHEN** the user views the Income & Taxes screen in Month Mode after receiving `$5,000.00` (converted to `PLN 20,250.00`) in the selected month
- **THEN** the income source card renders `$5,000.00` primary with `100% of target` against `Target: $5,000.00`, accompanied by `≈ PLN 20,250.00` secondary, without formatting the PLN sum as `$20,250.00`

#### Scenario: Zero-inflow foreign currency income source omits redundant secondary conversion line
- **GIVEN** an income source with `currencyId: "UAH"` or `currencyId: "USD"` that has `0` received in the selected period
- **WHEN** the income source row renders in the Income Sources card
- **THEN** it displays the primary zero amount in the category's `currencyId` and omits the redundant `≈ PLN 0.00` secondary subline

#### Scenario: Viewing active income sources
- **WHEN** the user navigates to the Income & Taxes screen
- **THEN** all non-archived income sources are displayed with their active period earnings, period-scaled budgeted limits, and last transaction summary in ascending order sequence, and the card header title and description remain readable without horizontal squishing

#### Scenario: Missing budget target fallback
- **WHEN** an income source does not specify a `limitAmount` or specifies zero
- **THEN** the income source row displays the actual earnings without an overrun/adherence warning and indicates no target set

#### Scenario: Opening Category Normalization Assistant from Income & Taxes
- **WHEN** the user clicks "Normalize Categories" on the Income & Taxes screen
- **THEN** the Category Normalization Assistant dialog opens with the `Income` tab active by default, displaying only `CategoryType.Income` sources and their proposed normalization changes

### Requirement: Income source reordering and upstream synchronization

The system SHALL allow users to reorder income sources via drag-and-drop. The reordered sequence SHALL update each affected income source's `order` property sequentially and persist the modified categories to ExternalProvider via `/Exchange/Ping` under `ExchangeKey.Category`, invalidating the cached categories.

#### Scenario: Drag-and-drop reordering persists upstream
- **WHEN** the user drags an income source to a new position in the list
- **THEN** the updated order is persisted upstream to `/api/external-provider/Exchange/Ping` and cached categories are refreshed without page reload

### Requirement: Income source soft-archiving and unarchiving

The system SHALL allow users to archive an active income source via an archive action, which SHALL prepend `_` to its name, move it to the end of the income source order list, and persist the update to ExternalProvider via `/Exchange/Ping`. Archived income sources SHALL be hidden by default and viewable on demand via a toggle. Users SHALL be able to unarchive an archived income source, which SHALL strip the leading `_` prefix, move it to immediately precede the first archived income source, and persist the update upstream.

#### Scenario: Archiving an income source
- **WHEN** the user triggers the archive action on an active income source
- **THEN** the income source name is prefixed with `_`, moved after the last active source, persisted to ExternalProvider, and hidden from the default active list

#### Scenario: Unarchiving an income source
- **WHEN** the user unarchives a soft-archived income source from the archived list
- **THEN** the leading `_` prefix is stripped, the source is repositioned to become the last active source, and the updated sequence is persisted upstream

### Requirement: Multi-currency tax categorization by transaction tags

The system SHALL identify dedicated tax expense categories for each active currency using word-boundary matching on tax terminology (ensuring transport categories such as `Taxi PLN` or `Taxi / Delivery` are not classified as taxes) and categorize outgoing tax transactions by their `tags` array. The system SHALL attribute flat-rate personal income tax payments to the primary canonical tag `#PPE` (while recognizing `#pit` and related terms as aliases), attribute social security contributions to `#zus`, healthcare contributions to `#health`, and capital gains to `#belka`. The system SHALL treat VAT-7 (`#VAT-7`) transactions as neutral business pass-through payments (while recognizing `#vat` as an alias) and exclude them from personal tax calculations. The system SHALL compute total personal taxes paid, tag-based percentage distribution, and effective personal tax rate against gross client revenue.

#### Scenario: Dedicated tax categories identified with word boundaries
- **WHEN** categories are evaluated for tax classification
- **THEN** categories matching tax patterns with word boundaries (e.g. `Tax PLN`, `Taxes & ZUS`, `Podatki`) are identified as dedicated tax categories, while ride-hailing and transit categories containing `"taxi"` (e.g. `Taxi PLN`) are excluded from tax identification and preserved as living expenses

#### Scenario: Tax transactions broken down by tag
- **WHEN** tax transactions in the tax expense category contain tags such as `#PPE` (or `#pit`), `#zus`, and `#VAT-7` (or `#vat`)
- **THEN** the system aggregates PPE/PIT and ZUS into personal tax buckets under primary `#PPE` designation, displays VAT-7 separately as neutral pass-through remittances under primary `#VAT-7` designation, and excludes VAT-7 from the total personal taxes sum and effective personal tax rate

#### Scenario: Multiple currencies handled independently
- **WHEN** tax payments occur in multiple currencies (e.g., PLN and USD)
- **THEN** the tax breakdown presents subtotals in their native currency as well as converted totals in the user's default currency

### Requirement: Missing tax tag audit and quick-fix remediation

The system SHALL audit all transactions sent to dedicated tax categories and flag any transaction that lacks a recognized tax tag (`#PPE`, `#zus`, `#health`, `#VAT-7`, `#belka`, or their recognized aliases). The system SHALL present an audit alert listing untagged transactions and provide an inline tag selector presenting primary canonical tags (`#PPE`, `#VAT-7`, `#zus`, `#health`, `#belka`) allowing the user to choose a tag and save it. Saving SHALL invoke `/api/transaction/update` to persist the updated tags array and immediately clear the audit flag.

#### Scenario: Detecting untagged tax transactions
- **WHEN** one or more transactions in a tax category have an empty tags array or lack recognized tax tags (`#PPE`, `#zus`, `#health`, `#VAT-7`, `#belka`)
- **THEN** the system renders a warning badge indicating the number of untagged tax transactions and displays them in the audit list with the updated `#PPE` / `#VAT-7` guidance

#### Scenario: Recognizing transactions tagged with PPE and VAT-7
- **WHEN** a tax transaction is tagged with `#PPE` or `#VAT-7` (or lowercase variants)
- **THEN** the system recognizes the transaction as properly tagged and does not flag it as an untagged audit violation

#### Scenario: Applying a quick-fix tag to an untagged transaction
- **WHEN** the user selects `#PPE` or `#VAT-7` from the inline selector on an untagged transaction and clicks save
- **THEN** the system sends the updated transaction with the chosen tag to `/api/external-provider/api/transaction/update`, removes the transaction from the untagged audit list, and updates the tag breakdown

### Requirement: Net disposable income and expense coverage analytics

The system SHALL calculate Total Gross Income (`True Gross Inflow`), Total Tax Deductions, USD FX & VAT-7 Drag, Effective Tax Rate (Total Personal Taxes / True Gross Income), and Net Disposable Income (`True Gross Income - Total Personal Taxes - USD FX & VAT-7 Drag`). Because client invoice transfers into bank accounts include 23% output VAT when applicable, `True Gross Inflow` SHALL exclude both tax rebates such as PFRON (`"Cashback taxes"`) and pass-through `#VAT-7` remittances (`True Gross Inflow = Raw Non-Rebate Inflows - Pass-Through VAT-7`). Total Personal Tax Deductions SHALL reflect net personal taxes (`#PPE` / `#pit` + `#health` + `#belka` + `Net ZUS` after PFRON rebate) without adding PFRON rebates into the PPE/PIT bucket. USD FX & VAT-7 Drag SHALL be treated as an explicit income reduction factor alongside personal taxes when computing `Net Disposable Income`. The screen SHALL display an expense coverage indicator comparing Net Disposable Income against total controllable living expenses for the matching period.

#### Scenario: Calculating net disposable income and effective rate
- **WHEN** gross client revenue (excluding PFRON and pass-through `#VAT-7`) is 30,000 PLN, ZUS paid is 2,000 PLN, PFRON cashback is 1,200 PLN, and PIT is 3,000 PLN
- **THEN** Total Gross Income is 30,000 PLN, Net ZUS is 800 PLN, Personal Taxes (PPE / PIT) is 3,000 PLN (not inflated by the 1,200 PLN PFRON rebate), Total Personal Taxes are 3,800 PLN, Net Disposable Income is 26,200 PLN, and Effective Tax Rate is 12.7%

#### Scenario: Calculating net disposable income and effective rate with pass-through VAT-7 and PFRON
- **WHEN** raw client bank inflow for the selected month is `33,825 PLN` (comprising `27,500 PLN` net revenue and `6,325 PLN` `#VAT-7`), `#VAT-7` remitted is `6,325 PLN`, ZUS paid is `3,083 PLN`, PFRON cashback is `389 PLN`, and `#PPE` paid is `3,048 PLN`
- **THEN** `True Gross Inflow` (Excl. PFRON & VAT) is `27,500 PLN`, `Net ZUS` is `2,694 PLN`, `Personal Taxes (PPE / PIT)` is `3,048 PLN` (not inflated by the `389 PLN` PFRON rebate), `Total Personal Taxes` are `5,742 PLN`, `Net Disposable Income` is `21,758 PLN`, and `Effective Tax Rate` is `20.9%`

#### Scenario: Expense coverage comparison
- **WHEN** Net Disposable Income for the selected period is 25,000 PLN and total controllable expenses for the same period are 15,000 PLN
- **THEN** the system indicates an expense coverage ratio of 167% and displays the net surplus margin

### Requirement: Filtered transaction ledger for income and tax

The Income & Taxes screen SHALL include an embedded transaction ledger. Clicking an income source SHALL filter the ledger to transactions originating from that income source (`tx.sourceId === selectedSourceId`). Clicking a tax tag, audit filter, or FX friction indicator SHALL filter the ledger to transactions destined for the tax category or FX transfer matching the selected filter. When no filter is active, the ledger SHALL display exclusively transactions involving income sources, tax categories, or currency exchange transfers, and SHALL NOT fall back to arbitrary non-tax living expense transactions.

#### Scenario: Filtering transactions by income source
- **WHEN** the user selects a specific income source
- **THEN** the transaction ledger displays only transactions where that income source is the source counterpart

#### Scenario: Filtering transactions by tax tag
- **WHEN** the user clicks a specific tax tag in the tax breakdown card
- **THEN** the transaction ledger displays only tax transactions carrying that tag

#### Scenario: Default ledger state without matching tax transactions
- **WHEN** no filter is selected and the period contains zero income or tax transactions
- **THEN** the transaction ledger renders an empty state explaining that no income or tax transactions exist for the period, rather than listing arbitrary living expense transactions

### Requirement: PFRON ZUS contra-rebate netting

The system SHALL detect PFRON subsidy inflows from the `"Cashback taxes"` income source and apply them as a direct contra-rebate against ZUS social security expenses (`Net ZUS = Gross ZUS Outflow - Cashback Taxes Inflow`). The system SHALL NOT count `"Cashback taxes"` toward Gross Client Income, and SHALL badge the source as a tax rebate in the income sources listing.

#### Scenario: Netting PFRON cashback against ZUS
- **WHEN** a 600 PLN inflow arrives from `"Cashback taxes"` and 1,000 PLN is paid to ZUS
- **THEN** the ZUS metric displays Net ZUS as -400 PLN with a breakdown showing 1,000 PLN paid and 600 PLN refunded, while Gross Income excludes the 600 PLN

#### Scenario: Badging Cashback taxes in income sources list
- **WHEN** the income sources list renders the `"Cashback taxes"` category
- **THEN** it displays a "Tax Rebate / ZUS Offset" badge and clarifies that amounts are credited against ZUS contributions

### Requirement: USD FX and VAT-7 currency friction tracking

The system SHALL compute realized foreign exchange friction for USD income streams as an explicit income reduction factor, comprising:
1. **VAT-7 Currency Rate Drag**: When a client pays 23% Polish VAT in USD (`#VAT-7` obligation fixed in PLN at the NBP mid-market rate $R_{\text{NBP}}$) and the user sells USD at an actual realized rate $R_{\text{sell}}$, the system SHALL calculate the FX loss between the NBP rate and actual USD/PLN sell rate:
   $$\text{VAT-7 FX Loss (PLN)} = \text{VAT}_{\text{PLN}} \times \left(1 - \frac{R_{\text{sell}}}{R_{\text{NBP}}}\right), \quad \text{VAT-7 FX Loss (USD)} = \frac{\text{VAT}_{\text{PLN}}}{R_{\text{sell}}} - \frac{\text{VAT}_{\text{PLN}}}{R_{\text{NBP}}}$$
2. **USD Exchange Spread Loss**: The difference between the NBP mid-market rate ($R_{\text{NBP}}$) and actual realized USD/PLN sell rate ($R_{\text{sell}}$) on net USD earnings converted into PLN via account-to-account transfers.

The system SHALL automatically derive the realized USD/PLN sell rate ($R_{\text{sell}}$) from USD-to-PLN transfer transactions in the period and the NBP rate ($R_{\text{NBP}}$) from the period's macroeconomic NBP rate data when an explicit `vatInvoicedNbpRate` override is not provided. The resulting loss SHALL be displayed in **both**:
- The **`VAT-7 Remittance` callout card**, showing the PLN VAT remitted, original USD VAT equivalent at NBP rate, actual USD expended at the sell rate, and the net VAT-7 FX Loss badge (`-PLN X / -$Y`).
- The **Income Reduction Waterfall, KPI Strip, and Deduction Distribution bar/cards**, as a dedicated `FX & VAT-7 Drag` bucket reducing `Net Disposable Cash`.

#### Scenario: Tracking Kantor trade spread on USD exchange
- **WHEN** 3,000 USD is exchanged from a USD business account to a PLN account at an effective sell rate of 3.98 PLN/USD while the NBP mid-market rate is 4.02 PLN/USD
- **THEN** the system calculates an FX trade spread loss of 120 PLN and attributes it to `FX & VAT-7 Drag`

#### Scenario: Tracking VAT-7 currency rate drag
- **WHEN** a USD client pays 23% Polish VAT in USD corresponding to `9,430 PLN` at the NBP rate of `4.10 PLN/USD` (`$2,300.00 USD`), and the user sells USD at `3.95 PLN/USD` (`$2,387.34 USD` expended) to remit `#VAT-7` in PLN
- **THEN** the system calculates a VAT-7 currency drag of `87.34 USD` (`345.00 PLN`), displays `-PLN 345.00 (-$87.34)` inside the `VAT-7 Remittance` callout card alongside the NBP vs. sell rate details, and includes the `345.00 PLN` loss in the `FX & VAT-7 Drag` deduction bucket reducing `Net Disposable Cash`

### Requirement: Historical income and tax timeline analytics

The system SHALL render an interactive chronological timeline and YoY chart on `/dashboard/family-budget/income` displaying historical monthly gross income alongside the corresponding deductions broken down by component (`#PPE`, `#health`, net `#zus` after PFRON contra-rebates, and `FX & VAT-7 Drag`). The chart SHALL display an Effective Tax Rate trendline calculated as net personal taxes divided by selected taxable gross income across available months. The timeline SHALL support:
1. A timing alignment toggle between **Cash Basis** (taxes displayed in the month they were paid) and **Accrual Basis** (tax payments shifted back by one month $M-1$ to align with the invoice earnings that generated the tax liability), which SHALL also synchronize with the period metrics when inspecting a month or year.
2. Interactive bar selection in **Month Mode**, where clicking a month on the chart selects that month as the active dashboard period.
3. A **Timeline vs. YoY Comparison** view toggle in **Year Mode**, allowing the user to compare Jan–Dec monthly trajectories of the selected year against the prior year (`Y` vs `Y - 1`).

#### Scenario: Rendering chronological income and tax flow
- **WHEN** the user navigates to the Income & Taxes screen
- **THEN** the system displays the Income & Taxation Timeline chart showing monthly stacked bars for deductions overlaid on or paired with gross income, alongside the monthly effective tax rate curve

#### Scenario: Netting PFRON contra-rebate within the historical timeline
- **WHEN** a month contains both ZUS social security payments (e.g. 1,600 PLN) and PFRON cashback receipts (e.g. 1,200 PLN)
- **THEN** the timeline displays the net ZUS contribution (400 PLN) in the tax stack and reflects the reduced net tax burden in the effective tax rate calculation for that month

#### Scenario: Switching between cash basis and accrual basis
- **WHEN** the user switches the timeline view mode to Accrual Basis
- **THEN** tax payments paid in month $M$ (such as February PPE, ZUS, and VAT-7) are shifted to month $M-1$ (January) to align directly against January invoice revenue across both the timeline chart and the active period metrics

#### Scenario: Switching to YoY comparison chart in Year Mode
- **WHEN** the user selects Year Mode (`2026`) and toggles the chart to `YoY Comparison`
- **THEN** the chart plots Jan–Dec monthly values for `2026` alongside `2025` with YoY percentage delta tooltips

### Requirement: Multi-select income source filtering and taxation inspection

The system SHALL provide interactive source selection controls within the timeline chart enabling users to toggle individual income sources on or off. When specific income sources are selected, the chart SHALL dynamically recalculate the gross income total and display the effective taxation and net yield corresponding to the selected revenue stream.

#### Scenario: Isolating a specific B2B income source
- **WHEN** the user selects a specific B2B client income source and deselects others
- **THEN** the timeline chart updates its gross bars to represent only that income source's monthly revenue and shows how that income was taxed over time

#### Scenario: Excluding non-taxable or rebate sources from gross client revenue
- **WHEN** the timeline aggregates gross client revenue
- **THEN** PFRON "Cashback taxes" is excluded from the gross earnings stack and preserved strictly as a contra-tax credit

### Requirement: Income and tax period mode selection and YoY statistics

The Income & Taxes screen (`/dashboard/family-budget/income`) SHALL provide a unified period control bar allowing the user to switch between **Month Mode** (targeting a specific calendar month `yyyy-MM` with `< Month >` navigation steppers) and **Year Mode** (targeting a calendar year `yyyy` with `< Year >` navigation steppers). The selected period SHALL govern the KPI strip, Income Sources (`+x` received and `% of target`), Tax Flow Waterfall, and embedded transaction ledger, and SHALL compute Year-over-Year (YoY) comparison deltas against the corresponding prior-year period (`M - 12` in Month Mode or `Y - 1` in Year Mode).

#### Scenario: Filtering income and tax metrics to a specific month in Month Mode
- **GIVEN** the user is on the Income & Taxes screen in Month Mode with `"Oct 2026"` selected
- **WHEN** the screen computes income source inflows, tax payments, and waterfall metrics
- **THEN** only transactions belonging to `"Oct 2026"` (respecting the active Cash vs. Accrual basis for taxes) are aggregated into the KPI strip, Income Sources `+x` amounts, and Tax Flow card, and YoY delta badges compare `"Oct 2026"` against `"Oct 2025"`

#### Scenario: Clicking a month bar on the Timeline chart selects that month
- **GIVEN** the user views the Income & Taxation Timeline chart
- **WHEN** the user clicks the bar for `"Aug 2026"`
- **THEN** the period selector switches to Month Mode for `"Aug 2026"` and updates the KPI strip, Income Sources card, Tax Breakdown card, and transaction ledger to `"Aug 2026"`

#### Scenario: Switching to Year Mode to inspect annual totals and YoY comparison
- **GIVEN** the user switches the period selector from Month Mode to Year Mode for `"2026"`
- **WHEN** the screen renders annual metrics and the chart view
- **THEN** the KPI strip, Income Sources list, and Tax Breakdown card aggregate all `"2026"` transactions, compare each income source's annual receipts against its annualized target (`limitAmount` scaled by active months in the year), display YoY deltas against `"2025"`, and allow toggling the chart between Chronological Timeline and Jan–Dec YoY overlay comparison
