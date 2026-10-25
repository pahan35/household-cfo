# income-and-tax-management Specification

## MODIFIED Requirements

### Requirement: Income source listing and metrics

The system SHALL list all non-deleted ExternalProvider income sources (`CategoryType.Income`) with their current period received amount, budgeted target (`limitAmount`), assigned currency, and last transaction summary (date, counterpart, amount). Active income sources SHALL be displayed in ascending `category.order` sequence. The Income & Taxes screen (`/dashboard/family-budget/income`) SHALL also provide an action to open the shared Category Normalization Assistant pre-selected to the `Income` tab so users can normalize and audit income source names alongside their ordering.

Multi-currency income presentation and target adherence SHALL adhere to canonical money rules:
1. Each income source SHALL display its received amount and target amount in its **native category currency primary** (e.g., `\$5,000.00` received of `\$5,000.00` target for a USD client contract).
2. Converted amounts in the dashboard reporting currency (`PLN`) SHALL be displayed **secondary** (e.g., `≈ PLN 20,250.00`) using current exchange rates.
3. Budget adherence percentage (`% of target`) SHALL be computed by comparing native receipts against native `limitAmount` ($5,000 / $5,000 = 100\%$) rather than comparing converted PLN receipts against native USD targets.
4. The system SHALL NEVER format converted PLN figures with foreign currency symbols (e.g., displaying `20,000 PLN` as `\$20,000.00`).
5. Last transaction badges SHALL resolve the counterpart currency using the canonical money resolver and format the badge in the counterpart's native currency.

#### Scenario: Viewing active income sources in native currency
- **GIVEN** an income source named `"Client ACME USD"` with `currencyId: "USD"` and target `limitAmount: 5000`
- **WHEN** the user views the Income & Taxes screen after receiving `\$5,000.00` (converted to `PLN 20,250.00`)
- **THEN** the income source card renders `\$5,000.00 / \$5,000.00 (100%)` primary, accompanied by `≈ PLN 20,250.00` secondary, without formatting the PLN sum as `\$20,250.00`

#### Scenario: Viewing active income sources
- **WHEN** the user navigates to the Income & Taxes screen
- **THEN** all non-archived income sources are displayed with their period earnings, budgeted limits, and last transaction summary in ascending order sequence

#### Scenario: Missing budget target fallback
- **WHEN** an income source does not specify a `limitAmount` or specifies zero
- **THEN** the income source row displays the actual earnings without an overrun/adherence warning and indicates no target set

#### Scenario: Opening Category Normalization Assistant from Income & Taxes
- **WHEN** the user clicks "Normalize Categories" on the Income & Taxes screen
- **THEN** the Category Normalization Assistant dialog opens with the `Income` tab active by default, displaying only `CategoryType.Income` sources and their proposed normalization changes
