# time-value-motivator Specification

## Purpose

Provides an empathetic, zero-blame, dual-player ("Me & My Wife") Time & Opportunity Motivator that celebrates partner/home care and joyful recharge time first, reflects on weekly gaming and social-network screen time ("Joy vs. Drift"), reallocates self-identified drift hours and optional monetized days off across side hustles, family pet projects, skill learning, and proper restorative relax, and translates the resulting extra value into accelerated progress toward the 1st mortgage down payment (*wkład własny*), real trip benchmarks, and personal goals.

## ADDED Requirements

### Requirement: Dedicated Time & Opportunity Motivator route and navigation
The application SHALL provide a dedicated Time & Opportunity Motivator screen at `/dashboard/family-budget/lifestyle/time-value` accessible both from the `Lifestyle & Tags` in-page navigation bar and the `Family Budget -> Lifestyle & Tags` sidebar navigation group.

#### Scenario: Navigating to Time & Opportunity Motivator
- **WHEN** the user selects "Time & Opportunity" from the `Lifestyle & Tags` navigation bar or sidebar group
- **THEN** the application navigates to `/dashboard/family-budget/lifestyle/time-value`, loads shared ExternalProvider lifestyle data (`categories`, `currencies`, `transactions`), reads saved `MortgageRepository` and `LocalStorageOfferRepository` configurations, and restores saved `time-value-motivator` state from `localStorage`

### Requirement: Dual-player household setup with Partner & Home Care recognition
The system SHALL model two distinct household profiles (`me` using Pixel 9 Pro + PC/Console and `wife` using Galaxy S24 + Mobile/Games) in a cooperative, zero-blame layout. The spouse's profile SHALL prominently track and celebrate **Partner & Home Care** hours (caring for partner, household management, cooking, errands, and emotional support) as a foundational contribution before evaluating screen time or optional extra-income activities, and SHALL optionally display an appreciative commercial replacement value equivalent in PLN without treating care hours as idle or convertible drift time.

#### Scenario: Celebrating Partner & Home Care hours on Wife's profile
- **WHEN** the user or spouse configures or logs `25` weekly hours of Partner & Home Care on the Wife's profile
- **THEN** the profile displays a celebratory foundation callout acknowledging those `25h/week` as household-enabling care and excludes them from convertible drift calculations

### Requirement: Empathetic Joy vs. Drift screen-time reflection and Weekly Check-In Log
For each partner, the system SHALL provide both **Interactive What-If Sliders (Option A)** and a chronological **Weekly Check-In Log (Option B)** covering Mobile/Video Gaming hours and Social Network hours (Instagram, Threads, etc.). Rather than labeling all screen time above a rigid threshold as wasted, the system SHALL prompt each partner to partition their screen time into:
1. **Joyful & Recharging Fun Time**: Hours that genuinely felt fun, relaxing, and worthwhile, which the system SHALL explicitly cheer and protect (`0 PLN` opportunity cost).
2. **Self-Identified Drift Time**: Mindless scrolling or unfulfilling gaming hours that the partner would happily trade for extra income, pet-project progress, learning, or proper restorative relax.

#### Scenario: Logging a week where all gaming and social time felt joyful
- **WHEN** the spouse logs `8h` of gaming and `4h` of social media for the week and marks all `12h` as "Joyful & Recharging Fun" (`0h` drift)
- **THEN** the system displays an encouraging recharge celebration badge, records `0h` of tradeable drift for her that week, and displays zero guilt or negative loss messaging

#### Scenario: Reflecting on mixed Joy vs. Drift screen time
- **WHEN** a partner logs `16h` of combined gaming and social networks and reflects that `7h` felt genuinely fun while `9h` felt like mindless drift
- **THEN** the system protects and cheers the `7h` of fun recharge and routes only the `9h` of self-identified drift into the 3-Way Drift Reallocation Portfolio

### Requirement: Three-way drift reallocation portfolio (Extra Income, Learning, Proper Relax)
The system SHALL allow each partner to allocate their weekly self-identified drift hours across three positive life investments:
1. **Extra Income (Side Hustle & Family Pet Projects)**: Hours converted into billable side gigs, part-time freelancing, or family pet projects (applying a configurable realistic focus conversion factor, e.g., `60%–100%`).
2. **Learning & Skill Investment**: Hours invested in courses, books, language tutors, certifications, or technical skills. The system SHALL connect these hours to the household's real ExternalProvider `Learning` spend (`#platform`, `#course`, `#tutor`, `#books`, `#cert`) to display active learning ROI (effective PLN of subscription/course spend per active study hour) and a projected future hourly rate compounding percentage.
3. **Proper Restorative Relax & Wellness**: Hours upgraded from low-quality doom-scrolling into intentional restorative activities (Pilates, massage, sport, reading, nature walks, quality couple time) connected to ExternalProvider `Health & Sport` streams (`#pilates`, `#massage`, `#gym`).

#### Scenario: Splitting weekly drift hours across Side Hustle, Learning, and Proper Relax
- **WHEN** a partner has `9h/week` of self-identified drift and allocates `4h` to Side Hustle, `3h` to Learning, and `2h` to Proper Relax
- **THEN** the simulator calculates monthly extra cashflow from the `4h/week` side hustle, computes active subscription/course ROI and skill growth on the `3h/week` learning investment against ExternalProvider `Learning` transactions, and credits `+2h/week` to intentional restorative wellness

