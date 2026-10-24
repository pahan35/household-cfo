import { format, isValid, parseISO } from "date-fns";

export const ExchangeKey = {
  User: 0,
  Transaction: 1,
  Category: 2,
  Tag: 3,
  Currency: 4,
  BudgetData: 5,
  Icon: 6,
} as const;

export type ExchangeKey = (typeof ExchangeKey)[keyof typeof ExchangeKey];

export const CategoryType = {
  Unknown: 0,
  Income: 1,
  Account: 2,
  Expense: 3,
  ClassicGoal: 4,
  DebtAccount: 5,
  Goal: 6,
  BankAccount: 7,
} as const;

export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

export function isAccountType(type: number | undefined | null): boolean {
  const t = Number(type);
  return t === CategoryType.Account || t === CategoryType.BankAccount || t === CategoryType.DebtAccount;
}

/**
 * Normalizes user input for debt account name, stripping any accidental leading "Debt:" or "_" prefixes.
 */
export function formatThrowawayDebtAccountName(rawName: string): string {
  const clean = rawName
    .trim()
    .replace(/^_+/, "")
    .trim()
    .replace(/^debt:\s*/i, "")
    .trim();
  return clean.length > 0 ? clean : "Debt";
}

/**
 * Returns true if the category is a non-deleted native Debt Account (`categoryType === CategoryType.DebtAccount` / 5).
 */
export function isThrowawayDebtAccount(category: ExternalProviderCategory | null | undefined): boolean {
  if (!category || category.deleted) return false;
  return Number(category.categoryType) === CategoryType.DebtAccount;
}
export interface ExternalProviderSettings {
  language?: string;
  licenseType?: number;
  email?: string;
  userId?: string;
  defaultCurrency?: string;
  durationOfPeriod?: number;
  onboardingShown?: boolean;
  periodStartsAt?: string;
  [key: string]: unknown;
}

export interface SettingsResponseEnvelope {
  isSuccess?: boolean;
  data?: ExternalProviderSettings;
  message?: string;
}

export interface ExchangePingItem {
  key: number;
  entityJson: string | null;
  [key: string]: unknown;
}

export interface ExchangePingResponseEnvelope {
  isSuccess?: boolean;
  data?: {
    items?: ExchangePingItem[];
    [key: string]: unknown;
  };
  message?: string;
}

export interface ExternalProviderCategory {
  id: string;
  currencyId?: string;
  limitAmount?: number;
  amount?: number;
  periodizedLimitAmount?: number;
  deleted?: boolean;
  categoryType: CategoryType | number;
  createdTimestamp?: number;
  deletedWithTransactions?: boolean;
  goalClosed?: boolean;
  icon?: string;
  name: string;
  order?: number;
  parentUid?: string | null;
  exceptFromBalance?: boolean;
  goalClosedDate?: string | null;
  free?: boolean;
  [key: string]: unknown;
}

export interface ExternalProviderTransaction {
  id: string;
  tags?: string[];
  sourceId?: string;
  sourceType?: CategoryType | number;
  sourceAmount?: number;
  sourceName?: string;
  sourceCurrencyId?: string;
  destinationId?: string;
  destinationType?: CategoryType | number;
  destinationAmount?: number;
  destinationName?: string;
  destinationCurrencyId?: string;
  defaultAmount?: number;
  comment?: string | null;
  deleted?: boolean;
  dateTimestamp?: number;
  dateTimestampISO?: string;
  createdTimestamp?: number;
  timestamp?: number;
  debtPaymentAmount?: number;
  isComplete?: boolean;
  counter?: number;
  repeatingParentId?: string | null;
  importedTransactionId?: string | null;
  [key: string]: unknown;
}

export interface TransactionPageResponse {
  transactions?: ExternalProviderTransaction[];
  importedTransactions?: unknown[];
  hasMoreData?: boolean;
}

export interface StatCategoryPoint {
  id: string;
  title?: string;
  name?: string;
  amount?: number;
  value?: number;
  limitAmount?: number;
  currentAmount?: number;
  [key: string]: unknown;
}

export interface StatPoint {
  date?: string;
  id: string;
  categories: StatCategoryPoint[];
  [key: string]: unknown;
}

export interface StatPingSelection {
  periodType?: number;
  statisticType?: number;
  period?: {
    from: string;
    to: string | null;
    before?: number | null;
    after?: number | null;
  };
  filter?: unknown;
  params?: {
    currency?: string;
    [key: string]: unknown;
  };
  points?: StatPoint[];
  [key: string]: unknown;
}

export interface StatPingData {
  selection?: StatPingSelection;
  [key: string]: unknown;
}

export interface StatPingResponseEnvelope {
  isSuccess?: boolean;
  data?: StatPingData;
  message?: string;
}

/**
 * Parses double-encoded entityJson from an Exchange/Ping item.
 */
