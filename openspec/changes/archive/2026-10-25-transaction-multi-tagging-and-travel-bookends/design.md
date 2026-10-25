# Design: Transaction Multi-Tagging and Travel Bookending

## Context

See `proposal.md` for motivation. Currently:
- `RecentTransactionsCard` displays a paginated list of transactions without displaying tags, without inline tag editing, and without date-range controls.
- `updateTransactionTags(tx, newTags)` in `external-provider-client.ts` persists tag array updates to `/api/external-provider/api/transaction/update` and invalidates the client transaction cache (`tx:*`).
- In `lifestyle-transforms.ts`, `detectTravelEpisodes()` splits destination tags and looks for `#travel` and `#end-travel` bookends.
- `useLifestyleData` loads all-time transactions into client memory (up to 5,000 transactions), enabling instant client-side date scrubbing and filtering for lifestyle features.

## Goals / Non-Goals

**Goals:**
- Provide a responsive, keyboard-accessible `MultiTagEditorPopover` component that renders existing tags as removable chips, provides instant autocomplete from all known tags in the database, and persists changes via `updateTransactionTags`.
- Embed tag visualization and the multi-tag editor directly into each row of `RecentTransactionsCard`.
- Add a flexible `TransactionDateRangeFilter` to `RecentTransactionsCard` supporting custom date boundaries (`from`/`to`) and quick presets ("This Month", "Last Month", "This Year", "Last Year", "All Time").
- Build an interactive `TravelBookendAssistant` on the Trips & Concerts screen to quickly jump to any past vacation date/month, highlight boundary candidates (flights, hotels, foreign spending), and set `#travel` and `#end-travel` with 1 click.

**Non-Goals:**
- Modifying ExternalProvider upstream backend schema (we use ExternalProvider's native `tags: string[]` field).
- Auto-tagging transactions without explicit user action or confirmation.

## Decisions

### 1. Reusable Multi-Tag Editor Primitive (`MultiTagEditorPopover`)
- **Choice**: Build a self-contained Popover component containing a badge chip list, an autocomplete input, popular tag suggestions, and a quick-remove action.
- **Rationale**: Keeps tag editing consistent whether used in the main transaction ledger, the category expense trace sheet, or the travel bookend assistant.
- **Alternatives considered**: Inline text editing of tags directly inside the table row (more cramped, harder on mobile, prone to accidental submissions).

### 2. Autocomplete Tag Dictionary
- **Choice**: Extract unique existing tags across loaded transactions and categories client-side to populate autocomplete suggestions.
- **Rationale**: Requires no new backend endpoints and guarantees suggestions match real historical tags actually used in the user's budget.
- **Tag Normalization**: Strips leading `#` during comparisons, but formats tags with `#` for display and persistence.

### 3. Date Navigation Strategy
- **In RecentTransactionsCard**: Pass `{ period: { from, to } }` to `getTransactionPage()` to leverage server-side date querying and pagination.
- **In TravelBookendAssistant**: Filter the existing client-side `transactions` array from `useLifestyleData()` directly by date for zero-latency slider/calendar updates.

### 4. Boundary Candidate Scoring in Travel Assistant
- **Choice**: Score and sort transactions in the target date range by likelihood of being travel boundaries:
  - Transport & lodging categories (airlines, railways, hotels, hostels, taxis).
  - Foreign currency charges (non-default currency).
  - Transactions already having travel-related tags.
- **Rationale**: Allows the user to find the flight out and return flight/transit in seconds even across hundreds of transactions.

## Risks / Trade-offs

- **[Risk]** Updating tags invalidates cached transaction pages in `external-provider-client`, which could cause layout shift if not handled optimistically.
  → **Mitigation**: Update the transaction in local state immediately (optimistic UI), fire the update in the background, and catch/toast errors with state rollback.
- **[Risk]** Fast typing in tag input causing race conditions on rapid tag addition/removal.
  → **Mitigation**: Debounce or disable the popover commit button during in-flight network requests for that specific transaction.
