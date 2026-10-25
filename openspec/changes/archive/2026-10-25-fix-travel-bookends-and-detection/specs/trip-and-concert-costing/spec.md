# Spec Delta: trip-and-concert-costing

## MODIFIED Requirements

### Requirement: Travel episode detection and reused destination tag splitting

The Trips & Concerts analyzer (`/dashboard/family-budget/lifestyle/trips-concerts`) SHALL detect travel episodes by identifying valid travel destination tags and grouping their transactions into distinct chronological trips. The analyzer SHALL:

1. Exclude reserved non-travel tags (including `subscription`, `sub`, `tax`, `zus`, `vat-7`, `vat`, `ppe`, `salary`, `transfer`, `cash`, `refund`, `wc`) and non-travel categories (`Tax`, `Utility`, `Housing`, `Insurance`, `Salary`, `Debt`, `Software & Tools`) from initiating destination tag discovery.
2. Prioritize explicit `#travel` and `#end-travel` bookend tags over un-bookended heuristic clusters. When a destination tag contains an explicit `#travel` bookend, all prior transactions sharing that destination tag within a 300-day lookback window SHALL be attributed as pre-trip bookings of that bookended episode and SHALL NOT be promoted to independent un-bookended stay anchors.
3. For destination tags lacking explicit bookends, identify an on-site stay anchor via an un-bookended heuristic requiring a dense multi-day cluster of travel/dining/local transit expenses or foreign currency spending over multiple days. The analyzer SHALL NOT treat isolated single-day single transactions or pure pre-booking clusters (such as airline tickets or accommodation down payments booked weeks prior to an explicit `#travel` departure) as standalone on-site travel episodes.
4. Look back up to 300 days prior to the on-site stay anchor start date and attribute any transactions sharing that destination tag in travel or transit categories (`Airplane tickets`, `Railway tickets`, `Hotels`, `Transport`, etc.) as pre-trip bookings of that upcoming episode, regardless of gaps exceeding 60 days between pre-trip payments.
5. Split reused destination tags (e.g. `#Austria`, `#Malediwy`) into separate episodes when separate on-site stay anchors occur across different years or periods separated by more than 60 days.
6. Reliably decode upstream timestamps in .NET ticks, Unix milliseconds, Unix seconds, or ISO 8601 strings into valid calendar dates without throwing runtime invalid time value errors.
7. Resolve transaction native currency hierarchically from `tx.destinationCurrencyId`, `tx.sourceCurrencyId`, destination category `currencyId`, category name suffix, or source account `currencyId`, and convert foreign-currency amounts (such as UAH, USD, EUR) to the default reporting currency using exchange rates.
8. Present episode totals and breakdown rows in analytical rollup mode: converted default reporting currency primary (e.g., `PLN 4,250.00`) and original foreign currency secondary (e.g., `orig. €980.00`) when foreign spending occurred.

#### Scenario: Explicit bookends prevent pre-trip booking cluster from creating duplicate ghost trip

- **GIVEN** 5 transactions tagged with `#madeira` between Oct 10 and Oct 24 (totaling PLN 8,978.83 for flights and hotel bookings), followed by an on-site trip from Nov 09 to Nov 22 tagged with `#madeira`, `#travel`, and `#end-travel`
- **WHEN** the travel episode detector processes the transactions
- **THEN** it generates a single `Madeira (Nov 2023)` episode with Pre-booking = `PLN 8,978.83` and On-site = `PLN 8,016.53`, and creates ZERO duplicate episodes for October 2023

#### Scenario: Foreign-currency transaction amounts converted accurately to default reporting currency

- **WHEN** a transaction is recorded in a foreign currency such as UAH (e.g. 149 UAH) or USD via its category or account without explicit transaction-level currency id
- **THEN** the analyzer resolves the native currency from the category or account and converts the amount to the default reporting currency (e.g. PLN) via exchange rates rather than displaying the native foreign amount 1:1 in default currency

#### Scenario: Displaying episode spending with foreign currency breakdown

- **GIVEN** a travel episode with accommodation paid in EUR (€800 = PLN 3,440) and domestic train tickets in PLN (PLN 200)
- **WHEN** the episode card renders its total and category breakdown
- **THEN** the primary total displays `PLN 3,640.00` and the secondary line reflects the foreign subtotal `orig. €800.00`

#### Scenario: Reused destination tag split into separate trip episodes

- **WHEN** a destination tag such as `#Austria` appears on transactions across multiple years or separated by more than 60 days between on-site stays (or bounded by `#travel` and `#end-travel`)
- **THEN** the analyzer creates distinct chronological trip episodes (e.g. `Austria (Jul 2025)` and `Austria (Feb 2026)`) and attaches pre-trip bookings to their corresponding episode

#### Scenario: Long-gap pre-trip booking lookback without bookends

