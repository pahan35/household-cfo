# Design: Category Lifecycle Optimizer & Smart Order

## Context

ExternalProvider represents accounts, expense categories, income categories, and debt accounts as unified `ExternalProviderCategory` entities. The upstream server synchronizes category updates via `POST /Exchange/Ping` with `ExchangeKey.Category = 2`. The application already provides `updateCategoriesOrder` in `external-provider-client.ts`, which invalidates client-side and proxy statistics caches upon write.

Currently, `CategoryRenamingDialog` is tightly coupled to heuristic normalization rules and renders non-matching categories as read-only. Furthermore, `BudgetSummaryCard` defaults to active monthly categories, hiding zero-transaction categories and relying on manual drag-and-drop or currency tiering for category sequence ordering.

See `proposal.md` for problem motivation and `specs/category-management/spec.md` for normative requirements.

## Goals / Non-Goals

**Goals:**
- Provide direct, low-friction category renaming from row dropdown menus (`BudgetSummaryCard`, `IncomeSourcesCard`) with live in-scope collision checking.
- Enable arbitrary category editing within `CategoryRenamingDialog` across all categories, retaining topological dependency order on save.
- Implement an activity audit engine classifying categories into Zero-Transaction (all-time unused), Low-Frequency ($\le 3$ lifetime transactions), and Active, with standalone foreign-currency counterpart detection.
- Implement a time-decayed Recency-Frequency scoring engine ($\tau = 30$ days) supporting all-time and rolling lookback scopes.
- Provide a Smart Order preview dialog showing before/after ranks, rank deltas, and stats before persisting to ExternalProvider.
- Strictly maintain architectural currency tiers: Primary active $\rightarrow$ Foreign active $\rightarrow$ Soft-archived (`_`) $\rightarrow$ Soft-deleted (`deleted: true`).

**Non-Goals:**
- Creating new categories or hard-deleting categories from ExternalProvider (soft-archival with `_` prefix and order relegation is the verified domain convention).
- Reassigning transactions between categories.
- Automatic unprompted reordering: all order changes require explicit user preview and confirmation.

## Decisions

### 1. Dedicated `RenameCategoryDialog` with In-Scope Collision Validation
- **Decision**: Create a focused, reusable `RenameCategoryDialog` component triggered from category row dropdowns (`MoreHorizontal` menu).
- **Rationale**: Keeps quick 1-off renames instant without forcing the user into the large batch normalization assistant.
- **Scope Isolation**: Collision checking matches the target name against active categories of the *same* category type (`Expense` vs `Income`). Expense "Gifts" and Income "Gifts" are explicitly permitted.
- **Alternatives Considered**: Inline table cell editing on the budget card — rejected because drag-and-drop handles and click-to-trace event listeners make inline inputs prone to accidental activation and misclicks.

### 2. Time-Decayed Activity Score ($\tau = 30$ days)
- **Decision**: Calculate category activity score using exponential half-life decay:
  $$\text{Score}(c) = \sum_{tx \in c} 2^{-\frac{\text{age}(tx)}{\tau}}$$
  with $\tau = 30$ days.
- **Rationale**: Combines frequency and recency in a single scale-invariant function:
  - Daily/weekly frequent expenses (e.g. *Groceries*) accumulate substantial points ($\approx 15\text{--}40$).
  - Regular monthly expenses (e.g. *Rent*) generate $\approx 1.0\text{--}1.5$ points, naturally sorting below daily expenses but above rare or annual transactions.
  - Zero-transaction categories score `0.0` and settle at the end of the active tier.
- **Alternatives Considered**: Discrete weighted sum ($w_f \cdot \text{Freq} + w_r \cdot \text{Recency}$) — rejected because calibrating weights across users with 10 tx/mo vs 200 tx/mo requires arbitrary scaling constants.

### 3. Preserving Four-Tier Ordering Architecture
- **Decision**: Category ordering during smart optimization operates strictly *within* tiers:
  1. Tier 1: Active Default-Currency Categories (sorted by RF score descending).
  2. Tier 2: Active Foreign-Currency Categories (sorted by RF score descending).
  3. Tier 3: Soft-Archived Categories (prefixed with `_`, preserving relative position).
  4. Tier 4: Soft-Deleted Categories (`deleted: true`, preserved at bottom).
- **Rationale**: Prevents archived categories or foreign currency buckets from displacing primary day-to-day categories on the ExternalProvider grid.

### 4. Standalone Foreign Category Protection in Audit
- **Decision**: When auditing zero or low-frequency categories, foreign categories (e.g. `Hotels EUR`) are checked against canonical base names in the default currency (`Hotels` / `Hotels PLN`). If no counterpart exists, the category is classified as `standalone-foreign` rather than `orphaned`.
- **Rationale**: Users occasionally hold intentional foreign currency categories for trips or specific bank accounts without needing a local currency equivalent; flagging them as deadwood leads to erroneous archiving.

## Risks / Trade-offs

- **[Risk]** Heavy client-side recalculation across thousands of transactions when switching lookback windows.  
  **→ Mitigation**: Transactions are processed in a single linear pass into an ID-indexed map of transaction timestamps. For 5,000 transactions, scoring completes in under 5ms.
- **[Risk]** Target name collision when submitting renames in batch alongside normalization renames.  
  **→ Mitigation**: `evaluateCategoryRenameState` already tracks reactive collisions and broken chains; extending it to arbitrary inputs ensures collisions are blocked before `handleApply` can run.
- **[Risk]** Stale category names in budget metrics or trace sheets.  
  **→ Mitigation**: `updateCategoriesOrder` already invalidates proxy `/stat/ping` cache, client `categories` cache, and client `stat:*` cache, ensuring immediate consistency across all cards.