export function parseExchangeEntities<T>(entityJson: string | null | undefined): T[] {
  if (!entityJson || typeof entityJson !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(entityJson);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Extracts and parses entities for a given ExchangeKey from the response items.
 */
export function extractExchangeEntities<T>(items: ExchangePingItem[] | undefined, key: ExchangeKey): T[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  const item = items.find((it) => it.key === key);
  return parseExchangeEntities<T>(item?.entityJson);
}

/**
 * Formats a monetary amount with currency. Fallback safely to code prefix if Intl throws.
 */
export function formatMoney(amount: number, currency = "PLN"): string {
  const normalizedCurrency = currency?.trim().toUpperCase() || "PLN";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${normalizedCurrency} ${formattedNumber}`;
  }
}

/**
 * Formats an ISO date string (from dateTimestampISO) for display.
 */
export function formatTransactionDate(isoString: string | null | undefined): string {
  if (!isoString) {
    return "Unknown date";
  }
  try {
    const parsed = parseISO(isoString);
    if (!isValid(parsed)) {
      return isoString;
    }
    return format(parsed, "MMM d, yyyy");
  } catch {
    return isoString;
  }
}

/**
 * Checks if a category or account name begins with "_" (soft-archive naming convention).
 */
export function isArchivedCategoryName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }
  return name.trim().startsWith("_");
}

/**
 * Sorts categories ascending by ExternalProvider's `order` property (`category.order`),
 * tie-breaking by `id`.
 */
export function sortCategoriesByOrder<T extends { order?: number; id?: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const idA = a.id ?? "";
    const idB = b.id ?? "";
    return idA.localeCompare(idB);
  });
}

export interface ReorderCategoriesResult {
  updatedCategories: ExternalProviderCategory[];
  modifiedCategories: ExternalProviderCategory[];
}

/**
 * Recalculates category `order` attributes when a subset of visible categories is reordered.
 * Slots the reordered items back into the positions occupied by the visible subset within
 * the full category group, assigns sequential integer order values (0, 1, 2, ...), and returns
 * both the updated full list and the subset of entities whose order actually changed.
 */
export function reorderCategoriesSubset(
  allCategories: ExternalProviderCategory[],
  reorderedVisibleIds: string[],
  isSameGroup?: (category: ExternalProviderCategory) => boolean,
): ReorderCategoriesResult {
  if (reorderedVisibleIds.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const visibleIdSet = new Set(reorderedVisibleIds);

  let groupFilter = isSameGroup;
  if (!groupFilter) {
    const firstVisible = allCategories.find((c) => visibleIdSet.has(c.id));
    if (firstVisible) {
      const t = Number(firstVisible.categoryType);
      const isAccountType =
        t === CategoryType.Account || t === CategoryType.BankAccount || t === CategoryType.DebtAccount;
      if (isAccountType) {
        groupFilter = (c) => {
          const type = Number(c.categoryType);
          return (
            type === CategoryType.Account || type === CategoryType.BankAccount || type === CategoryType.DebtAccount
          );
        };
      } else if (t === CategoryType.Income) {
        groupFilter = (c) => Number(c.categoryType) === CategoryType.Income;
      } else {
        groupFilter = (c) => {
          const type = Number(c.categoryType);
          return type === CategoryType.Expense || type === CategoryType.Goal || type === CategoryType.ClassicGoal;
        };
      }
    } else {
      groupFilter = () => true;
    }
  }

  const activeFilter = groupFilter ?? (() => true);

  // 1. Group categories sorted by current order
  const groupCategories = sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && activeFilter(c)));

  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
  const reorderedVisibleItems: ExternalProviderCategory[] = [];
  for (const id of reorderedVisibleIds) {
    const cat = categoryMap.get(id);
    if (cat) {
      reorderedVisibleItems.push(cat);
    }
  }

  // 2. Identify the slots (indices) occupied by visible items within groupCategories
  const visibleSlots: number[] = [];
  for (let i = 0; i < groupCategories.length; i++) {
    if (visibleIdSet.has(groupCategories[i].id)) {
      visibleSlots.push(i);
    }
  }

  // 3. Slot the reordered visible items into their original relative positions
  const newGroup = [...groupCategories];
  for (let k = 0; k < visibleSlots.length && k < reorderedVisibleItems.length; k++) {
    newGroup[visibleSlots[k]] = reorderedVisibleItems[k];
  }

  // 4. Assign sequential integer order values (0, 1, 2, ...) across the group
  const updatedGroupMap = new Map<string, ExternalProviderCategory>();
  const modifiedCategories: ExternalProviderCategory[] = [];

  for (let idx = 0; idx < newGroup.length; idx++) {
    const cat = newGroup[idx];
    if (cat.order !== idx) {
      const updatedCat: ExternalProviderCategory = { ...cat, order: idx };
      updatedGroupMap.set(cat.id, updatedCat);
      modifiedCategories.push(updatedCat);
    } else {
      updatedGroupMap.set(cat.id, cat);
    }
  }

  // 5. Replace group items in allCategories in their new relative order
  const allCategoryIndicesForGroup: number[] = [];
  for (let i = 0; i < allCategories.length; i++) {
    if (!allCategories[i].deleted && activeFilter(allCategories[i])) {
      allCategoryIndicesForGroup.push(i);
    }
  }

  const updatedCategories = [...allCategories];
  for (let k = 0; k < allCategoryIndicesForGroup.length && k < newGroup.length; k++) {
    const cat = newGroup[k];
    const updated = updatedGroupMap.get(cat.id) ?? { ...cat, order: k };
    updatedCategories[allCategoryIndicesForGroup[k]] = updated;
  }

  return {
    updatedCategories,
    modifiedCategories,
  };
}

export function applyCategoryGroupUpdates(
  allCategories: ExternalProviderCategory[],
  newGroup: ExternalProviderCategory[],
  groupPredicate: (c: ExternalProviderCategory) => boolean,
): ReorderCategoriesResult {
  const groupIndices: number[] = [];
  for (let i = 0; i < allCategories.length; i++) {
    const c = allCategories[i];
    if (!c.deleted && groupPredicate(c)) {
      groupIndices.push(i);
    }
  }

  const originalMap = new Map(allCategories.map((c) => [c.id, c]));
  const modifiedCategories: ExternalProviderCategory[] = [];
  const updatedGroupMap = new Map<string, ExternalProviderCategory>();

  for (let idx = 0; idx < newGroup.length; idx++) {
    const cat = newGroup[idx];
    const orig = originalMap.get(cat.id);
    const updatedCat: ExternalProviderCategory = { ...cat, order: idx };
    updatedGroupMap.set(cat.id, updatedCat);

    if (
      !orig ||
      orig.order !== idx ||
      orig.name !== updatedCat.name ||
      orig.exceptFromBalance !== updatedCat.exceptFromBalance
    ) {
      modifiedCategories.push(updatedCat);
    }
  }

  const updatedCategories = [...allCategories];
  for (let k = 0; k < groupIndices.length && k < newGroup.length; k++) {
    const cat = newGroup[k];
    const updated = updatedGroupMap.get(cat.id) ?? { ...cat, order: k };
    updatedCategories[groupIndices[k]] = updated;
  }

  return {
    updatedCategories,
    modifiedCategories,
  };
}

function applyAccountGroupUpdates(
  allCategories: ExternalProviderCategory[],
  newAccountGroup: ExternalProviderCategory[],
): ReorderCategoriesResult {
  return applyCategoryGroupUpdates(allCategories, newAccountGroup, (c) => isAccountType(c.categoryType));
}

export function applyIncomeGroupUpdates(
  allCategories: ExternalProviderCategory[],
  newIncomeGroup: ExternalProviderCategory[],
): ReorderCategoriesResult {
  return applyCategoryGroupUpdates(
    allCategories,
    newIncomeGroup,
    (c) => Number(c.categoryType) === CategoryType.Income,
  );
}

/**
 * Converts a JavaScript Date (or current time) to .NET DateTime ticks.
 * Formula: ticks = date.getTime() * 10^4 + 621355968000000000
 */
export function toDotNetTicks(date: Date = new Date()): number {
  return Number(BigInt(date.getTime()) * BigInt(10000) + BigInt("621355968000000000"));
}

/**
 * Normalizes a transaction date input (Date or YYYY-MM-DD string) to UTC midnight .NET ticks and ISO string.
 */
export function normalizeTransactionDate(dateInput?: Date | string): {
  dateUtcMidnight: Date;
  dateTimestamp: number;
  dateTimestampISO: string;
} {
  let year: number;
  let month: number;
  let day: number;

  if (typeof dateInput === "string") {
    const parts = dateInput.trim().split("-");
    if (parts.length === 3) {
      year = Number.parseInt(parts[0], 10);
      month = Number.parseInt(parts[1], 10) - 1;
      day = Number.parseInt(parts[2], 10);
    } else {
      const parsed = new Date(dateInput);
      year = parsed.getUTCFullYear();
      month = parsed.getUTCMonth();
      day = parsed.getUTCDate();
    }
  } else if (dateInput instanceof Date) {
    year = dateInput.getUTCFullYear();
    month = dateInput.getUTCMonth();
    day = dateInput.getUTCDate();
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
    day = now.getDate();
  }

  const dateUtcMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return {
    dateUtcMidnight,
    dateTimestamp: toDotNetTicks(dateUtcMidnight),
    dateTimestampISO: dateUtcMidnight.toISOString(),
  };
}

export interface NewDebtAccountInput {
  name: string;
  currencyId: string;
  exceptFromBalance?: boolean;
  id?: string;
  createdDate?: Date;
  icon?: string;
}

export interface BuildNewDebtAccountResult extends ReorderCategoriesResult {
  newAccount: ExternalProviderCategory;
}

/**
 * Creates a new ExternalProviderCategory entity of native type CategoryType.DebtAccount (5) with icon "debt",
 * places it immediately before the first archived ("_"-prefixed) account (or at the end of active accounts),
 * and re-indexes sequential integer order values (0, 1, 2, ...).
 * Defaults exceptFromBalance to true.
 * Returns the new category along with updatedCategories and modifiedCategories.
 */
export function buildNewDebtAccountCategory(
  allCategories: ExternalProviderCategory[],
  input: NewDebtAccountInput,
): BuildNewDebtAccountResult {
  const newAccount: ExternalProviderCategory = {
    id:
      input.id ??
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `debt-${Date.now()}`),
    name: formatThrowawayDebtAccountName(input.name),
    currencyId: input.currencyId,
    categoryType: CategoryType.DebtAccount,
    amount: 0,
    limitAmount: 0,
    periodizedLimitAmount: 0,
    deleted: false,
    deletedWithTransactions: false,
    goalClosed: false,
    icon: input.icon ?? "debt",
    parentUid: null,
    exceptFromBalance: input.exceptFromBalance !== undefined ? Boolean(input.exceptFromBalance) : true,
    createdTimestamp: toDotNetTicks(input.createdDate ?? new Date()),
  };

  const accounts = sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && isAccountType(c.categoryType)));

  const firstArchivedIdx = accounts.findIndex((c) => isArchivedCategoryName(c.name));
  const insertIdx = firstArchivedIdx === -1 ? accounts.length : firstArchivedIdx;

  const newAccountGroup = [...accounts.slice(0, insertIdx), newAccount, ...accounts.slice(insertIdx)];

  const baseCategoriesWithNew = [...allCategories, newAccount];
  const reorderResult = applyAccountGroupUpdates(baseCategoriesWithNew, newAccountGroup);

  const finalizedNewAccount = reorderResult.updatedCategories.find((c) => c.id === newAccount.id) ?? {
    ...newAccount,
    order: insertIdx,
  };

  const modifiedCategories = reorderResult.modifiedCategories.some((c) => c.id === newAccount.id)
    ? reorderResult.modifiedCategories
    : [finalizedNewAccount, ...reorderResult.modifiedCategories];

  return {
    newAccount: finalizedNewAccount,
    updatedCategories: reorderResult.updatedCategories,
    modifiedCategories,
  };
}

/**
 * Archives an account category:
 * - Prefixes its name with "_"
 * - Sets exceptFromBalance if specified in options
 * - Moves it to the end of the accounts group
 * - Re-indexes sequential integer orders (0, 1, 2, ...)
 * - Returns updated and modified categories
 */
export function archiveAccountCategory(
  allCategories: ExternalProviderCategory[],
  accountId: string,
  options?: { exceptFromBalance?: boolean },
): ReorderCategoriesResult {
  const target = allCategories.find((c) => c.id === accountId && !c.deleted && isAccountType(c.categoryType));
  if (!target) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const cleanName = target.name.replace(/^_+/, "").trim();
  const newName = cleanName.length > 0 ? `_${cleanName}` : "_";
  const updatedTarget: ExternalProviderCategory = {
    ...target,
    name: newName,
    ...(options?.exceptFromBalance !== undefined ? { exceptFromBalance: options.exceptFromBalance } : {}),
  };

  const accounts = sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && isAccountType(c.categoryType)));

  const remaining = accounts.filter((c) => c.id !== accountId);
  const newGroup = [...remaining, updatedTarget];

  return applyAccountGroupUpdates(allCategories, newGroup);
}

/**
 * Archives an income category:
 * - Prefixes its name with "_"
 * - Moves it to the end of the income categories group
 * - Re-indexes sequential integer orders (0, 1, 2, ...)
 * - Returns updated and modified categories
 */
export function archiveIncomeCategory(
  allCategories: ExternalProviderCategory[],
  categoryId: string,
): ReorderCategoriesResult {
  const target = allCategories.find(
    (c) => c.id === categoryId && !c.deleted && Number(c.categoryType) === CategoryType.Income,
  );
  if (!target) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const cleanName = target.name.replace(/^_+/, "").trim();
  const newName = cleanName.length > 0 ? `_${cleanName}` : "_";
  const updatedTarget: ExternalProviderCategory = {
    ...target,
    name: newName,
  };

  const incomeCategories = sortCategoriesByOrder(
    allCategories.filter((c) => !c.deleted && Number(c.categoryType) === CategoryType.Income),
  );

  const remaining = incomeCategories.filter((c) => c.id !== categoryId);
  const newGroup = [...remaining, updatedTarget];

  return applyIncomeGroupUpdates(allCategories, newGroup);
}

export interface PrincipalOutflowParams {
  id?: string;
  date?: Date | string;
  sourceAccount: ExternalProviderCategory;
  debtAccount: ExternalProviderCategory;
  sourceAmount: number;
  destinationAmount: number;
  comment?: string | null;
  tags?: string[];
}

export function buildPrincipalOutflowTransaction(params: PrincipalOutflowParams): ExternalProviderTransaction {
  const { dateTimestamp, dateTimestampISO } = normalizeTransactionDate(params.date);
  const nowTicks = toDotNetTicks();
  const id =
    params.id ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tx-${Date.now()}`);

  return {
    id,
    deleted: false,
    dateTimestamp,
    dateTimestampISO,
    createdTimestamp: nowTicks,
    timestamp: nowTicks,
    isComplete: true,
    debtPaymentAmount: 0,
    sourceId: params.sourceAccount.id,
    sourceType: params.sourceAccount.categoryType,
    sourceAmount: Math.abs(params.sourceAmount),
    sourceCurrencyId: params.sourceAccount.currencyId,
    sourceName: params.sourceAccount.name,
    destinationId: params.debtAccount.id,
    destinationType: params.debtAccount.categoryType,
    destinationAmount: Math.abs(params.destinationAmount),
    destinationCurrencyId: params.debtAccount.currencyId,
    destinationName: params.debtAccount.name,
    comment: params.comment?.trim() || null,
    tags: params.tags ?? [],
  };
}

export interface FeeTransactionParams {
  id?: string;
  date?: Date | string;
  sourceAccount: ExternalProviderCategory;
  debtAccount: ExternalProviderCategory;
  feeExpenseCategory?: ExternalProviderCategory;
  absorbedBy: "debtor" | "me";
  feeAmount: number;
  convertedFeeAmount?: number;
  comment?: string | null;
  tags?: string[];
}

export function buildFeeTransaction(params: FeeTransactionParams): ExternalProviderTransaction {
  const { dateTimestamp, dateTimestampISO } = normalizeTransactionDate(params.date);
  const nowTicks = toDotNetTicks();
  const id =
    params.id ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tx-${Date.now()}`);

  const feeAmount = Math.abs(params.feeAmount);
  const convertedAmount = Math.abs(params.convertedFeeAmount ?? params.feeAmount);

  if (params.absorbedBy === "debtor") {
    // Transfer from payment account to debt account (increases debt balance)
    return {
      id,
      deleted: false,
      dateTimestamp,
      dateTimestampISO,
      createdTimestamp: nowTicks,
      timestamp: nowTicks,
      isComplete: true,
      debtPaymentAmount: 0,
      sourceId: params.sourceAccount.id,
      sourceType: params.sourceAccount.categoryType,
      sourceAmount: feeAmount,
      sourceCurrencyId: params.sourceAccount.currencyId,
      sourceName: params.sourceAccount.name,
      destinationId: params.debtAccount.id,
      destinationType: params.debtAccount.categoryType,
      destinationAmount: convertedAmount,
      destinationCurrencyId: params.debtAccount.currencyId,
      destinationName: params.debtAccount.name,
      comment: params.comment?.trim() || null,
      tags: params.tags ?? [],
    };
  }

  // Absorbed by user: Expense from payment account to feeExpenseCategory
  const targetCategory = params.feeExpenseCategory;
  return {
    id,
    deleted: false,
    dateTimestamp,
    dateTimestampISO,
    createdTimestamp: nowTicks,
    timestamp: nowTicks,
    isComplete: true,
    debtPaymentAmount: 0,
    sourceId: params.sourceAccount.id,
    sourceType: params.sourceAccount.categoryType,
    sourceAmount: feeAmount,
    sourceCurrencyId: params.sourceAccount.currencyId,
    sourceName: params.sourceAccount.name,
    destinationId: targetCategory?.id,
    destinationType: targetCategory?.categoryType ?? CategoryType.Expense,
    destinationAmount: convertedAmount,
    destinationCurrencyId: targetCategory?.currencyId ?? params.sourceAccount.currencyId,
    destinationName: targetCategory?.name ?? "Fees / Commissions",
    comment: params.comment?.trim() || null,
    tags: params.tags ?? [],
  };
}

export interface SettlementTransactionParams {
  id?: string;
  date?: Date | string;
  debtAccount: ExternalProviderCategory;
  destinationCategory: ExternalProviderCategory;
  deductedDebtAmount: number;
  settledAmount: number;
  comment?: string | null;
  tags?: string[];
}

export function buildSettlementTransaction(params: SettlementTransactionParams): ExternalProviderTransaction {
  const { dateTimestamp, dateTimestampISO } = normalizeTransactionDate(params.date);
  const nowTicks = toDotNetTicks();
  const id =
    params.id ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tx-${Date.now()}`);

  const deductedAmount = Math.abs(params.deductedDebtAmount);
  const settledAmount = Math.abs(params.settledAmount);

  return {
    id,
    deleted: false,
    dateTimestamp,
    dateTimestampISO,
    createdTimestamp: nowTicks,
    timestamp: nowTicks,
    isComplete: true,
    debtPaymentAmount: 0,
    sourceId: params.debtAccount.id,
    sourceType: params.debtAccount.categoryType,
    sourceAmount: deductedAmount,
    sourceCurrencyId: params.debtAccount.currencyId,
    sourceName: params.debtAccount.name,
    destinationId: params.destinationCategory.id,
    destinationType: params.destinationCategory.categoryType,
    destinationAmount: settledAmount,
    destinationCurrencyId: params.destinationCategory.currencyId ?? params.debtAccount.currencyId,
    destinationName: params.destinationCategory.name,
    comment: params.comment?.trim() || null,
    tags: params.tags ?? [],
  };
}

