# Proposal

## Why

A few hours of mobile/video gaming or social media (Instagram, Threads, etc.) per week is healthy recovery after work and household responsibilities, whereas losing the majority of free time to mindless gaming or doom-scrolling leaves both partners drained without advancing meaningful life goals. We need an empathetic, zero-blame, dual-player ("Me & My Wife") capability that celebrates partner/home care and genuinely fun recharge time first, and then shows how reallocating self-identified "drift" hours (plus optional day-off monetization) into side hustles, family pet projects, skill learning, or proper restorative relax can accelerate concrete goals like the 1st mortgage down payment (*wkład własny*), dream trips, and personal wishlists.

## What Changes

- Add a new **Time & Opportunity Motivator** screen at `/dashboard/family-budget/lifestyle/time-value` integrated into the `Lifestyle & Tags` in-page tab navigation (`lifestyle-layout-client.tsx`) and the `Family Budget -> Lifestyle & Tags` sidebar navigation (`sidebar-items.ts`).
- Implement a **Dual-Player Household Setup (Me + Wife)** tailored to each partner's real life context:
  - **Partner & Home Care Recognition**: Celebrates and tracks weekly care, household management, and partner support hours (especially recognizing the spouse's foundational contribution over the past 3 years outside formal employment) before evaluating screen time.
  - **Joy vs. Drift Screen-Time Reflection (Option A Interactive Sliders + Option B Weekly Check-In Log)**: Tracks weekly gaming (mobile/PC/console) and social network (Instagram, Threads, etc.) hours across devices (Pixel 9 Pro and Galaxy S24), cheering for fun/recharging hours and isolating only the self-reported "drift / meh" hours that each partner *chooses* to reallocate.
  - **3-Way Drift Reallocation Portfolio**: Allows both partners to split reclaimed drift hours across:
    1. **Extra Income & Side Hustles / Pet Projects**:
       - Primary user: Links directly to `Offer Comparator` (`LocalStorageOfferRepository`) marginal net hourly rate and side-gig tax settings, plus a **Vacation Relax vs. Day-Off Monetization** dial using the active offer's `TimeOffPolicy` (protecting sacred unplug vacation days while showing net PLN yield from optional monetized staycation/holiday days).
       - Wife: Supports **Part-Time Freelancing** (hourly or per-task immediate cash) and **Family Pet Projects & Automation** (valuing monthly money saved, household hours saved, projected future launch income, and optional Family Project Milestone Bounties funded into her personal goals).
    2. **Learning & Skill Investment**: Connects reclaimed learning hours to existing ExternalProvider `Learning` spend (`#platform`, `#course`, `#tutor`, `#books`, `#cert` via `computeLearningMetrics`) to surface "Subscription/Course Active ROI" (effective PLN per active study hour) and long-term career rate compounding.
    3. **Proper Restorative Relax & Wellness**: Encourages swapping low-quality doom-scrolling for intentional offline/active recharge (Pilates, massage, sport, reading, couple time) linked to ExternalProvider `Health & Sport` streams.
- Implement **Multi-Goal Accelerators**:
  - **1st Mortgage Down Payment (*Wkład własny*) & Home Finishing**: Reads `MortgageRepository` (`family-budget:mortgage-simulator:v1`) and linked ExternalProvider Goals to show months shaved off Milestone 1 / Milestone 2 and equivalent apartment `m²` unlocked per year.
  - **Dream Trip Benchmarks**: Reads historical trip TCOs from `Trips & Concerts` (e.g., Madeira, Austria, Maldives) to express reclaimed time as concrete trip multiples per year.
  - **Personal / Her-Preference Goals**: Allows creating custom personal or shared wishlist goals so the spouse can direct her side-hustle and pet-project rewards toward goals of her own preference.
- Add a compact **Side-Hustle & Time Accelerator callout** inside the `Mortgage & Home Goal Simulator` (`/dashboard/family-budget/mortgage`) linking back to the Time & Opportunity Motivator.
- Persist all dual-player profiles, weekly check-in logs, pet-project models, and custom goals in `localStorage` (`family-budget:time-value-motivator:v1`) with validated JSON export and import.

## Capabilities

### New Capabilities
- `time-value-motivator`: Dual-player ("Me & Wife") empathetic screen-time reflection (Joy vs. Drift), partner care recognition, 3-way drift reallocation (side hustles/pet projects, learning ROI, proper relax), Offer Comparator day-off monetization dial, and goal acceleration translators for Mortgage, Trips, and personal goals.

### Modified Capabilities
- `mortgage-home-goal-simulator`: Add an optional Time & Side-Hustle Accelerator summary banner/toggle in the Mortgage Goal Tracker showing how monthly extra income from reclaimed household drift time reduces months to Milestone 1 (*wkład własny*) and Milestone 2 (*wykończenie*).

## Impact

- **Routes & Navigation**:
  - `src/app/(main)/dashboard/family-budget/lifestyle/time-value/page.tsx` and `_components/*`
  - `src/app/(main)/dashboard/family-budget/lifestyle/lifestyle-layout-client.tsx`
  - `src/navigation/sidebar/sidebar-items.ts`
- **Cross-Module Integration**:
  - Reads `MortgageRepository` (`src/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-repository.ts`) and updates `home-goal-tracker-card.tsx`
  - Reads `LocalStorageOfferRepository` (`src/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository.ts`)
  - Consumes `useLifestyleData` and `computeLearningMetrics` / `computeWellnessMetrics` (`src/app/(main)/dashboard/family-budget/_components/lifestyle-transforms.ts`)
- **Storage**: Browser `localStorage` key `family-budget:time-value-motivator:v1` with JSON export/import. No new external dependencies or backend secrets required.
