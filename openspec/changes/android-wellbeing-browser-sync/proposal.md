# Proposal

## Why

Manually checking Android Digital Wellbeing every Sunday on two different devices (Pixel 9 Pro on Android OS and Galaxy S24 on Mobile OS) and typing screen-time hours into the Weekly Check-In Log works well initially, but can be further streamlined. We want a future-ready draft change exploring automated or agent-assisted ingestion of weekly gaming and social-network hours into the Time & Opportunity Motivator (`time-value-motivator`), using `agent-browser` automation or lightweight Android export/companion flows.

## What Changes

- Define a structured **Weekly Screen-Time Import Contract** (`ScreenTimeImportPayload`) compatible with `family-budget:time-value-motivator:v1` so external automations or browser harnesses can populate draft weekly check-ins for both partners (`me` on Pixel 9 Pro and `wife` on Galaxy S24) while preserving the human "Joy vs. Drift" reflection step.
- Explore and specify three candidate ingestion pathways for Android Digital Wellbeing:
  1. **`agent-browser` Harness Flow**: An automated browser/CLI workflow where an agent reads exported Digital Wellbeing snapshots, Google Account activity summaries, or uploaded weekly screenshots and fills the Weekly Check-In form in `/dashboard/family-budget/lifestyle/time-value` via `agent-browser`.
  2. **Screenshot / Share-Sheet Dropzone**: Dropping or pasting a weekly Mobile OS Digital Wellbeing or Android Digital Wellbeing summary card to pre-fill gaming and social app hours.
  3. **Android Webhook / Tasker / MacroDroid Push**: A local JSON import endpoint or URL-hash payload for one-tap Sunday sync from Android.
- Ensure any automated import lands in a **"Pending Reflection" state** so neither partner's screen time is automatically labeled as "wasted"—both partners still review their week and celebrate their fun recharge hours first.

## Capabilities

### New Capabilities
- `android-wellbeing-sync`: Automated and agent-assisted (`agent-browser`) ingestion of weekly Android Digital Wellbeing screen-time metrics (Galaxy S24 & Pixel 9 Pro) into the Time & Opportunity Motivator weekly check-in log.

### Modified Capabilities
<!-- None required for this draft exploration change -->

## Impact

- **Target Integration**: Extends the Weekly Check-In Log in `/dashboard/family-budget/lifestyle/time-value` (`time-value-motivator`).
- **Automation Tooling**: Integrates with `agent-browser` CLI workflows and local JSON/clipboard import handlers.