export interface FxReconciliationParams {
  id?: string;
  date?: Date | string;
  debtAccount: ExternalProviderCategory;
  balance: number;
  reconciliationCategory: ExternalProviderCategory;
  convertedAmount?: number;
  comment?: string | null;
  tags?: string[];
}

export function buildFxReconciliationTransaction(params: FxReconciliationParams): ExternalProviderTransaction | null {
  if (Math.abs(params.balance) < 0.005) {
    return null;
  }

  const { dateTimestamp, dateTimestampISO } = normalizeTransactionDate(params.date);
  const nowTicks = toDotNetTicks();
  const id =
    params.id ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tx-${Date.now()}`);

  if (params.balance > 0) {
    // Forgiven remainder / FX loss: Expense from debt account to reconciliationCategory
    const balanceAmount = Math.abs(params.balance);
    const converted = Math.abs(params.convertedAmount ?? balanceAmount);

    return {
      id,
      deleted: false,
      dateTimestamp,
      dateTimestampISO,
      createdTimestamp: nowTicks,
      timestamp: nowTicks,
      isComplete: true,
      debtPaymentAmount: 0,
      sourceId: params.debtAccount.id,
      sourceType: params.debtAccount.categoryType,
      sourceAmount: balanceAmount,
      sourceCurrencyId: params.debtAccount.currencyId,
      sourceName: params.debtAccount.name,
      destinationId: params.reconciliationCategory.id,
      destinationType: params.reconciliationCategory.categoryType ?? CategoryType.Expense,
      destinationAmount: converted,
      destinationCurrencyId: params.reconciliationCategory.currencyId ?? params.debtAccount.currencyId,
      destinationName: params.reconciliationCategory.name,
      comment: params.comment?.trim() || "FX loss remainder reconciliation",
      tags: params.tags ?? [],
    };
  }

  // FX gain / overpayment: Income from reconciliationCategory to debt account
  const gainAmount = Math.abs(params.balance);
  const converted = Math.abs(params.convertedAmount ?? gainAmount);

  return {
    id,
    deleted: false,
    dateTimestamp,
    dateTimestampISO,
    createdTimestamp: nowTicks,
    timestamp: nowTicks,
    isComplete: true,
    debtPaymentAmount: 0,
    sourceId: params.reconciliationCategory.id,
    sourceType: params.reconciliationCategory.categoryType ?? CategoryType.Income,
    sourceAmount: converted,
    sourceCurrencyId: params.reconciliationCategory.currencyId ?? params.debtAccount.currencyId,
    sourceName: params.reconciliationCategory.name,
    destinationId: params.debtAccount.id,
    destinationType: params.debtAccount.categoryType,
    destinationAmount: gainAmount,
    destinationCurrencyId: params.debtAccount.currencyId,
    destinationName: params.debtAccount.name,
    comment: params.comment?.trim() || "FX gain remainder reconciliation",
    tags: params.tags ?? [],
  };
}

/**
 * Unarchives an account category:
 * - Strips leading "_" prefix from name
 * - Places it as the last non-archived account (immediately preceding the first archived account)
 * - Re-indexes sequential integer orders (0, 1, 2, ...)
 * - Returns updated and modified categories
 */
export function unarchiveAccountCategory(
  allCategories: ExternalProviderCategory[],
  accountId: string,
): ReorderCategoriesResult {
  const target = allCategories.find((c) => c.id === accountId && !c.deleted && isAccountType(c.categoryType));
  if (!target) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const cleanName = target.name.replace(/^_+/, "").trim();
  const newName = cleanName.length > 0 ? cleanName : target.name;
  const updatedTarget: ExternalProviderCategory = { ...target, name: newName };

  const accounts = sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && isAccountType(c.categoryType)));

  const remaining = accounts.filter((c) => c.id !== accountId);
  const firstArchivedIdx = remaining.findIndex((c) => isArchivedCategoryName(c.name));
  const insertIdx = firstArchivedIdx === -1 ? remaining.length : firstArchivedIdx;

  const newGroup = [...remaining.slice(0, insertIdx), updatedTarget, ...remaining.slice(insertIdx)];

  return applyAccountGroupUpdates(allCategories, newGroup);
}

/**
 * Unarchives an income category:
 * - Strips leading "_" prefix from name
 * - Places it as the last non-archived income category (immediately preceding the first archived income category)
 * - Re-indexes sequential integer orders (0, 1, 2, ...)
 * - Returns updated and modified categories
 */
export function unarchiveIncomeCategory(
  allCategories: ExternalProviderCategory[],
  categoryId: string,
): ReorderCategoriesResult {
  const target = allCategories.find(
    (c) => c.id === categoryId && !c.deleted && Number(c.categoryType) === CategoryType.Income,
  );
  if (!target) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const cleanName = target.name.replace(/^_+/, "").trim();
  const newName = cleanName.length > 0 ? cleanName : target.name;
  const updatedTarget: ExternalProviderCategory = { ...target, name: newName };

  const incomeCategories = sortCategoriesByOrder(
    allCategories.filter((c) => !c.deleted && Number(c.categoryType) === CategoryType.Income),
  );

  const remaining = incomeCategories.filter((c) => c.id !== categoryId);
  const firstArchivedIdx = remaining.findIndex((c) => isArchivedCategoryName(c.name));
  const insertIdx = firstArchivedIdx === -1 ? remaining.length : firstArchivedIdx;

  const newGroup = [...remaining.slice(0, insertIdx), updatedTarget, ...remaining.slice(insertIdx)];

  return applyIncomeGroupUpdates(allCategories, newGroup);
}

/**
 * Finds all active (non-archived) accounts that are positioned below any archived account.
 */
export function findAccountsBelowArchived(allCategories: ExternalProviderCategory[]): ExternalProviderCategory[] {
  const accounts = sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && isAccountType(c.categoryType)));

  const firstArchivedIdx = accounts.findIndex((c) => isArchivedCategoryName(c.name));
  if (firstArchivedIdx === -1) {
    return [];
  }

  return accounts.slice(firstArchivedIdx + 1).filter((c) => !isArchivedCategoryName(c.name));
}

/**
 * Moves specified or all active accounts that are positioned below archived accounts
 * to immediately preceding the first archived account, preserving their relative order.
 */
export function moveAccountsAboveArchived(
  allCategories: ExternalProviderCategory[],
  accountIds?: string[],
): ReorderCategoriesResult {
  const accounts = sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && isAccountType(c.categoryType)));

  const firstArchivedIdx = accounts.findIndex((c) => isArchivedCategoryName(c.name));
  if (firstArchivedIdx === -1) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const accountsBelow = accounts.slice(firstArchivedIdx + 1).filter((c) => !isArchivedCategoryName(c.name));
  if (accountsBelow.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const targetIdSet = accountIds ? new Set(accountIds) : null;
  const toMove = targetIdSet ? accountsBelow.filter((c) => targetIdSet.has(c.id)) : accountsBelow;

  if (toMove.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const toMoveIdSet = new Set(toMove.map((c) => c.id));
  const remaining = accounts.filter((c) => !toMoveIdSet.has(c.id));
  const insertIdx = remaining.findIndex((c) => isArchivedCategoryName(c.name));
  const targetInsertIdx = insertIdx === -1 ? remaining.length : insertIdx;

  const newGroup = [...remaining.slice(0, targetInsertIdx), ...toMove, ...remaining.slice(targetInsertIdx)];

  return applyAccountGroupUpdates(allCategories, newGroup);
}

/**
 * Finds all active (non-archived) income sources that are positioned below any archived income source.
 */
export function findIncomeSourcesBelowArchived(allCategories: ExternalProviderCategory[]): ExternalProviderCategory[] {
  const sources = sortCategoriesByOrder(
    allCategories.filter((c) => !c.deleted && Number(c.categoryType) === CategoryType.Income),
  );

  const firstArchivedIdx = sources.findIndex((c) => isArchivedCategoryName(c.name));
  if (firstArchivedIdx === -1) {
    return [];
  }

  return sources.slice(firstArchivedIdx + 1).filter((c) => !isArchivedCategoryName(c.name));
}

/**
 * Moves specified or all active income sources that are positioned below archived income sources
 * to immediately preceding the first archived income source, preserving their relative order.
 */
export function moveIncomeSourcesAboveArchived(
  allCategories: ExternalProviderCategory[],
  sourceIds?: string[],
): ReorderCategoriesResult {
  const sources = sortCategoriesByOrder(
    allCategories.filter((c) => !c.deleted && Number(c.categoryType) === CategoryType.Income),
  );

  const firstArchivedIdx = sources.findIndex((c) => isArchivedCategoryName(c.name));
  if (firstArchivedIdx === -1) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const sourcesBelow = sources.slice(firstArchivedIdx + 1).filter((c) => !isArchivedCategoryName(c.name));
  if (sourcesBelow.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const targetIdSet = sourceIds ? new Set(sourceIds) : null;
  const toMove = targetIdSet ? sourcesBelow.filter((c) => targetIdSet.has(c.id)) : sourcesBelow;

  if (toMove.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const toMoveIdSet = new Set(toMove.map((c) => c.id));
  const remaining = sources.filter((c) => !toMoveIdSet.has(c.id));
  const insertIdx = remaining.findIndex((c) => isArchivedCategoryName(c.name));
  const targetInsertIdx = insertIdx === -1 ? remaining.length : insertIdx;

  const newGroup = [...remaining.slice(0, targetInsertIdx), ...toMove, ...remaining.slice(targetInsertIdx)];

  return applyIncomeGroupUpdates(allCategories, newGroup);
}

export interface ClassifiedAccount {
  account: ExternalProviderCategory;
  isArchived: boolean;
  isZeroBalance: boolean;
  hasUnreconciledBalance: boolean;
  balance: number;
}

/**
 * Filters, sorts, and classifies account-type categories.
 *
 * Accounts starting with "_" and having zero balance are hidden unless `showArchived` is true.
 * Accounts starting with "_" and having a non-zero balance remain ALWAYS visible and are flagged
 * with `hasUnreconciledBalance: true` so the user is guided to reconcile them.
 */
export function filterAndClassifyAccounts(
  categories: ExternalProviderCategory[],
  options?: { showArchived?: boolean },
): ClassifiedAccount[] {
  const showArchived = options?.showArchived ?? false;

  const accounts = categories.filter((c) => {
    if (c.deleted) return false;
    const t = Number(c.categoryType);
    return t === CategoryType.Account || t === CategoryType.BankAccount || t === CategoryType.DebtAccount;
  });

  const sorted = sortCategoriesByOrder(accounts);
  const classified: ClassifiedAccount[] = [];

  for (const account of sorted) {
    const isArchived = isArchivedCategoryName(account.name);
    const balance = Number(account.amount) || 0;
    const isZeroBalance = Math.abs(balance) < 0.005;
    const hasUnreconciledBalance = isArchived && !isZeroBalance;

    if (!isArchived || hasUnreconciledBalance || showArchived) {
      classified.push({
        account,
        isArchived,
        isZeroBalance,
        hasUnreconciledBalance,
        balance,
      });
    }
  }

  return classified;
}

export interface ClassifiedIncomeSource {
  source: ExternalProviderCategory;
  category: ExternalProviderCategory;
  isArchived: boolean;
}

/**
 * Filters, sorts, and classifies income sources (CategoryType.Income).
 * Non-archived sources are sorted in ascending order.
 * Archived sources (names starting with "_") are excluded unless `showArchived` is true.
 */
export function filterAndClassifyIncomeSources(
  categories: ExternalProviderCategory[],
  options?: { showArchived?: boolean },
): ClassifiedIncomeSource[] {
  const showArchived = options?.showArchived ?? false;

  const incomeCategories = categories.filter((c) => {
    if (c.deleted) return false;
    return Number(c.categoryType) === CategoryType.Income;
  });

  const sorted = sortCategoriesByOrder(incomeCategories);
  const classified: ClassifiedIncomeSource[] = [];

  for (const cat of sorted) {
    const isArchived = isArchivedCategoryName(cat.name);
    if (!isArchived || showArchived) {
      classified.push({
        source: cat,
        category: cat,
        isArchived,
      });
    }
  }

  return classified;
}

export interface ClassifiedCategory<T = ExternalProviderCategory> {
  item: T;
  isArchived: boolean;
  isActive: boolean;
}

/**
 * Classifies categories and filters inactive "_" prefixed items unless `showArchived` is true.
 */
export function filterAndClassifyCategories<T extends { name?: string; id?: string; current?: number; limit?: number }>(
  items: T[],
  options?: { showArchived?: boolean; isActive?: (item: T) => boolean },
): ClassifiedCategory<T>[] {
  const showArchived = options?.showArchived ?? false;
  const classified: ClassifiedCategory<T>[] = [];

  for (const item of items) {
    const isArchived = isArchivedCategoryName(item.name);
    const isActive = options?.isActive
      ? options.isActive(item)
      : (Number(item.current) || 0) > 0 || (Number(item.limit) || 0) > 0;

    if (!isArchived || isActive || showArchived) {
      classified.push({
        item,
        isArchived,
        isActive,
      });
    }
  }

  return classified;
}

export interface LastTransactionSummary {
  transactionId: string;
  dateTimestampISO?: string;
  dateTimestamp?: number;
  formattedDate: string;
  direction: "income" | "expense" | "transfer";
  counterpartLabel: "From" | "To";
  counterpartName: string;
  counterpartId?: string;
  amount: number;
  currency: string;
  comment: string | null;
  tags: string[];
}

/**
 * Extracts a direction-aware last transaction summary relative to a specific category.
 */
export function getLastTransactionSummaryForCategory(
  categoryId: string,
  tx: ExternalProviderTransaction,
  categoryById?: Map<string, ExternalProviderCategory>,
): LastTransactionSummary | null {
  if (!categoryId || !tx) return null;

  const isSource = tx.sourceId === categoryId;
  const isDest = tx.destinationId === categoryId;

  if (!isSource && !isDest) return null;

  let formattedDate = "Unknown date";
  if (tx.dateTimestampISO) {
    formattedDate = formatTransactionDate(tx.dateTimestampISO);
  } else if (tx.dateTimestamp) {
    try {
      formattedDate = format(new Date(tx.dateTimestamp), "MMM d, yyyy");
    } catch {
      formattedDate = "Unknown date";
    }
  }

  const comment = typeof tx.comment === "string" && tx.comment.trim().length > 0 ? tx.comment.trim() : null;
  const tags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string" && t.length > 0) : [];

  if (isSource) {
    // Money leaving categoryId -> destination is counterpart
    const destType = Number(tx.destinationType);
    const isTransfer =
      destType === CategoryType.Account ||
      destType === CategoryType.BankAccount ||
      destType === CategoryType.DebtAccount;

    const amount = Math.abs(Number(tx.sourceAmount ?? tx.defaultAmount) || 0);
    const currency = tx.sourceCurrencyId ?? "PLN";

    return {
      transactionId: tx.id,
      dateTimestampISO: tx.dateTimestampISO,
      dateTimestamp: tx.dateTimestamp,
      formattedDate,
      direction: isTransfer ? "transfer" : "expense",
      counterpartLabel: "To",
      counterpartName:
        tx.destinationName ?? (tx.destinationId ? categoryById?.get(tx.destinationId)?.name : undefined) ?? "Unknown",
      counterpartId: tx.destinationId,
      amount,
      currency,
      comment,
      tags,
    };
  }

  // Money arriving at categoryId (isDest) -> source is counterpart
  const destType = Number(tx.destinationType);
  const srcType = Number(tx.sourceType);

  const isDestExpense =
    destType === CategoryType.Expense || destType === CategoryType.Goal || destType === CategoryType.ClassicGoal;

  let direction: "income" | "expense" | "transfer";
  if (isDestExpense) {
    direction = "expense";
  } else if (srcType === CategoryType.Income) {
    direction = "income";
  } else if (
    srcType === CategoryType.Account ||
    srcType === CategoryType.BankAccount ||
    srcType === CategoryType.DebtAccount
  ) {
    direction = "transfer";
  } else {
    direction = "income";
  }

  const amount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
  const currency = tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? "PLN";

  return {
    transactionId: tx.id,
    dateTimestampISO: tx.dateTimestampISO,
    dateTimestamp: tx.dateTimestamp,
    formattedDate,
    direction,
    counterpartLabel: "From",
    counterpartName: tx.sourceName ?? (tx.sourceId ? categoryById?.get(tx.sourceId)?.name : undefined) ?? "Unknown",
    counterpartId: tx.sourceId,
    amount,
    currency,
    comment,
    tags,
  };
}

/**
 * Builds a fast lookup map from categoryId -> newest LastTransactionSummary across transactions.
 */
export function buildLastTransactionMap(
  transactions: ExternalProviderTransaction[],
  categories?: ExternalProviderCategory[],
): Map<string, LastTransactionSummary> {
  const categoryById = categories ? new Map(categories.map((c) => [c.id, c])) : undefined;
  const map = new Map<string, LastTransactionSummary>();
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return map;
  }

  const nonDeleted = transactions.filter((tx) => !tx.deleted);

  const sorted = [...nonDeleted].sort((a, b) => {
    const timeA = a.dateTimestamp ?? (a.dateTimestampISO ? Date.parse(a.dateTimestampISO) : 0) ?? 0;
    const timeB = b.dateTimestamp ?? (b.dateTimestampISO ? Date.parse(b.dateTimestampISO) : 0) ?? 0;
    return timeB - timeA;
  });

  for (const tx of sorted) {
    if (tx.sourceId && !map.has(tx.sourceId)) {
      const summary = getLastTransactionSummaryForCategory(tx.sourceId, tx, categoryById);
      if (summary) {
        map.set(tx.sourceId, summary);
      }
    }
    if (tx.destinationId && !map.has(tx.destinationId)) {
      const summary = getLastTransactionSummaryForCategory(tx.destinationId, tx, categoryById);
      if (summary) {
        map.set(tx.destinationId, summary);
      }
    }
  }

  return map;
}

export interface ExternalProviderCurrency {
  id: string;
  /** Units of this currency per 1 unit of the base currency (USD). */
  rate?: number;
  [key: string]: unknown;
}

/**
 * Converts an amount between currencies using ExternalProvider's `ExchangeKey.Currency` rates
 * (expressed as units of currency per 1 USD). Returns `null` when a required rate is unknown.
 */
export function convertCurrencyAmount(
  amount: number,
  fromCurrency: string | undefined,
  toCurrency: string | undefined,
  currencies: ExternalProviderCurrency[],
): number | null {
  const from = firstNonEmpty(fromCurrency)?.trim().toUpperCase();
  const to = firstNonEmpty(toCurrency)?.trim().toUpperCase();
  if (!from || !to || from === to) {
    return amount;
  }
  const rateOf = (code: string): number | null => {
    if (code === "USD") {
      const usd = currencies.find((c) => c.id?.toUpperCase() === "USD");
      return typeof usd?.rate === "number" && usd.rate > 0 ? usd.rate : 1;
    }
    const entry = currencies.find((c) => c.id?.toUpperCase() === code);
    return typeof entry?.rate === "number" && entry.rate > 0 ? entry.rate : null;
  };
  const fromRate = rateOf(from);
  const toRate = rateOf(to);
  if (fromRate === null || toRate === null) {
    return null;
  }
  return (amount / fromRate) * toRate;
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | undefined {
  return values.find((v): v is string => typeof v === "string" && v.length > 0);
}

export interface AccountLiquiditySummary {
  /** Net balance of liquid accounts converted into the default currency. */
  totalNetLiquid: number;
  /** Native-currency subtotals of all non-deleted accounts. */
  byCurrency: { currency: string; balance: number }[];
  /** Currencies lacking a rate (their balances are excluded from `totalNetLiquid`). */
  unconvertedCurrencies: string[];
  debtBalance: number;
  unreconciledCount: number;
}

/**
 * Aggregates account balances: converted net liquid total (excluding `exceptFromBalance` accounts),
 * per-currency native subtotals, debt total and count of unreconciled archived accounts.
 */
export function computeAccountLiquiditySummary(
  categories: ExternalProviderCategory[],
  currencies: ExternalProviderCurrency[],
  defaultCurrency: string,
): AccountLiquiditySummary {
  const byCurrencyMap = new Map<string, number>();
  const unconverted = new Set<string>();
  let totalNetLiquid = 0;
  let debtBalance = 0;
  let unreconciledCount = 0;

  for (const account of categories) {
    if (account.deleted || !isAccountType(account.categoryType)) continue;
    const balance = Number(account.amount) || 0;
    const currency = (firstNonEmpty(account.currencyId, defaultCurrency) ?? defaultCurrency).toUpperCase();

    byCurrencyMap.set(currency, (byCurrencyMap.get(currency) ?? 0) + balance);

    if (Number(account.categoryType) === CategoryType.DebtAccount) {
      const converted = convertCurrencyAmount(balance, currency, defaultCurrency, currencies);
      debtBalance += converted ?? 0;
    }
    if (isArchivedCategoryName(account.name) && Math.abs(balance) >= 0.005) {
      unreconciledCount += 1;
    }
    if (account.exceptFromBalance) continue;

    const converted = convertCurrencyAmount(balance, currency, defaultCurrency, currencies);
    if (converted === null) {
      unconverted.add(currency);
    } else {
      totalNetLiquid += converted;
    }
  }

  const byCurrency = [...byCurrencyMap.entries()]
    .map(([currency, balance]) => ({ currency, balance }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    totalNetLiquid,
    byCurrency,
    unconvertedCurrencies: [...unconverted],
    debtBalance,
    unreconciledCount,
  };
}

export interface ResolvedTransactionEndpoints {
  sourceName: string;
  destinationName: string;
  sourceType?: number;
  destinationType?: number;
  sourceCurrency: string;
  destinationCurrency: string;
  isSourceAccount: boolean;
  isDestinationAccount: boolean;
}

/**
 * Resolves source/target names, types and currencies of a transaction from the categories lookup
 * whenever the raw payload omits them.
 */
export function resolveTransactionEndpoints(
  tx: ExternalProviderTransaction,
  categoryById: Map<string, ExternalProviderCategory>,
  defaultCurrency: string,
): ResolvedTransactionEndpoints {
  const sourceCategory = tx.sourceId ? categoryById.get(tx.sourceId) : undefined;
  const destCategory = tx.destinationId ? categoryById.get(tx.destinationId) : undefined;

  const sourceType = tx.sourceType ?? sourceCategory?.categoryType;
  const destinationType = tx.destinationType ?? destCategory?.categoryType;

  return {
    sourceName: firstNonEmpty(tx.sourceName, sourceCategory?.name) ?? "Unknown Source",
    destinationName: firstNonEmpty(tx.destinationName, destCategory?.name) ?? "Unknown Target",
    sourceType: sourceType === undefined ? undefined : Number(sourceType),
    destinationType: destinationType === undefined ? undefined : Number(destinationType),
    sourceCurrency: firstNonEmpty(tx.sourceCurrencyId, sourceCategory?.currencyId, defaultCurrency) ?? defaultCurrency,
    destinationCurrency:
      firstNonEmpty(tx.destinationCurrencyId, destCategory?.currencyId, defaultCurrency) ?? defaultCurrency,
    isSourceAccount: isAccountType(sourceType),
    isDestinationAccount: isAccountType(destinationType),
  };
}

export interface TransactionWithBalance {
  tx: ExternalProviderTransaction;
  endpoints: ResolvedTransactionEndpoints;
  direction: "income" | "expense" | "transfer";
  /** Absolute amount leaving the source (in source currency). */
  sourceAmount: number;
  /** Absolute amount arriving at the destination (in destination currency). */
  destinationAmount: number;
  /** Balance of the source account right after the transaction (only if source is a known account). */
  sourceBalanceAfter?: number;
  /** Balance of the destination account right after the transaction (only if destination is a known account). */
  destinationBalanceAfter?: number;
}

function transactionTime(tx: ExternalProviderTransaction): number {
  if (typeof tx.dateTimestamp === "number") return tx.dateTimestamp;
  if (tx.dateTimestampISO) {
    const parsed = Date.parse(tx.dateTimestampISO);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Walks the newest-first transaction stream backwards from each account's live balance to compute
 * the balance of the involved account(s) immediately after each transaction.
 */
export function computeTransactionsWithRunningBalance(
  transactions: ExternalProviderTransaction[],
  categories: ExternalProviderCategory[],
  defaultCurrency: string,
): TransactionWithBalance[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const balances = new Map<string, number>();
  for (const c of categories) {
    if (!c.deleted && isAccountType(c.categoryType)) {
      balances.set(c.id, Number(c.currentAmount ?? c.amount) || 0);
    }
  }

  const sorted = transactions
    .map((tx, index) => ({ tx, index }))
    .filter(({ tx }) => !tx.deleted)
    .sort((a, b) => transactionTime(b.tx) - transactionTime(a.tx) || a.index - b.index)
    .map(({ tx }) => tx);

  return sorted.map((tx) => {
    const endpoints = resolveTransactionEndpoints(tx, categoryById, defaultCurrency);
    const sourceAmount = Math.abs(Number(tx.sourceAmount ?? tx.defaultAmount) || 0);
    const destinationAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);

    let direction: TransactionWithBalance["direction"];
    if (endpoints.isSourceAccount && endpoints.isDestinationAccount) {
      direction = "transfer";
    } else if (endpoints.isDestinationAccount) {
      direction = "income";
    } else {
      direction = "expense";
    }

    const result: TransactionWithBalance = { tx, endpoints, direction, sourceAmount, destinationAmount };

    if (tx.sourceId && balances.has(tx.sourceId)) {
      const current = balances.get(tx.sourceId) ?? 0;
      result.sourceBalanceAfter = current;
      balances.set(tx.sourceId, current + sourceAmount);
    }
    if (tx.destinationId && balances.has(tx.destinationId)) {
      const current = balances.get(tx.destinationId) ?? 0;
      result.destinationBalanceAfter = current;
      balances.set(tx.destinationId, current - destinationAmount);
    }
    return result;
  });
}
