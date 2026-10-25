# Tasks

## 1. Exclusion Presets Hook & Storage Refinement

- [x] 1.1 Remove `rentExclusionOverride`, `toggleRentExclusion`, and `isRentExcluded` from `use-exclusion-presets.ts` and verify presets drive all exclusions directly
- [x] 1.2 Update `localStorage` loading logic in `use-exclusion-presets.ts` to retain and merge customized built-in presets (e.g. "Controllable Expenses") across reloads
- [x] 1.3 Add automated unit tests for `use-exclusion-presets` verifying preset overrides, localStorage persistence, and category exclusion updates

## 2. Expenses Breakdown Header & Switch Cleanup

- [x] 2.1 Remove the "Exclude Rent" switch and label from `expense-pie-card.tsx` and verify the action header neatly aligns the preset selector and settings button
- [x] 2.2 Clean up duplicate `useExclusionPresets` instantiation in `expense-pie-card.tsx` so the passed `presetController` instance is reused cleanly

## 3. Preset Dialog Category Filtering & Archive Logic

- [x] 3.1 Add `useEffect` in `preset-dialog.tsx` to synchronize `draftExclusions`, `selectedPresetId`, and preset names whenever the dialog opens or active preset changes
- [x] 3.2 Filter `categories` in `preset-dialog.tsx` to omit account types (`isAccountType`), income sources (`CategoryType.Income`), and savings goals (`CategoryType.Goal`, `CategoryType.ClassicGoal`), verifying only true expense categories are listed
- [x] 3.3 Apply category archive logic in `preset-dialog.tsx` using `isArchivedCategoryName`: hide inactive archived categories by default, add a "Show archived (N)" toggle button, and display sanitized names with an "Archived" badge

## 4. Verification & Quality Gates

- [x] 4.1 Run unit test suites to confirm preset persistence, category filtering, and budget transforms pass
- [x] 4.2 Run `npm run verify` (`biome check && tsc --noEmit`) to verify zero linting, formatting, or TypeScript errors
