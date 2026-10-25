# wellness-and-learning-cadence Specification

## MODIFIED Requirements

### Requirement: Currency-suffix-tolerant wellness and learning category unification
The Health & Sport (`/dashboard/family-budget/lifestyle/health-sport`), Learning (`/dashboard/family-budget/lifestyle/learning`), and Offer Comparator (`/dashboard/family-budget/offer-comparator`) screens SHALL unify categories across currency suffixes and historical typos (including `Massage*`, `Medicine*`, `Medical services*`, `Menthal Health*` / `Mental Health*`, `Sport*`, and `Learning*` / `Education*`), converting all transaction amounts into the user's default currency (`PLN`) while preserving native currency badges on individual transactions. Dedicated categories (`Massage`, `Mental Health`) SHALL map automatically to their wellness stream without requiring redundant tags, while shared categories (`Medicine*`, `Sport*`, `Learning*`) SHALL subdivide by `#tag` (`#physio`, `#pilates`, `#exams`, `#consult`, `#dentist`, `#pharmacy`, `#vaccine`, `#insurance`, `#gym`, `#multisport`, `#platform`, `#cert`, `#course`, `#tutor`, `#books`) and optional person/scope tags (`#wife`, `#partner`, `#family`, `#me`).

#### Scenario: Aggregating multi-currency medical and mental health categories
- **WHEN** transactions exist across `Medicine PLN`, `Medical services UAH`, and `Menthal Health EUR`
- **THEN** the analyzer normalizes amounts to the default currency (`PLN`), groups `Menthal Health EUR` under the `Mental Health` stream automatically, and groups `#physio`-tagged `Medicine` transactions under `Physiotherapy`

#### Scenario: Subdividing medical and sport spend by corporate benefit coverage and spouse scope
- **WHEN** `Medicine*` and `Sport*` transactions carry tags such as `#exams`, `#consult`, `#dentist`, `#pharmacy`, `#gym`, `#pilates`, and `#wife`
- **THEN** the analyzer distinguishes package-covered medical/sport streams (`#exams`, `#consult`, `#vaccine`, `#gym`, `#multisport`) from out-of-pocket streams (`#dentist`, `#pharmacy`, `#pilates`) and tracks the spouse/family share (`#wife`, `#partner`, `#family`) separately from primary user spend

### Requirement: Inline wellness tag and pass multiplier audit queue
The Health & Sport screen SHALL include an inline audit queue surfacing untagged transactions in `Medicine*` / `Medical services*` / `Sport*` as well as high-value `Mental Health` or `Physiotherapy` transactions that appear to be multi-visit packages (`>= 4x` median single-visit cost), allowing the user to apply sub-tags (`#physio`, `#pilates`, `#gym`, `#multisport`, `#exams`, `#consult`, `#dentist`, `#pharmacy`, `#vaccine`, `#wife`, `#10x`, `#1x`) with one click via `updateTransactionTags`.

#### Scenario: Tagging a 10-visit Mental Health package from the audit queue
- **WHEN** a `Mental Health` transaction is flagged as a likely multi-visit package in the audit queue and the user clicks "Mark #10x Pass"
- **THEN** `updateTransactionTags` appends `10x` to the transaction's tags upstream and the Mental Health session count and cost-per-session metrics recalculate immediately

#### Scenario: Tagging medical expenses by coverage type and family member from the audit queue
- **WHEN** an untagged `Medicine` transaction is surfaced in the audit queue
- **THEN** the user can quick-tag it with coverage type (`#consult`, `#exams`, `#dentist`, `#pharmacy`, `#physio`) and optional scope (`#wife`) so both the Health & Sport dashboard and the Offer Comparator benefit offset engine update immediately

## ADDED Requirements

### Requirement: Benefit coverage ceiling and spouse offset intelligence
The system SHALL compute trailing monthly average spend ceilings from unified ExternalProvider categories and tag streams (`Medicine`, `Sport`, `Mental Health`, `Massage`, `Learning`) to guide benefit valuation in the Offer Comparator:
1. **Package-Covered vs. Out-of-Pocket Split**: Separates `Medicine` spend into corporate-health-package-eligible (`#exams`, `#consult`, `#vaccine`, `#insurance`, or untagged fallback proportion) versus non-covered out-of-pocket (`#dentist`, `#pharmacy`, `#physio`), and separates `Sport` spend into MultiSport-eligible (`#gym`, `#multisport`) versus non-covered (`#pilates`).
2. **Primary vs. Spouse/Family Split**: Calculates the monthly spend attributable to `#wife` / `#partner` / `#family` tags within `Medicine` and `Sport` so downgrading a benefit from `family` to `individual` tier automatically surfaces the historical spouse spend at risk alongside an optional manual spouse package co-pay.

#### Scenario: Computing suggested budget offset for Individual vs. Family Health Insurance
- **WHEN** the user configures a Health Insurance benefit linked to `Medicine` and toggles between `family` and `individual` tiers
- **THEN** the benefit matcher displays the trailing monthly ExternalProvider `Medicine` spend broken down by covered primary spend, covered `#wife` spend, and out-of-pocket (`#dentist`/`#pharmacy`) spend, and adjusts the suggested monthly budget offset accordingly
