# Spec Delta: wellness-and-learning-cadence

## MODIFIED Requirements

### Requirement: Currency-suffix-tolerant wellness and learning category unification

The Health & Sport (`/dashboard/family-budget/lifestyle/health-sport`), Learning (`/dashboard/family-budget/lifestyle/learning`), and Offer Comparator (`/dashboard/family-budget/offer-comparator`) screens SHALL unify categories across currency suffixes and historical typos (including `Massage*`, `Medicine*`, `Medical services*`, `Menthal Health*` / `Mental Health*`, `Sport*`, and `Learning*` / `Education*`), converting all transaction amounts into the user's default currency (`PLN`) using foreign currency precedence (recognizing foreign source account currencies when destination categories lack currency indicators) while preserving native currency amounts and badges on individual transactions and audit rows. Dedicated categories (`Massage`, `Mental Health`) SHALL map automatically to their wellness stream without requiring redundant tags, while shared categories (`Medicine*`, `Sport*`, `Learning*`) SHALL subdivide by `#tag` (`#physio`, `#pilates`, `#exams`, `#consult`, `#dentist`, `#pharmacy`, `#vaccine`, `#insurance`, `#gym`, `#multisport`, `#platform`, `#cert`, `#course`, `#tutor`, `#books`) and optional person/scope tags (`#wife`, `#partner`, `#family`, `#me`).

#### Scenario: Aggregating multi-currency medical and mental health categories
- **WHEN** transactions exist across `Medicine PLN`, `Medical services UAH`, and `Menthal Health EUR`
- **THEN** the analyzer normalizes amounts to the default currency (`PLN`), groups `Menthal Health EUR` under the `Mental Health` stream automatically, and groups `#physio`-tagged `Medicine` transactions under `Physiotherapy`

#### Scenario: Converting wellness transactions paid from foreign source accounts
- **WHEN** an expense transaction is logged against a default-currency category (such as `Sport` or `Physiotherapy`) but paid from a foreign source account (such as `EUR`)
- **THEN** the transaction's native currency is resolved as `EUR`, its native amount is converted to `PLN` at the live exchange rate for stream spend and outlier calculations, and the UI displays the primary amount in `PLN` alongside a secondary native amount/currency badge (`EUR`)

#### Scenario: Subdividing medical and sport spend by corporate benefit coverage and spouse scope
- **WHEN** `Medicine*` and `Sport*` transactions carry tags such as `#exams`, `#consult`, `#dentist`, `#pharmacy`, `#gym`, `#pilates`, and `#wife`
- **THEN** the analyzer distinguishes package-covered medical/sport streams (`#exams`, `#consult`, `#vaccine`, `#gym`, `#multisport`) from out-of-pocket streams (`#dentist`, `#pharmacy`, `#pilates`) and tracks the spouse/family share (`#wife`, `#partner`, `#family`) separately from primary user spend

### Requirement: Inline wellness tag and pass multiplier audit queue

The Health & Sport screen SHALL include an inline audit queue surfacing untagged transactions in `Medicine*` / `Medical services*` / `Sport*` as well as high-value `Mental Health` or `Physiotherapy` transactions that appear to be multi-visit packages (`>= 4x` median single-visit cost), allowing the user to apply sub-tags (`#physio`, `#pilates`, `#gym`, `#multisport`, `#exams`, `#consult`, `#dentist`, `#pharmacy`, `#vaccine`, `#wife`, `#10x`, `#1x`) with one click via `updateTransactionTags`. The queue SHALL display package outlier warnings with highest priority at the top, followed by informational untagged entries, sorted chronologically descending within each priority level. The queue SHALL support orthogonal tag dimensions (activity stream tags, person/scope tags, and pass multipliers), allowing users to assign multiple tags. When primary required tags are applied, the row SHALL trigger a 4-second auto-dismissal countdown with `Pause / Add more` and `Dismiss now` controls before removing the transaction from view.

#### Scenario: Prioritizing package outlier warnings above untagged entries
- **WHEN** the audit queue contains both untagged medical/sport expenses and detected multi-session package outliers
- **THEN** package outlier warnings render at the top of the queue with warning styling, while untagged category expenses render below, each sorted newest first by date

#### Scenario: Tagging a 10-visit Mental Health package from the audit queue
- **WHEN** a `Mental Health` transaction is flagged as a likely multi-visit package in the audit queue and the user clicks "Mark #10x Pass"
- **THEN** `updateTransactionTags` appends `10x` to the transaction's tags upstream, the audit reason renders using the native currency of the transaction, and the Mental Health session count and cost-per-session metrics recalculate immediately

#### Scenario: Tagging medical expenses by coverage type and family member from the audit queue
- **WHEN** an untagged `Medicine` transaction is surfaced in the audit queue
- **THEN** the user can quick-tag it with coverage type (`#consult`, `#exams`, `#dentist`, `#pharmacy`, `#physio`) and optional scope (`#wife`) so both the Health & Sport dashboard and the Offer Comparator benefit offset engine update immediately

#### Scenario: Multi-tagging with scope and activity tags without premature dismissal
- **WHEN** an untagged `Sport` transaction is surfaced in the audit queue and the user clicks `+#wife`
- **THEN** `#wife` is applied upstream, the row displays `#wife` as an active tag chip, and the transaction remains in the queue with sport activity suggestions (`#pilates`, `#gym`, `#multisport`) still accessible until an activity tag is selected or the item is dismissed

#### Scenario: Controlling auto-dismissal countdown after applying required tags
- **WHEN** the user applies the required activity tag to a pending audit transaction
- **THEN** an auto-dismissal countdown begins (4 seconds) showing pause and immediate dismiss controls, and clicking pause keeps the row active in the audit list for further tag adjustments
