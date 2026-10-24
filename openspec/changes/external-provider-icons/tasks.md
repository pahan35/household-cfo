# Tasks

## 1. Icon Registry & Shared Renderer

- [ ] 1.1 Create `external-provider-icons.tsx` with the 80 ExternalProvider icon definitions, `ExternalProviderIconName` type union, group metadata (Finance, Living, Food, Transport, Tech, Lifestyle, Health, Work), and search keywords. Verify mapping completeness and keyword coverage via unit tests in `external-provider-icons.test.ts`.
- [ ] 1.2 Implement the `<ExternalProviderIcon />` component in `external-provider-icons.tsx` supporting `icon`, `fallbackType`, and `className`, enforcing the fallback cascade (`icon` -> `categoryType` -> `CreditCard`). Verify exact match, empty/null, and unrecognized string behaviors with unit tests.

## 2. Icon Picker Component

- [ ] 2.1 Implement `ExternalProviderIconPicker` in `external-provider-icon-picker.tsx` with Popover, search input, group filtering, and grid selection supporting controlled `value` and `onChange`. Verify unit tests for selection events and search filtering.

## 3. Dashboard Integrations

- [ ] 3.1 Update `accounts-card.tsx` to replace `getAccountIcon` with `<ExternalProviderIcon icon={account.icon} fallbackType={typeNum} />`, verifying that account rows display their specific assigned icons.
- [ ] 3.2 Update `income-sources-card.tsx` to replace the static banknote icon with `<ExternalProviderIcon icon={category.icon} fallbackType={CategoryType.Income} />`, verifying that income sources display distinct icons (e.g. salary, investments, bonus).
- [ ] 3.3 Update `recent-transactions-card.tsx` to display category icon badges on transaction rows, verifying that transaction entries reflect their counterparty category icons.
- [ ] 3.4 Integrate `ExternalProviderIconPicker` into `debt-account-init-dialog.tsx`, defaulting to `"debt"` and updating the initialized account payload. Verify that creating a debt account with a custom icon persists the selected icon key.

## 4. Verification & Testing

- [ ] 4.1 Run unit tests (`npm run test`) and code verification (`npm run verify`), confirming zero TypeScript errors, clean linting/formatting, and passing test coverage across all modified components.