### Requirement: Primary partner Offer Comparator rate linking and Vacation vs. Day-Off Monetization dial
For the primary partner (`me`), the system SHALL pull the active offer track's **Effective Net Hourly Rate**, **Side-Gig Marginal Net Hourly Rate** (accounting for shared fixed ZUS and *Składka Zdrowotna* / tax bracket thresholds), and **Time-Off Policy** (`TimeOffPolicy` across Models A, B, and C) from `LocalStorageOfferRepository`, while allowing a manual hourly rate override. The system SHALL provide a **Vacation Relax vs. Day-Off Monetization** dial over the annual days-off pool (vacation days + Polish weekday state holidays) allowing the user to partition days off into:
1. **Sacred Unplug Vacation & Rest Days** (protected for trips and full offline recovery), and
2. **Optional Monetized / Side-Project Days Off** (e.g., billing extra hours on an hourly B2B contract during a quiet holiday or dedicating staycation days to a side gig or pet project), outputting the annualized and monthly net PLN boost.

#### Scenario: Balancing unplug vacation days against monetized days off
- **WHEN** the primary partner's active Offer Comparator revision provides `26` PTO days and `13` state holidays (`39` total days off) and the user reserves `32` days for Sacred Unplug Vacation & Rest while allocating `7` days (`56` hours) to optional Day-Off Monetization at a marginal net rate of `150 PLN/hr`
- **THEN** the system cheers the `32` protected rest days and calculates `+8,400 PLN/year` (`+700 PLN/month` averaged) in additional net goal funding from the `7` monetized days

### Requirement: Spouse Opportunity Engine with Part-Time Freelancing and Family Pet Projects
For the spouse (`wife`), the system SHALL support a motivating **Opportunity Menu** containing two customizable tracks:
1. **Part-Time Freelancing / Micro-Services Track**: Configurable hourly or per-task/project payout rates (e.g., freelance tasks, creative work, tutoring, reselling, or assisting with B2B operations) that generate immediate monthly PLN toward her chosen goals.
2. **Family Pet Projects & Automation Track**: Models non-invoiced pet-project work through three concrete value streams so her effort is immediately valued and motivating:
   - **Monthly Money Saved**: Estimated recurring household expenses eliminated by the project/automation (`PLN/month`).
   - **Household Hours Saved**: Weekly hours saved for the family (`hrs/week`), valued either as freed-up household leisure or freed-up B2B billable capacity.
   - **Future Income Upside & Milestone Bounty**: Projected monthly side-income upon project launch (`PLN/month`) plus an optional **Family Project Milestone Bounty** (`PLN` transferred to her personal goal fund when a project milestone ships).

#### Scenario: Modeling a family automation pet project on Wife's profile
- **WHEN** the spouse allocates `5h/week` of reclaimed drift to a Family Pet Project estimated to save `300 PLN/month` in household expenses, save `2h/week` of family admin time, and carry a `1,000 PLN` Family Milestone Bounty toward her personal goal
- **THEN** the opportunity card displays both the immediate monthly household savings equivalent and the `1,000 PLN` milestone reward progress toward her selected personal goal

### Requirement: Multi-goal impact translators (1st Mortgage, Trips, and Personal Goals)
The system SHALL translate combined and per-partner monthly extra value into tangible milestone accelerators across three goal categories:
1. **1st Mortgage Down Payment (*Wkład własny*) & Home Finishing**: Reads `MortgageRepository` (`family-budget:mortgage-simulator:v1`) and linked ExternalProvider Goals to compute how the extra monthly cashflow reduces the months remaining to **Milestone 1 (Signing / *Umowa deweloperska*)** and **Milestone 2 (Key Handover & Finishing)**, as well as the equivalent apartment floor area (`m²` per year at the configured `PLN/m²` price) unlocked by reclaimed drift time.
2. **Dream Trip Benchmarks**: Extracts historical trip episodes and their Total Cost of Ownership (TCO) from ExternalProvider transactions (via the Trips & Concerts episode detector) so users can compare annual reclaimed drift value against real past vacations (e.g., *"Equals 1.4x your Madeira trip per year"*) or a custom next-trip budget.
3. **Personal / Her-Preference Goals**: Allows creating custom personal or shared wishlist goals (with title, target amount in PLN, current saved amount, and owner scope `wife` | `me` | `shared`) so each partner—especially the spouse—can route their reclaimed time toward a motivating reward of their own choice.

#### Scenario: Translating reclaimed household drift into 1st Mortgage acceleration
- **WHEN** Milestone 1 (*wkład własny* + closing fees) has a remaining cash gap of `90,000 PLN`, baseline household savings pace is `6,000 PLN/month` (`15.0` months to goal), and the couple's reclaimed drift + day-off monetization adds `+3,000 PLN/month` (`9,000 PLN/month` combined pace)
- **THEN** the Mortgage Goal Translator displays that Milestone 1 is reached in `10.0` months (`5.0` months earlier) and shows the equivalent annual `m²` of apartment space funded (`36,000 PLN / pricePerSqmPln`)

#### Scenario: Routing Wife's reclaimed drift to a Goal of Her Preference
- **WHEN** the spouse selects a personal goal (e.g., `"Rome Weekend & Spa — 4,500 PLN"`) as her active reward target and generates `+1,125 PLN/month` from her reclaimed drift time
- **THEN** her goal card highlights that her chosen reward is 100% funded in `4.0` months while keeping her Joyful Fun hours and Partner Care hours celebrated

### Requirement: LocalStorage persistence with JSON export and import
The system SHALL persist all dual-player profile configurations, opportunity presets, custom personal goals, and weekly check-in logs in browser `localStorage` under a versioned key (`family-budget:time-value-motivator:v1`), and provide **Export JSON** and **Import JSON** actions with schema validation.

#### Scenario: Exporting and restoring Time & Opportunity Motivator state
- **WHEN** the user logs weekly check-in entries, customizes pet-project parameters, exports the state to JSON, and later imports that JSON file
- **THEN** all dual-player settings, weekly reflection logs, and personal goals are restored accurately without data loss
