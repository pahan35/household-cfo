# Spec Delta

## MODIFIED Requirements

### Requirement: Frequency and recency smart order optimization

The system SHALL provide a Smart Order Optimization engine that computes an activity score for each active category combining frequency and recency via an exponential half-life time-decay function ($\text{Score}(c) = \sum_{tx \in c} 2^{-\text{age}(tx)/\tau}$ with $\tau = 30$ days). The optimizer SHALL support both an all-time lookback scope for baseline sequencing and rolling scopes (90 and 180 days) for periodic calibration. The optimization SHALL preserve architectural tiers (ranking active default-currency categories first, active foreign-currency categories second, soft-archived `_` categories third, and soft-deleted categories last). The system SHALL present an interactive preview dialog displaying current rank, proposed rank, rank delta, transaction count, last active date, and movement reasons before persisting the reordered sequence upstream via `/Exchange/Ping`. The preview dialog SHALL isolate Active Movers (categories whose relative sequence changed against peers, identified via sequence diffing) from passive ripple shifts, default the display to active movers only, provide explicit reasons for tier realignments, and provide an unclipped footer layout with balanced action button spacing.

#### Scenario: Previewing smart order re-ranking with rank deltas
- **WHEN** the user opens the Smart Order Optimizer from the Budget Spent vs Limit toolbar
- **THEN** the optimizer displays a preview table showing each active category's current rank, suggested rank, rank delta pill (e.g. `+5` or `-3`), transaction count, last active date, and time-decayed score for the selected lookback window

#### Scenario: Previewing smart order re-ranking with active mover isolation
- **WHEN** the user opens the Organize Expense Categories dialog
- **THEN** the system compares the original and optimized category sequences via sequence diffing (such as Longest Common Subsequence) to classify items into active movers and passive cascading shifts
- **AND** defaults the preview list to show only the active movers (direct reorganizations) rather than all shifted indices
- **AND** renders a summary badge highlighting the count of active categories to reorganize alongside the passive ripple count

#### Scenario: Toggling between direct movers and cascading ripple shifts
- **WHEN** the user interacts with the filter control in the reorganization preview dialog
- **THEN** the user can switch between viewing only active movers ("Direct moves"), all categories with modified indices ("All shifted"), and all categories in the group ("Show all")

#### Scenario: Surfacing tier migration context in move reasons
- **WHEN** a category changes position primarily due to currency tier realignment (such as a foreign-currency category moved from default-currency rank down to the foreign tier, or a default-currency category promoted up from foreign rank)
- **THEN** the preview row's reason text explicitly indicates the tier realignment (e.g. "Moved to Foreign tier (UAH)" or "Promoted to Primary tier (PLN)") instead of generic zero-transaction activity scores

#### Scenario: Recalibrating order between all-time and rolling lookback scopes
- **WHEN** the user toggles the lookback scope between "All-Time", "180 Days", and "90 Days"
- **THEN** the optimizer recalculates activity scores and preview rankings in real time according to transactions within the selected window

#### Scenario: Enforcing frequency order across regular monthly expenses
- **WHEN** regular monthly expenses (such as monthly rent with 1 tx/month) are ranked alongside high-frequency daily expenses (groceries) and rare irregular expenses (annual trips)
- **THEN** monthly expenses naturally rank below daily/weekly frequent expenses but above rare irregular expenses based on their decayed transaction count

#### Scenario: Preserving currency tiers and archived status during smart order application
- **WHEN** the user confirms and applies smart order optimization
- **THEN** active default-currency categories receive top sequential `#order` positions, active foreign categories follow in their own optimized sequence, soft-archived categories (`_`) remain positioned below active tiers, and soft-deleted categories remain at the bottom, before sending the updated category sequence upstream

#### Scenario: Accessible dialog footer layout with unclipped action controls
- **WHEN** the category reorganization dialog is open
- **THEN** the dialog footer is rendered without negative margin clipping, providing balanced padding on all sides and distinct horizontal spacing between the "Cancel" and "Apply Changes" action buttons
