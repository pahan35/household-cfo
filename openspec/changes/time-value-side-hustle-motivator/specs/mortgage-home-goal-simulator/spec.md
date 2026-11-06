# Spec Delta

## ADDED Requirements

### Requirement: Side-Hustle and Reclaimed Time Accelerator integration in Mortgage Goal Tracker
The Mortgage & Home Goal Simulator (`/dashboard/family-budget/mortgage`) SHALL read persisted Time & Opportunity Motivator projections (`family-budget:time-value-motivator:v1`) when available and display an interactive **Side-Hustle & Reclaimed Time Accelerator** callout inside the Home Goal Tracker card. Users SHALL be able to toggle the accelerator on or off to preview how adding their monthly side-hustle / reclaimed screen-time cashflow affects their required savings pace, pace audit status (`On Track` vs. `Pace Shortfall`), and projected months to achieve Milestone 1 (*Umowa deweloperska* / 1st mortgage payment) and Milestone 2 (*Odbiór kluczy* / finishing), with a direct link to `/dashboard/family-budget/lifestyle/time-value`.

#### Scenario: Previewing Milestone 1 acceleration with reclaimed screen-time cashflow enabled
- **WHEN** the user views `/dashboard/family-budget/mortgage` with a configured Time & Opportunity Motivator yielding `+2,500 PLN/month` in household side-hustle cashflow and toggles "Include Side-Hustle Time Accelerator" on
- **THEN** the Home Goal Tracker card displays the accelerated completion timeline (months saved toward Milestone 1 and Milestone 2) alongside the baseline timeline and provides a link to adjust hours in the Time & Opportunity Motivator