- **WHEN** a destination tag such as `#malediwy` has a flight down payment in May 2025, a hotel balance payment in August 2025, and an on-site stay from late September to October 2025 without `#travel` bookends
- **THEN** the analyzer identifies the September on-site stay anchor, looks back across the 90+ day gaps, and attributes both the May and August payments as pre-trip bookings of the single `Malediwy (Sep 2025)` episode instead of creating multiple 1-day ghost episodes

#### Scenario: Recurring subscription and tax tags excluded from travel episodes

- **WHEN** transactions are tagged with `#zus`, `#vat-7`, `#ppe`, `#youtube`, `#storytel`, `#evernote`, or `#subscription` appearing 3 or more times across history
- **THEN** the analyzer excludes them from destination tags and creates zero travel episodes for those tags

#### Scenario: Upstream transactions with .NET ticks formatted without errors

- **WHEN** travel transactions provide timestamps as .NET ticks (values exceeding $10^{16}$)
- **THEN** the analyzer decodes them to valid calendar dates and formats episode names (e.g. `Rome (Oct 2024)`) and episode ranges without runtime errors

### Requirement: Interactive travel bookend and episode discovery assistant

The Trips & Concerts dashboard (`/dashboard/family-budget/lifestyle/trips-concerts`) SHALL provide an interactive travel bookending assistant to locate past vacation dates, inspect transactions in candidate timeframes, and designate `#travel` and `#end-travel` bookends along with a destination tag.

The assistant SHALL format candidate transaction amounts using the canonical domain money resolver:
1. Candidate transactions SHALL resolve native amounts and native currencies atomically from source accounts and destination categories without defaulting to PLN.
2. In the candidate list, foreign currency transactions SHALL display their native currency primary (e.g., `€120.00`, `$2,000.00`, `UAH 149.00`) accompanied by converted reporting currency secondary (e.g., `≈ PLN 516.00`).
3. Candidate scoring (`scoreBoundaryCandidate`) SHALL inspect both destination category currency AND source account currency using the canonical currency resolver (incorporating name suffixes and legacy Cyrillic naming), awarding the `+40 Foreign Currency` boundary signal whenever either source or destination represents a foreign currency relative to the dashboard default currency.
4. Date navigation in the assistant SHALL provide both single-month step buttons and an interactive Month/Year popover with a Year selector and 12-month grid allowing 1-click jumps across historical years.

#### Scenario: Navigating to a past vacation date window

- **WHEN** the user selects a target month or date range in the travel bookending assistant
- **THEN** the assistant filters transactions within that window and highlights potential boundary expenses (such as flights, lodging, transit, and foreign currency transactions)

#### Scenario: Navigating to past years via Month-Year picker popover

- **WHEN** the user clicks the Month/Year trigger in the travel bookend assistant and selects year `2021` and month `August`
- **THEN** the popover closes and the assistant displays transactions from August 2021 without requiring 24+ manual chevron clicks

#### Scenario: Viewing a foreign currency candidate transaction in the bookend assistant

- **GIVEN** a flight booking transaction paid in EUR (€450.00) from an account or into a category lacking explicit transaction-level currency fields
- **WHEN** the travel bookending assistant displays the candidate transaction
- **THEN** the transaction amount renders as `€450.00` primary with `≈ PLN 1,935.00` secondary, and receives the foreign currency boundary bonus score

#### Scenario: Viewing foreign transfer or foreign subscription candidate in the bookend assistant

- **GIVEN** a transaction into `"Subscriptions UAH"` of 149.00 UAH or an exchange transaction into `"Kantor USD"` of $2,000.00
- **WHEN** the travel bookending assistant displays the candidate transaction
- **THEN** the transaction amount renders with its native currency primary (`UAH 149.00` or `$2,000.00`) and converted PLN equivalent secondary

#### Scenario: Candidate scoring for foreign payment into generic expense category

- **GIVEN** a candidate transaction paid from a EUR card into a domestic expense category (e.g., Taxi or Dining)
- **WHEN** `scoreBoundaryCandidate` evaluates the transaction
- **THEN** it resolves the source account currency as `"EUR"`, recognizes it as a foreign transaction, and awards the `+40` boundary candidate score

#### Scenario: Designating trip start bookend

- **WHEN** the user clicks "Mark as Trip Start" on a transaction within the assistant with destination tag `#austria` specified
- **THEN** `updateTransactionTags` appends `#travel` and `#austria` to that transaction and the episode detector recalculates to display the trip start

#### Scenario: Designating trip end bookend

- **WHEN** the user clicks "Mark as Trip End" on a transaction within the assistant with destination tag `#austria` specified
- **THEN** `updateTransactionTags` appends `#end-travel` and `#austria` to that transaction and the episode detector recalculates to establish the completed episode window
