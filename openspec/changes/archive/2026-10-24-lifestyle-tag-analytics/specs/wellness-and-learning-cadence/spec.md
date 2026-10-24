# Spec Delta

## Purpose

Unifies currency-fragmented wellness, sport, mental health, and learning categories into normalized streams, calculates session frequency, average gap between sessions, and effective cost per session using multi-visit pass multipliers (`10x` Pilates default and tag overrides), and provides an inline audit queue to remediate missing tags or pass multipliers in ExternalProvider.

## ADDED Requirements

### Requirement: Currency-suffix-tolerant wellness and learning category unification
The Health & Sport (`/dashboard/family-budget/lifestyle/health-sport`) and Learning (`/dashboard/family-budget/lifestyle/learning`) screens SHALL unify categories across currency suffixes and historical typos (including `Massage*`, `Medicine*`, `Medical services*`, `Menthal Health*` / `Mental Health*`, `Sport*`, and `Learning*` / `Education*`), converting all transaction amounts into the user's default currency (`PLN`) while preserving native currency badges on individual transactions. Dedicated categories (`Massage`, `Mental Health`) SHALL map automatically to their wellness stream without requiring redundant tags, while shared categories (`Medicine*`, `Sport*`, `Learning*`) SHALL subdivide by `#tag` (`#physio`, `#pilates`, `#exams`, `#vaccine`, `#platform`, `#cert`, `#course`, `#tutor`, `#books`).

#### Scenario: Aggregating multi-currency medical and mental health categories
- **WHEN** transactions exist across `Medicine PLN`, `Medical services UAH`, and `Menthal Health EUR`
- **THEN** the analyzer normalizes amounts to the default currency (`PLN`), groups `Menthal Health EUR` under the `Mental Health` stream automatically, and groups `#physio`-tagged `Medicine` transactions under `Physiotherapy`

### Requirement: Multi-visit pass multiplier and session cadence engine
The Health & Sport analyzer SHALL calculate total estimated sessions, average days between sessions, monthly session cadence, and effective cost per session for each wellness stream (`Massage`, `Physiotherapy`, `Mental Health`, `Pilates`). By default, each transaction in `Pilates` (`Sport*` + `#pilates`) SHALL represent `10` sessions (`10x` pass), whereas `Massage`, `Physiotherapy`, and `Mental Health` transactions SHALL default to `1` session unless overridden by an explicit `#10x`, `#5x`, or `#1x` tag (or detected as a multi-session package outlier in the audit queue).

#### Scenario: Calculating Pilates 10-session pass cadence and effective session cost
- **WHEN** a user records a `#pilates` pass purchase in `Sport PLN` without an explicit multiplier override tag
- **THEN** the cadence engine counts 10 sessions for that purchase, computes the effective per-session cost (`amount / 10`), and estimates days-between-sessions across consecutive pass purchases

### Requirement: Inline wellness tag and pass multiplier audit queue
The Health & Sport screen SHALL include an inline audit queue surfacing untagged transactions in `Medicine*` / `Medical services*` / `Sport*` as well as high-value `Mental Health` or `Physiotherapy` transactions that appear to be multi-visit packages (`>= 4x` median single-visit cost), allowing the user to apply sub-tags (`#physio`, `#pilates`, `#exams`, `#10x`, `#1x`) with one click via `updateTransactionTags`.

#### Scenario: Tagging a 10-visit Mental Health package from the audit queue
- **WHEN** a `Mental Health` transaction is flagged as a likely multi-visit package in the audit queue and the user clicks "Mark #10x Pass"
- **THEN** `updateTransactionTags` appends `10x` to the transaction's tags upstream and the Mental Health session count and cost-per-session metrics recalculate immediately
