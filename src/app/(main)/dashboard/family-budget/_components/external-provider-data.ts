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
  currentAmount?: number;
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

/**
 * Resolves the live account balance from a ExternalProvider category entity.
 * Prioritizes `amount` over `currentAmount` because upstream ExternalProvider servers
 * populate `currentAmount: 0.0` while placing the actual account balance in `amount`.
 */
export function getAccountBalance(account: ExternalProviderCategory | null | undefined): number {
  if (!account) return 0;
  const raw = account.amount ?? account.currentAmount;
  return Number(raw) || 0;
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
  const groupCategories = sortCategoriesByOrder(
    allCategories.filter((c) => (!c.deleted || visibleIdSet.has(c.id)) && activeFilter(c)),
  );

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
    if ((!allCategories[i].deleted || visibleIdSet.has(allCategories[i].id)) && activeFilter(allCategories[i])) {
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
  options?: { includeDeleted?: boolean },
): ReorderCategoriesResult {
  const includeDeleted = options?.includeDeleted ?? false;
  const groupIndices: number[] = [];
  for (let i = 0; i < allCategories.length; i++) {
    const c = allCategories[i];
    if ((includeDeleted || !c.deleted) && groupPredicate(c)) {
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
    const balance = getAccountBalance(account);
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
  normalizedAmount: number;
  originalAmount?: number;
  originalCurrency?: string;
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
  defaultCurrency = "PLN",
  currencies: ExternalProviderCurrency[] = [],
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
    const destCategory = tx.destinationId ? categoryById?.get(tx.destinationId) : undefined;
    const sourceCategory = categoryById?.get(categoryId);
    const destType = Number(tx.destinationType ?? destCategory?.categoryType);
    const isTransfer =
      destType === CategoryType.Account ||
      destType === CategoryType.BankAccount ||
      destType === CategoryType.DebtAccount;

    const sourceCurrency = tx.sourceCurrencyId ?? sourceCategory?.currencyId;
    const destCurrency = tx.destinationCurrencyId ?? destCategory?.currencyId;

    let currency = defaultCurrency;
    let amount = 0;

    if (sourceCurrency && sourceCurrency !== defaultCurrency) {
      currency = sourceCurrency;
      amount = Math.abs(Number(tx.sourceAmount ?? tx.destinationAmount ?? tx.defaultAmount) || 0);
    } else if (destCurrency && destCurrency !== defaultCurrency) {
      currency = destCurrency;
      amount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
    } else {
      currency = sourceCurrency ?? destCurrency ?? "PLN";
      amount = Math.abs(Number(tx.sourceAmount ?? tx.destinationAmount ?? tx.defaultAmount) || 0);
    }

    const converted = convertCurrencyAmount(amount, currency, defaultCurrency, currencies);
    const normalizedAmount = converted ?? amount;

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
      normalizedAmount,
      originalAmount: amount,
      originalCurrency: currency,
      comment,
      tags,
    };
  }

  // Money arriving at categoryId (isDest) -> source is counterpart
  const counterpartCategory = tx.sourceId ? categoryById?.get(tx.sourceId) : undefined;
  const destCategory = categoryById?.get(categoryId);

  const destType = Number(tx.destinationType ?? destCategory?.categoryType);
  const srcType = Number(tx.sourceType ?? counterpartCategory?.categoryType);

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

  const sourceCurrency = tx.sourceCurrencyId ?? counterpartCategory?.currencyId;
  const destCurrency = tx.destinationCurrencyId ?? destCategory?.currencyId;

  let currency = defaultCurrency;
  let amount = 0;

  if (sourceCurrency && sourceCurrency !== defaultCurrency) {
    currency = sourceCurrency;
    amount = Math.abs(Number(tx.sourceAmount ?? tx.destinationAmount ?? tx.defaultAmount) || 0);
  } else if (destCurrency && destCurrency !== defaultCurrency) {
    currency = destCurrency;
    amount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
  } else {
    currency = destCurrency ?? sourceCurrency ?? "PLN";
    amount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
  }

  const converted = convertCurrencyAmount(amount, currency, defaultCurrency, currencies);
  const normalizedAmount = converted ?? amount;

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
    normalizedAmount,
    originalAmount: amount,
    originalCurrency: currency,
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
  defaultCurrency = "PLN",
  currencies: ExternalProviderCurrency[] = [],
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
      const summary = getLastTransactionSummaryForCategory(tx.sourceId, tx, categoryById, defaultCurrency, currencies);
      if (summary) {
        map.set(tx.sourceId, summary);
      }
    }
    if (tx.destinationId && !map.has(tx.destinationId)) {
      const summary = getLastTransactionSummaryForCategory(
        tx.destinationId,
        tx,
        categoryById,
        defaultCurrency,
        currencies,
      );
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
    const balance = getAccountBalance(account);
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
      balances.set(c.id, getAccountBalance(c));
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

// ---------------------------------------------------------------------------
// Category Normalization & Smart Grouping Utilities
// ---------------------------------------------------------------------------

export const KNOWN_FOREIGN_CURRENCY_CODES = ["UAH", "EUR", "USD", "GBP", "CZK", "CHF"] as const;

export const LOCALIZED_CATEGORY_DICTIONARY: Record<string, string> = {
  ліки: "Medicine",
  продукти: "Groceries",
  кафе: "Cafes & Restaurants",
  транспорт: "Transport",
  таксі: "Taxi",
  оренда: "Rent",
  розваги: "Entertainment",
  комуналка: "Utilities",
  "здоров'я": "Health",
  здоровя: "Health",
  одяг: "Clothes",
  спорт: "Sport",
  подорожі: "Travel",
  діти: "Kids",
  авто: "Car",
  подарунки: "Gifts",
  "зв'язок": "Mobile & Internet",
  звязок: "Mobile & Internet",
  ресторани: "Restaurants",
  їжа: "Food",
  дім: "Home",
  побут: "Household",
  навчання: "Learning",
  освіта: "Education",
  зарплата: "Salary",
};

export const RENAME_TAGS = {
  STRIP_PLN: "[Strip PLN]",
  TRANSLATE_UA: "[Translate UA]",
  ADD_UAH: "[Add UAH]",
} as const;

export function getStripCurrencyTag(currency = "PLN"): string {
  return `[Strip ${currency.toUpperCase()}]`;
}

export function getAddCurrencyTag(currency = "UAH"): string {
  return `[Add ${currency.toUpperCase()}]`;
}

export function isCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function parseExternalProviderTimestamp(timestamp?: number | null): Date | null {
  if (typeof timestamp !== "number" || Number.isNaN(timestamp) || timestamp <= 0) return null;
  // .NET ticks (typically ~6.3e17)
  if (timestamp > 1e16) {
    const epochTicks = BigInt("621355968000000000");
    const millis = (BigInt(Math.trunc(timestamp)) - epochTicks) / BigInt(10000);
    return new Date(Number(millis));
  }
  // Unix milliseconds (~1.6e12)
  if (timestamp > 1e11) {
    return new Date(timestamp);
  }
  // Unix seconds (~1.6e9)
  return new Date(timestamp * 1000);
}

export function isPre2022Timestamp(timestamp?: number | null): boolean {
  if (typeof timestamp !== "number" || Number.isNaN(timestamp) || timestamp <= 0) return false;
  const date = parseExternalProviderTimestamp(timestamp);
  if (!date || Number.isNaN(date.getTime())) return false;
  return date.getUTCFullYear() < 2022;
}

export function splitArchivePrefix(name: string): { prefix: string; stem: string } {
  const trimmed = name.trim();
  const match = /^_+/.exec(trimmed);
  const prefix = match ? match[0] : "";
  return { prefix, stem: trimmed.slice(prefix.length).trim() };
}

export interface ResolveCategoryCurrencyOptions {
  defaultCurrency?: string;
  transactions?: ExternalProviderTransaction[];
  hasModernDefaultCounterpart?: boolean;
}

/**
 * Resolves a category's effective currency denomination hierarchically:
 * 1. cat.currencyId (trimmed and uppercased) if present and non-empty.
 * 2. Trailing currency suffix in cat.name matching known default or foreign currency regex.
 * 3. Transaction currency history for this category or pre-2022 timestamp ("UAH").
 * 4. Fallback to defaultCurrency ("PLN").
 */
export function resolveCategoryCurrency(cat: ExternalProviderCategory, options?: ResolveCategoryCurrencyOptions): string {
  const defaultUpper = (options?.defaultCurrency ?? "PLN").trim().toUpperCase();

  // 1. cat.currencyId (trimmed and uppercased) if present and non-empty.
  if (typeof cat.currencyId === "string" && cat.currencyId.trim().length > 0) {
    return cat.currencyId.trim().toUpperCase();
  }

  // 2. Trailing currency suffix in cat.name matching known default or foreign currency regex.
  const { stem } = splitArchivePrefix(cat.name);
  const suffixCodes = [defaultUpper, ...KNOWN_FOREIGN_CURRENCY_CODES];
  const suffixRegex = new RegExp(`(?:\\s+|\\s*\\()(${suffixCodes.join("|")})\\)?$`, "i");
  const match = suffixRegex.exec(stem.trim());
  if (match) {
    return match[1].toUpperCase();
  }

  // 3. Transaction currency history for this category, pre-2022 timestamp, or Ukrainian Cyrillic ("UAH").
  if (isCyrillic(stem) || isPre2022Timestamp(cat.createdTimestamp) || options?.hasModernDefaultCounterpart) {
    return "UAH";
  }

  if (options?.transactions) {
    for (const tx of options.transactions) {
      if (tx.deleted) continue;
      if (tx.destinationId === cat.id || tx.sourceId === cat.id) {
        const date = parseExternalProviderTimestamp(tx.dateTimestamp);
        const rawCurr =
          typeof tx.currency === "string" ? tx.currency : (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? "");
        const curr = String(rawCurr).trim().toUpperCase();
        if (curr === "UAH" || (date && date.getUTCFullYear() < 2022)) {
          return "UAH";
        }
        if (curr && curr.length === 3) {
          return curr;
        }
      }
    }
  }

  // 4. Fallback to defaultCurrency ("PLN").
  return defaultUpper;
}

/**
 * Extracts a canonical base name by stripping trailing currency codes (default or foreign)
 * and translating known Ukrainian Cyrillic labels to standardized English names.
 */
export function extractCanonicalBaseName(name: string, defaultCurrency = "PLN"): string {
  const trimmed = name.trim();
  const defaultUpper = defaultCurrency.toUpperCase();

  // Strip trailing default currency (e.g. "Medicine PLN" or "Medicine (PLN)" -> "Medicine")
  const defaultSuffixRegex = new RegExp(`(?:\\s+|\\s*\\()${defaultUpper}\\)?$`, "i");
  let cleaned = trimmed.replace(defaultSuffixRegex, "").trim();

  // Strip trailing foreign currency (e.g. "Medicine UAH" or "Medicine (UAH)" -> "Medicine")
  const foreignSuffixRegex = new RegExp(`(?:\\s+|\\s*\\()(${KNOWN_FOREIGN_CURRENCY_CODES.join("|")})\\)?$`, "i");
  cleaned = cleaned.replace(foreignSuffixRegex, "").trim();

  // Check dictionary for Ukrainian/Cyrillic translation
  const lower = cleaned.toLowerCase();
  if (LOCALIZED_CATEGORY_DICTIONARY[lower]) {
    return LOCALIZED_CATEGORY_DICTIONARY[lower];
  }
  return cleaned;
}

export type CategoryNormalizationScope = "expense" | "income";

export function isExpenseCategory(c: ExternalProviderCategory): boolean {
  const t = Number(c.categoryType);
  return t === CategoryType.Expense || t === CategoryType.Goal || t === CategoryType.ClassicGoal;
}

export function isIncomeCategory(c: ExternalProviderCategory): boolean {
  return Number(c.categoryType) === CategoryType.Income;
}

export function isInNormalizationScope(
  c: ExternalProviderCategory,
  scope: CategoryNormalizationScope,
  options?: { includeDeleted?: boolean },
): boolean {
  if (c.deleted && !options?.includeDeleted) return false;
  return scope === "income" ? isIncomeCategory(c) : isExpenseCategory(c);
}

export interface ProposedCategoryRename {
  id: string;
  category: ExternalProviderCategory;
  currentName: string;
  proposedName: string;
  tags: string[];
  reason?: string;
  isCollision?: boolean;
  /** 1 = vacates a canonical base name (or independent), 2 = claims a canonical base name. */
  stepOrder: 1 | 2;
  /** Lowercase canonical base name this rename vacates. */
  vacatesBaseName?: string;
  /** Lowercase canonical base name this rename claims. */
  claimsBaseName?: string;
  /** IDs of categories (also being renamed) that currently occupy the name this rename claims. */
  dependsOnCategoryIds: string[];
}

export interface GenerateProposedRenamesOptions {
  defaultCurrency?: string;
  transactions?: ExternalProviderTransaction[];
  scope?: CategoryNormalizationScope;
  includeDeleted?: boolean;
}

/**
 * Scans categories and generates proposed standardized renames following the Clean Default convention:
 * 1. Default currency suffix (e.g. " PLN") stripped.
 * 2. Ukrainian categories translated and tagged with " UAH".
 * 3. Legacy pre-2022 categories without currency tag appended with " UAH".
 * Strictly partitioned by `options.scope` (default `"expense"`), preserving leading `_` archive prefixes.
 * Performs collision checking within the scope and annotates coupled rename chains with `stepOrder`.
 */
export function generateProposedCategoryRenames(
  categories: ExternalProviderCategory[],
  options?: GenerateProposedRenamesOptions,
): ProposedCategoryRename[] {
  const defaultCurrency = (options?.defaultCurrency ?? "PLN").toUpperCase();
  const scope = options?.scope ?? "expense";
  const includeDeleted = options?.includeDeleted ?? false;
  const stripTag = defaultCurrency === "PLN" ? RENAME_TAGS.STRIP_PLN : getStripCurrencyTag(defaultCurrency);

  const scopeCategories = categories.filter((c) => isInNormalizationScope(c, scope, { includeDeleted }));
  const candidateCategories = scopeCategories;

  const defaultSuffixRegex = new RegExp(`(?:\\s+|\\s*\\()${defaultCurrency}\\)?$`, "i");
  const foreignSuffixRegex = new RegExp(`(?:\\s+|\\s*\\()(${KNOWN_FOREIGN_CURRENCY_CODES.join("|")})\\)?$`, "i");

  // Identify categories that have explicit transactions in UAH or pre-2022
  const uahCategoryIds = new Set<string>();
  if (options?.transactions) {
    for (const tx of options.transactions) {
      if (tx.deleted) continue;
      const catId = tx.destinationId ?? tx.sourceId;
      if (!catId) continue;
      const rawCurr =
        typeof tx.currency === "string" ? tx.currency : (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? "");
      const curr = String(rawCurr).toUpperCase();
      const date = parseExternalProviderTimestamp(tx.dateTimestamp);
      if (curr === "UAH" || (date && date.getUTCFullYear() < 2022)) {
        uahCategoryIds.add(catId);
      }
    }
  }

  // Find all (archive-prefix-agnostic) stems that have a "${name} ${defaultCurrency}" counterpart
  const baseNamesWithDefaultSuffix = new Set<string>();
  for (const cat of candidateCategories) {
    const { stem } = splitArchivePrefix(cat.name);
    if (defaultSuffixRegex.test(stem)) {
      const base = stem.replace(defaultSuffixRegex, "").trim().toLowerCase();
      if (base) {
        baseNamesWithDefaultSuffix.add(base);
      }
    }
  }

  const rawProposed: ProposedCategoryRename[] = [];

  for (const cat of candidateCategories) {
    const rawName = cat.name.trim();
    const { prefix, stem } = splitArchivePrefix(rawName);
    const tags: string[] = [];
    let proposedStem = stem;
    const reasons: string[] = [];

    const endsWithDefault = defaultSuffixRegex.test(stem);
    const endsWithForeign = foreignSuffixRegex.test(stem);
    const hasCyrillic = isCyrillic(stem);
    const isPre2022 = isPre2022Timestamp(cat.createdTimestamp) || uahCategoryIds.has(cat.id);
    const hasModernDefaultCounterpart = baseNamesWithDefaultSuffix.has(stem.toLowerCase());

    const catCurrency = resolveCategoryCurrency(cat, {
      defaultCurrency,
      transactions: options?.transactions,
      hasModernDefaultCounterpart,
    });

    if (endsWithDefault) {
      proposedStem = stem.replace(defaultSuffixRegex, "").trim();
      tags.push(stripTag);
      reasons.push(`Strip default ${defaultCurrency} suffix`);
    } else if (hasCyrillic) {
      const cleaned = stem.replace(foreignSuffixRegex, "").replace(defaultSuffixRegex, "").trim();
      const translated = LOCALIZED_CATEGORY_DICTIONARY[cleaned.toLowerCase()] ?? cleaned;
      tags.push(RENAME_TAGS.TRANSLATE_UA);

      if (catCurrency === defaultCurrency) {
        proposedStem = translated;
        reasons.push("Translate Ukrainian category");
      } else {
        const endsWithCatCurrency = new RegExp(`(?:\\s+|\\s*\\()${catCurrency}\\)?$`, "i").test(stem);
        proposedStem = `${translated} ${catCurrency}`;
        if (endsWithCatCurrency) {
          reasons.push(`Translate Ukrainian category and preserve ${catCurrency} suffix`);
        } else {
          tags.push(getAddCurrencyTag(catCurrency));
          reasons.push(`Translate Ukrainian category and add ${catCurrency} suffix`);
        }
      }
    } else if (!endsWithForeign && catCurrency !== defaultCurrency) {
      proposedStem = `${stem} ${catCurrency}`;
      tags.push(getAddCurrencyTag(catCurrency));
      if (catCurrency === "UAH" && (isPre2022 || hasModernDefaultCounterpart)) {
        reasons.push("Add UAH suffix to legacy pre-2022 category");
      } else {
        reasons.push(`Add ${catCurrency} suffix to non-default currency category`);
      }
    }

    if (proposedStem !== stem && tags.length > 0) {
      const currentLower = stem.toLowerCase();
      const proposedLower = proposedStem.toLowerCase();
      const base = extractCanonicalBaseName(stem, defaultCurrency).toLowerCase();
      const vacates = currentLower === base && proposedLower !== base;
      const claims = proposedLower === base && currentLower !== base;
      rawProposed.push({
        id: cat.id,
        category: cat,
        currentName: rawName,
        proposedName: `${prefix}${proposedStem}`,
        tags,
        reason: reasons.join("; "),
        stepOrder: claims ? 2 : 1,
        ...(vacates ? { vacatesBaseName: base } : {}),
        ...(claims ? { claimsBaseName: proposedLower } : {}),
        dependsOnCategoryIds: [],
      });
    }
  }

  // Dependencies: a claiming rename depends on any renaming category currently occupying its target name.
  const renamingById = new Map(rawProposed.map((r) => [r.id, r]));
  for (const item of rawProposed) {
    if (item.stepOrder !== 2) continue;
    const targetKey = item.proposedName.toLowerCase();
    item.dependsOnCategoryIds = scopeCategories
      .filter((c) => c.id !== item.id && renamingById.has(c.id) && c.name.trim().toLowerCase() === targetKey)
      .map((c) => c.id);
  }

  // Collision detection (scoped): duplicate proposals or an unchanged category already using the target name
  const proposedCounts = new Map<string, number>();
  for (const item of rawProposed) {
    const key = item.proposedName.toLowerCase();
    proposedCounts.set(key, (proposedCounts.get(key) ?? 0) + 1);
  }

  const unchangedNames = new Set(
    scopeCategories.filter((c) => !renamingById.has(c.id)).map((c) => c.name.trim().toLowerCase()),
  );

  for (const item of rawProposed) {
    const key = item.proposedName.toLowerCase();
    if ((proposedCounts.get(key) ?? 0) > 1 || unchangedNames.has(key)) {
      item.isCollision = true;
    }
  }

  return rawProposed;
}

export type CategoryCurrencyTier = "primary" | "foreign" | "archived";

export function getCategoryCurrencyTier(name: string, defaultCurrency = "PLN"): CategoryCurrencyTier {
  const { prefix, stem } = splitArchivePrefix(name);
  if (prefix.length > 0) return "archived";
  return isForeignCurrencyCategoryName(stem, defaultCurrency) ? "foreign" : "primary";
}

export function isForeignCurrencyCategoryName(name: string, defaultCurrency = "PLN"): boolean {
  const { stem } = splitArchivePrefix(name);
  const defaultUpper = defaultCurrency.toUpperCase();
  const codes = KNOWN_FOREIGN_CURRENCY_CODES.filter((c) => c !== defaultUpper);
  if (codes.length === 0) return false;
  return new RegExp(`(?:\\s+|\\s*\\()(${codes.join("|")})\\)?$`, "i").test(stem);
}

export interface CategoryImpactRow {
  id: string;
  category: ExternalProviderCategory;
  name: string;
  order: number;
  tier: CategoryCurrencyTier;
  rename?: ProposedCategoryRename;
}

export interface ConceptRenameGroup {
  baseName: string;
  members: CategoryImpactRow[];
  /** True when at least one member claims a base name occupied by another renaming member. */
  isCoupled: boolean;
}

export interface CategoryNormalizationPlan {
  scope: CategoryNormalizationScope;
  renames: ProposedCategoryRename[];
  rows: CategoryImpactRow[];
  groups: ConceptRenameGroup[];
}

/**
 * Full-audit builder: every category in the scope (changed and unchanged) with ExternalProvider `#order`,
 * currency tier and proposed rename, plus Concept Rename Groups (categories sharing a canonical base name
 * where at least one is being renamed).
 */
export function buildCategoryNormalizationPlan(
  categories: ExternalProviderCategory[],
  options?: GenerateProposedRenamesOptions,
): CategoryNormalizationPlan {
  const scope = options?.scope ?? "expense";
  const defaultCurrency = options?.defaultCurrency ?? "PLN";
  const renames = generateProposedCategoryRenames(categories, options);
  const renameById = new Map(renames.map((r) => [r.id, r]));

  const rows: CategoryImpactRow[] = sortCategoriesByOrder(
    categories.filter((c) => isInNormalizationScope(c, scope, { includeDeleted: options?.includeDeleted })),
  ).map((c, idx) => ({
    id: c.id,
    category: c,
    name: c.name.trim(),
    order: typeof c.order === "number" ? c.order : idx,
    tier: getCategoryCurrencyTier(c.name, defaultCurrency),
    rename: renameById.get(c.id),
  }));

  const byBase = new Map<string, CategoryImpactRow[]>();
  for (const row of rows) {
    const key = extractCanonicalBaseName(splitArchivePrefix(row.name).stem, defaultCurrency).toLowerCase();
    const list = byBase.get(key) ?? [];
    list.push(row);
    byBase.set(key, list);
  }

  const groups: ConceptRenameGroup[] = [];
  for (const [baseName, members] of byBase) {
    if (members.length < 2 || !members.some((m) => m.rename)) continue;
    const isCoupled = members.some((m) => m.rename && m.rename.dependsOnCategoryIds.length > 0);
    groups.push({ baseName, members, isCoupled });
  }

  return { scope, renames, rows, groups };
}

export interface CategoryRenameEvalItem {
  id: string;
  currentName: string;
  editedName: string;
  selected: boolean;
  dependsOnCategoryIds?: string[];
}

export interface CategoryRenameEvaluation {
  status: "ok" | "collision" | "broken-chain";
  message?: string;
  conflictingCategoryId?: string;
}

/**
 * Reactive collision / dependency evaluator. Computes every scope category's effective post-apply name
 * (selected item -> edited name, otherwise current name) and flags selected items whose target name is
 * already taken, distinguishing a broken coupled chain (unchecked prerequisite) from a plain collision.
 */
export function evaluateCategoryRenameState(
  allScopeCategories: ExternalProviderCategory[],
  items: CategoryRenameEvalItem[],
): Record<string, CategoryRenameEvaluation> {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const effective = allScopeCategories
    .filter((c) => !c.deleted)
    .map((c) => {
      const item = itemById.get(c.id);
      const name = item?.selected ? item.editedName.trim() : c.name.trim();
      return { category: c, item, name, key: name.toLowerCase() };
    });

  const result: Record<string, CategoryRenameEvaluation> = {};
  for (const item of items) {
    if (!item.selected) {
      result[item.id] = { status: "ok" };
      continue;
    }
    const key = item.editedName.trim().toLowerCase();
    if (!key) {
      result[item.id] = { status: "ok" };
      continue;
    }
    const other = effective.find((e) => e.category.id !== item.id && e.key === key);
    if (!other) {
      result[item.id] = { status: "ok" };
      continue;
    }
    const order = typeof other.category.order === "number" ? `#${other.category.order} ` : "";
    if (other.item && !other.item.selected && item.dependsOnCategoryIds?.includes(other.category.id)) {
      result[item.id] = {
        status: "broken-chain",
        conflictingCategoryId: other.category.id,
        message: `Blocked: ${order}'${other.category.name.trim()}' is unchecked and still occupies '${item.editedName.trim()}'. Check it or edit the target name.`,
      };
    } else {
      const detail = other.item?.selected ? `(proposed from '${other.category.name.trim()}')` : "(unchanged)";
      result[item.id] = {
        status: "collision",
        conflictingCategoryId: other.category.id,
        message: `Collides with ${order}'${other.name}' ${detail}`,
      };
    }
  }
  return result;
}

/** Sorts renames topologically: step 1 (vacate) before step 2 (claim), tie-broken by ExternalProvider order. */
export function sortRenamesTopologically<T extends { stepOrder?: number; category?: { order?: number } }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const step = (a.stepOrder ?? 1) - (b.stepOrder ?? 1);
    if (step !== 0) return step;
    return (a.category?.order ?? 0) - (b.category?.order ?? 0);
  });
}

// ---------------------------------------------------------------------------
// Expense category lifecycle & ExternalProvider order management
// ---------------------------------------------------------------------------

function sortedActiveExpenseCategories(allCategories: ExternalProviderCategory[]): ExternalProviderCategory[] {
  return sortCategoriesByOrder(allCategories.filter((c) => !c.deleted && isExpenseCategory(c)));
}

function applyExpenseGroupUpdates(
  allCategories: ExternalProviderCategory[],
  newGroup: ExternalProviderCategory[],
): ReorderCategoriesResult {
  return applyCategoryGroupUpdates(allCategories, newGroup, isExpenseCategory);
}

export function archiveExpenseCategory(
  allCategories: ExternalProviderCategory[],
  categoryId: string,
): ReorderCategoriesResult {
  const target = allCategories.find((c) => c.id === categoryId && !c.deleted && isExpenseCategory(c));
  if (!target) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }
  const cleanName = target.name.replace(/^_+/, "").trim();
  const updatedTarget: ExternalProviderCategory = { ...target, name: cleanName.length > 0 ? `_${cleanName}` : "_" };
  const remaining = sortedActiveExpenseCategories(allCategories).filter((c) => c.id !== categoryId);
  return applyExpenseGroupUpdates(allCategories, [...remaining, updatedTarget]);
}

export function unarchiveExpenseCategory(
  allCategories: ExternalProviderCategory[],
  categoryId: string,
): ReorderCategoriesResult {
  const target = allCategories.find((c) => c.id === categoryId && !c.deleted && isExpenseCategory(c));
  if (!target) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }
  const cleanName = target.name.replace(/^_+/, "").trim();
  const updatedTarget: ExternalProviderCategory = { ...target, name: cleanName.length > 0 ? cleanName : target.name };
  const remaining = sortedActiveExpenseCategories(allCategories).filter((c) => c.id !== categoryId);
  const firstArchivedIdx = remaining.findIndex((c) => isArchivedCategoryName(c.name));
  const insertIdx = firstArchivedIdx === -1 ? remaining.length : firstArchivedIdx;
  return applyExpenseGroupUpdates(allCategories, [
    ...remaining.slice(0, insertIdx),
    updatedTarget,
    ...remaining.slice(insertIdx),
  ]);
}

export interface ExpenseArchivedDisplacement {
  direction: "move-archived-to-bottom" | "move-active-above-archived" | "none";
  archivedAbove: ExternalProviderCategory[];
  activeBelow: ExternalProviderCategory[];
}

export function detectExpenseCategoryDisplacement(allCategories: ExternalProviderCategory[]): ExpenseArchivedDisplacement {
  const list = sortedActiveExpenseCategories(allCategories);
  const firstArchivedIdx = list.findIndex((c) => isArchivedCategoryName(c.name));
  if (firstArchivedIdx === -1) {
    return { direction: "none", archivedAbove: [], activeBelow: [] };
  }

  let lastActiveIdx = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (!isArchivedCategoryName(list[i].name)) {
      lastActiveIdx = i;
      break;
    }
  }

  if (lastActiveIdx === -1 || firstArchivedIdx > lastActiveIdx) {
    return { direction: "none", archivedAbove: [], activeBelow: [] };
  }

  const activeBelow = list.slice(firstArchivedIdx + 1).filter((c) => !isArchivedCategoryName(c.name));
  const archivedAbove = list.slice(0, lastActiveIdx).filter((c) => isArchivedCategoryName(c.name));

  if (activeBelow.length === 0 || archivedAbove.length === 0) {
    return { direction: "none", archivedAbove: [], activeBelow: [] };
  }

  const direction =
    archivedAbove.length < activeBelow.length ? "move-archived-to-bottom" : "move-active-above-archived";

  return {
    direction,
    archivedAbove,
    activeBelow,
  };
}

export function findExpenseCategoriesBelowArchived(allCategories: ExternalProviderCategory[]): ExternalProviderCategory[] {
  return detectExpenseCategoryDisplacement(allCategories).activeBelow;
}

export function moveExpenseCategoriesAboveArchived(
  allCategories: ExternalProviderCategory[],
  categoryIds?: string[],
): ReorderCategoriesResult {
  const list = sortedActiveExpenseCategories(allCategories);
  const below = findExpenseCategoriesBelowArchived(allCategories);
  const idSet = categoryIds ? new Set(categoryIds) : null;
  const toMove = idSet ? below.filter((c) => idSet.has(c.id)) : below;
  if (toMove.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }
  const moveIds = new Set(toMove.map((c) => c.id));
  const remaining = list.filter((c) => !moveIds.has(c.id));
  const insertIdx = remaining.findIndex((c) => isArchivedCategoryName(c.name));
  const at = insertIdx === -1 ? remaining.length : insertIdx;
  return applyExpenseGroupUpdates(allCategories, [...remaining.slice(0, at), ...toMove, ...remaining.slice(at)]);
}

/**
 * Moves archived categories positioned above active categories (or specified categories)
 * to after the last active category, assigning sequential orders starting after the maximum active category order,
 * mutating ONLY the moved categories while strictly preserving all active category orders.
 */
export function moveExpenseCategoriesToBottom(
  allCategories: ExternalProviderCategory[],
  categoryIds?: string[],
): ReorderCategoriesResult {
  const list = sortedActiveExpenseCategories(allCategories);
  const displacement = detectExpenseCategoryDisplacement(allCategories);
  const idSet = categoryIds && categoryIds.length > 0 ? new Set(categoryIds) : null;
  const toMove = idSet ? list.filter((c) => idSet.has(c.id)) : displacement.archivedAbove;

  if (toMove.length === 0) {
    return { updatedCategories: [...allCategories], modifiedCategories: [] };
  }

  const moveIdSet = new Set(toMove.map((c) => c.id));
  const remaining = list.filter((c) => !moveIdSet.has(c.id));

  // Determine starting order: after max order of remaining categories
  let maxOrder = -1;
  for (const c of remaining) {
    if (typeof c.order === "number" && c.order > maxOrder) {
      maxOrder = c.order;
    }
  }
  const startOrder = Math.max(0, maxOrder + 1);

  let nextOrder = startOrder;
  const modifiedCategories: ExternalProviderCategory[] = [];
  const updatedMap = new Map<string, ExternalProviderCategory>();

  for (const cat of toMove) {
    const updated: ExternalProviderCategory = { ...cat, order: nextOrder++ };
    updatedMap.set(cat.id, updated);
    if (cat.order !== updated.order) {
      modifiedCategories.push(updated);
    }
  }

  const updatedCategories = allCategories.map((c) => updatedMap.get(c.id) ?? c);

  return {
    updatedCategories,
    modifiedCategories,
  };
}

export function getExpenseCategoryHierarchyRank(category: ExternalProviderCategory, defaultCurrency = "PLN"): number {
  if (category.deleted) return 4;
  const tier = getCategoryCurrencyTier(category.name, defaultCurrency);
  if (tier === "archived") return 3;
  if (tier === "foreign") return 2;
  return 1;
}

export function sortExpenseCategoriesByHierarchy(
  categories: ExternalProviderCategory[],
  defaultCurrency = "PLN",
): ExternalProviderCategory[] {
  return [...categories].sort((a, b) => {
    const rankA = getExpenseCategoryHierarchyRank(a, defaultCurrency);
    const rankB = getExpenseCategoryHierarchyRank(b, defaultCurrency);
    if (rankA !== rankB) return rankA - rankB;
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

/**
 * Orders expense categories: primary (default currency) active categories, then foreign/legacy-currency
 * suffixed active categories, then `_` archived categories, and finally soft-deleted categories at the bottom.
 * Relative order is preserved within each tier.
 */
export function organizeExpenseCategoriesByCurrencyTier(
  allCategories: ExternalProviderCategory[],
  defaultCurrency = "PLN",
): ReorderCategoriesResult {
  const expenseCategories = sortCategoriesByOrder(allCategories.filter((c) => isExpenseCategory(c)));
  const primary: ExternalProviderCategory[] = [];
  const foreign: ExternalProviderCategory[] = [];
  const archived: ExternalProviderCategory[] = [];
  const removed: ExternalProviderCategory[] = [];

  for (const c of expenseCategories) {
    if (c.deleted) {
      removed.push(c);
      continue;
    }
    const tier = getCategoryCurrencyTier(c.name, defaultCurrency);
    if (tier === "archived") {
      archived.push(c);
    } else if (tier === "foreign") {
      foreign.push(c);
    } else {
      primary.push(c);
    }
  }

  const newGroup = [...primary, ...foreign, ...archived, ...removed];
  return applyCategoryGroupUpdates(allCategories, newGroup, isExpenseCategory, { includeDeleted: true });
}

// ---------------------------------------------------------------------------
// Category Lifecycle & Activity Optimizer Engine
// ---------------------------------------------------------------------------

export type CategoryActivityLookbackScope = "all-time" | "180-days" | "90-days";

export interface CategoryActivityScoreOptions {
  lookbackScope?: CategoryActivityLookbackScope;
  lookbackDays?: number | null;
  halfLifeDays?: number;
  now?: Date | number;
}

export interface CategoryActivityScore {
  categoryId: string;
  score: number;
  transactionCount: number;
  lastActiveTimestamp: number | null;
  lastActiveDate: Date | null;
}

export function getTransactionTimestamp(tx: ExternalProviderTransaction): number | null {
  if (typeof tx.dateTimestamp === "number" && !Number.isNaN(tx.dateTimestamp) && tx.dateTimestamp > 0) {
    const d = parseExternalProviderTimestamp(tx.dateTimestamp);
    if (d && !Number.isNaN(d.getTime())) return d.getTime();
  }
  if (tx.dateTimestampISO) {
    const parsed = Date.parse(tx.dateTimestampISO);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Computes time-decayed category activity scores using exponential half-life decay:
 * Score(c) = sum_{tx in c} 2^(-age(tx) / tau) with tau = 30 days.
 * Supports configurable lookback scopes ("all-time", "180-days", "90-days").
 */
export function computeCategoryActivityScores(
  categories: ExternalProviderCategory[],
  transactions: ExternalProviderTransaction[],
  options?: CategoryActivityScoreOptions,
): Map<string, CategoryActivityScore> {
  const halfLifeDays = options?.halfLifeDays ?? 30;
  const nowMs =
    options?.now instanceof Date ? options.now.getTime() : typeof options?.now === "number" ? options.now : Date.now();

  let lookbackDays: number | null = null;
  if (typeof options?.lookbackDays === "number") {
    lookbackDays = options.lookbackDays;
  } else if (options?.lookbackScope === "90-days") {
    lookbackDays = 90;
  } else if (options?.lookbackScope === "180-days") {
    lookbackDays = 180;
  }

  const cutoffMs = lookbackDays !== null && lookbackDays > 0 ? nowMs - lookbackDays * 86_400_000 : null;

  const scores = new Map<string, CategoryActivityScore>();
  for (const cat of categories) {
    scores.set(cat.id, {
      categoryId: cat.id,
      score: 0,
      transactionCount: 0,
      lastActiveTimestamp: null,
      lastActiveDate: null,
    });
  }

  for (const tx of transactions) {
    if (tx.deleted) continue;
    const txTime = getTransactionTimestamp(tx);
    if (txTime === null) continue;
    if (cutoffMs !== null && txTime < cutoffMs) continue;

    const ageInDays = Math.max(0, (nowMs - txTime) / 86_400_000);
    const decay = 2 ** (-ageInDays / halfLifeDays);

    const catIdsToUpdate = new Set<string>();
    if (tx.destinationId && scores.has(tx.destinationId)) {
      catIdsToUpdate.add(tx.destinationId);
    }
    if (tx.sourceId && scores.has(tx.sourceId)) {
      catIdsToUpdate.add(tx.sourceId);
    }

    for (const catId of catIdsToUpdate) {
      const entry = scores.get(catId);
      if (entry) {
        entry.score += decay;
        entry.transactionCount += 1;
        if (entry.lastActiveTimestamp === null || txTime > entry.lastActiveTimestamp) {
          entry.lastActiveTimestamp = txTime;
          entry.lastActiveDate = new Date(txTime);
        }
      }
    }
  }

  return scores;
}

export type CategoryAuditStatus = "active" | "low-frequency" | "zero-transaction" | "standalone-foreign";

export interface CategoryActivityAudit {
  categoryId: string;
  category: ExternalProviderCategory;
  lifetimeTransactionCount: number;
  lastActiveTimestamp: number | null;
  lastActiveDate: Date | null;
  status: CategoryAuditStatus;
  isStandaloneForeign: boolean;
  isOrphanCandidate: boolean;
  hasDefaultCurrencyCounterpart: boolean;
  counterpartCategoryId?: string;
}

export interface CategoryActivityAuditOptions {
  defaultCurrency?: string;
  allCategories?: ExternalProviderCategory[];
}

/**
 * Classifies categories across all-time history into:
 * - Active (> 3 transactions)
 * - Low-Frequency (1 to 3 transactions)
 * - Zero-Transaction (0 transactions)
 * - Standalone Foreign (foreign currency category without default currency counterpart)
 */
export function classifyCategoryActivity(
  categories: ExternalProviderCategory[],
  transactions: ExternalProviderTransaction[],
  options?: CategoryActivityAuditOptions,
): Map<string, CategoryActivityAudit> {
  const defaultCurrency = options?.defaultCurrency ?? "PLN";
  const pool = options?.allCategories ?? categories;

  // Build lifetime transaction counts and last active timestamps
  const txCounts = new Map<string, number>();
  const lastActiveMap = new Map<string, number>();

  for (const cat of categories) {
    txCounts.set(cat.id, 0);
  }

  for (const tx of transactions) {
    if (tx.deleted) continue;
    const txTime = getTransactionTimestamp(tx);

    const catIds = new Set<string>();
    if (tx.destinationId && txCounts.has(tx.destinationId)) catIds.add(tx.destinationId);
    if (tx.sourceId && txCounts.has(tx.sourceId)) catIds.add(tx.sourceId);

    for (const cid of catIds) {
      txCounts.set(cid, (txCounts.get(cid) ?? 0) + 1);
      if (txTime !== null) {
        const prev = lastActiveMap.get(cid) ?? 0;
        if (txTime > prev) lastActiveMap.set(cid, txTime);
      }
    }
  }

  // Pre-index default-currency counterparts in pool by canonical base name
  const primaryByBase = new Map<string, ExternalProviderCategory>();
  for (const cat of pool) {
    if (cat.deleted) continue;
    if (getCategoryCurrencyTier(cat.name, defaultCurrency) === "primary") {
      const { stem } = splitArchivePrefix(cat.name);
      const base = extractCanonicalBaseName(stem, defaultCurrency).toLowerCase();
      if (base) {
        primaryByBase.set(base, cat);
      }
    }
  }

  const results = new Map<string, CategoryActivityAudit>();

  for (const cat of categories) {
    const count = txCounts.get(cat.id) ?? 0;
    const lastActiveTs = lastActiveMap.get(cat.id) ?? null;
    const lastActiveDate = lastActiveTs ? new Date(lastActiveTs) : null;

    const isForeign = isForeignCurrencyCategoryName(cat.name, defaultCurrency);
    const { stem } = splitArchivePrefix(cat.name);
    const baseName = extractCanonicalBaseName(stem, defaultCurrency).toLowerCase();
    const counterpart = primaryByBase.get(baseName);
    const hasCounterpart = Boolean(counterpart && counterpart.id !== cat.id);

    const isStandaloneForeign = isForeign && !hasCounterpart;

    let status: CategoryAuditStatus;
    let isOrphanCandidate = false;

    if (isStandaloneForeign) {
      status = "standalone-foreign";
      isOrphanCandidate = false;
    } else if (count === 0) {
      status = "zero-transaction";
      isOrphanCandidate = true;
    } else if (count <= 3) {
      status = "low-frequency";
      isOrphanCandidate = false;
    } else {
      status = "active";
      isOrphanCandidate = false;
    }

    results.set(cat.id, {
      categoryId: cat.id,
      category: cat,
      lifetimeTransactionCount: count,
      lastActiveTimestamp: lastActiveTs,
      lastActiveDate,
      status,
      isStandaloneForeign,
      isOrphanCandidate,
      hasDefaultCurrencyCounterpart: hasCounterpart,
      counterpartCategoryId: hasCounterpart ? counterpart?.id : undefined,
    });
  }

  return results;
}

export interface OptimizeCategoryOrderOptions {
  defaultCurrency?: string;
  isSameGroup?: (c: ExternalProviderCategory) => boolean;
}

export interface SmartOrderItemPreview {
  category: ExternalProviderCategory;
  previousOrder: number;
  newOrder: number;
  rankDelta: number; // previousOrder - newOrder (positive if moved up towards rank 0)
  tier: CategoryCurrencyTier;
  score: number;
  transactionCount: number;
  lastActiveDate: Date | null;
}

/**
 * Optimizes category ordering by activity score while preserving architectural tiers:
 * Tier 1: Active Primary (default currency) categories sorted by activity score descending.
 * Tier 2: Active Foreign currency categories sorted by activity score descending.
 * Tier 3: Soft-Archived categories (`_` prefix), preserving relative position.
 * Tier 4: Soft-Deleted categories (`deleted: true`), preserved at bottom.
 */
export function optimizeCategoryOrderByActivity(
  allCategories: ExternalProviderCategory[],
  scores: Map<string, CategoryActivityScore> | Map<string, number>,
  options?: OptimizeCategoryOrderOptions,
): ReorderCategoriesResult {
  const defaultCurrency = options?.defaultCurrency ?? "PLN";
  const groupPredicate = options?.isSameGroup ?? isExpenseCategory;

  const getScore = (id: string): number => {
    const val = scores.get(id);
    if (typeof val === "number") return val;
    if (val && typeof val.score === "number") return val.score;
    return 0;
  };

  const groupCategories = sortCategoriesByOrder(allCategories.filter((c) => groupPredicate(c)));

  const primary: ExternalProviderCategory[] = [];
  const foreign: ExternalProviderCategory[] = [];
  const archived: ExternalProviderCategory[] = [];
  const removed: ExternalProviderCategory[] = [];

  for (const c of groupCategories) {
    if (c.deleted) {
      removed.push(c);
      continue;
    }
    const tier = getCategoryCurrencyTier(c.name, defaultCurrency);
    if (tier === "archived") {
      archived.push(c);
    } else if (tier === "foreign") {
      foreign.push(c);
    } else {
      primary.push(c);
    }
  }

  // Sort primary by score descending, tie-breaking by order then id
  primary.sort((a, b) => {
    const diff = getScore(b.id) - getScore(a.id);
    if (Math.abs(diff) > 1e-6) return diff;
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });

  // Sort foreign by score descending, tie-breaking by order then id
  foreign.sort((a, b) => {
    const diff = getScore(b.id) - getScore(a.id);
    if (Math.abs(diff) > 1e-6) return diff;
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });

  const newGroup = [...primary, ...foreign, ...archived, ...removed];
  return applyCategoryGroupUpdates(allCategories, newGroup, groupPredicate, { includeDeleted: true });
}

/**
 * Builds a preview comparison of category order changes before and after smart optimization.
 */
export function buildSmartOrderPreviewItems(
  originalCategories: ExternalProviderCategory[],
  optimizedCategories: ExternalProviderCategory[],
  scores: Map<string, CategoryActivityScore>,
  options?: { defaultCurrency?: string; isSameGroup?: (c: ExternalProviderCategory) => boolean },
): SmartOrderItemPreview[] {
  const defaultCurrency = options?.defaultCurrency ?? "PLN";
  const groupPredicate = options?.isSameGroup ?? isExpenseCategory;

  const originalMap = new Map(originalCategories.map((c) => [c.id, c]));
  const group = sortCategoriesByOrder(optimizedCategories.filter((c) => groupPredicate(c) && !c.deleted));

  return group.map((cat, newIndex) => {
    const orig = originalMap.get(cat.id);
    const prevOrder = typeof orig?.order === "number" ? orig.order : newIndex;
    const scoreData = scores.get(cat.id);

    return {
      category: cat,
      previousOrder: prevOrder,
      newOrder: newIndex,
      rankDelta: prevOrder - newIndex,
      tier: getCategoryCurrencyTier(cat.name, defaultCurrency),
      score: scoreData?.score ?? 0,
      transactionCount: scoreData?.transactionCount ?? 0,
      lastActiveDate: scoreData?.lastActiveDate ?? null,
    };
  });
}

export interface CategoryOrderDiffItem {
  category: ExternalProviderCategory;
  previousOrder: number;
  newOrder: number;
  rankDelta: number;
  tier: CategoryCurrencyTier;
  hasMoved: boolean;
  isActiveMove: boolean;
  score?: number;
  transactionCount?: number;
  lastActiveDate?: Date | null;
  reason: string;
}

export interface LISMoverItem {
  id: string;
  origIndex: number;
  newIndex: number;
  score?: number;
}

/**
 * Computes Longest Increasing Subsequence (LIS) on relative indices to isolate
 * active movers (intentional displacements) from passive ripple shifts (items whose
 * relative sequence was preserved).
 *
 * Prioritizes keeping stationary elements (where origIndex === newIndex) and
 * higher activity scores on tie-breaks.
 */
export function classifyActiveMoversViaLIS(items: LISMoverItem[]): Set<string> {
  const n = items.length;
  if (n <= 1) return new Set();

  const dp = new Array<number>(n).fill(1);
  const stationary = new Array<number>(n).fill(0);
  const scores = new Array<number>(n).fill(0);
  const prev = new Array<number>(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const isStat = items[i].origIndex >= 0 && items[i].origIndex === items[i].newIndex ? 1 : 0;
    stationary[i] = isStat;
    scores[i] = items[i].score ?? 0;
  }

  for (let i = 0; i < n; i++) {
    if (items[i].origIndex < 0) continue;

    for (let j = 0; j < i; j++) {
      if (items[j].origIndex >= 0 && items[j].origIndex < items[i].origIndex) {
        const candLen = dp[j] + 1;
        const candStationary = stationary[j] + (items[i].origIndex === items[i].newIndex ? 1 : 0);
        const candScore = scores[j] + (items[i].score ?? 0);

        let isBetter = false;
        if (candLen > dp[i]) {
          isBetter = true;
        } else if (candLen === dp[i]) {
          if (candStationary > stationary[i]) {
            isBetter = true;
          } else if (candStationary === stationary[i]) {
            if (candScore > scores[i]) {
              isBetter = true;
            }
          }
        }

        if (isBetter) {
          dp[i] = candLen;
          stationary[i] = candStationary;
          scores[i] = candScore;
          prev[i] = j;
        }
      }
    }
  }

  let bestIdx = -1;
  for (let i = 0; i < n; i++) {
    if (items[i].origIndex < 0) continue;
    if (bestIdx === -1) {
      bestIdx = i;
    } else if (dp[i] > dp[bestIdx]) {
      bestIdx = i;
    } else if (dp[i] === dp[bestIdx]) {
      if (stationary[i] > stationary[bestIdx]) {
        bestIdx = i;
      } else if (stationary[i] === stationary[bestIdx]) {
        if (scores[i] > scores[bestIdx]) {
          bestIdx = i;
        }
      }
    }
  }

  const inLis = new Set<string>();
  let curr = bestIdx;
  while (curr !== -1) {
    inLis.add(items[curr].id);
    curr = prev[curr];
  }

  const activeMoverIds = new Set<string>();
  for (const item of items) {
    if (item.origIndex < 0) {
      activeMoverIds.add(item.id);
    } else if (item.origIndex !== item.newIndex && !inLis.has(item.id)) {
      activeMoverIds.add(item.id);
    }
  }

  return activeMoverIds;
}

/**
 * Builds an interactive before/after diff for any category reordering strategy (Smart Order or Tier Cleanup).
 */
export function buildCategoryOrderDiffItems(
  originalCategories: ExternalProviderCategory[],
  updatedCategories: ExternalProviderCategory[],
  options?: {
    defaultCurrency?: string;
    scores?: Map<string, CategoryActivityScore>;
    strategy?: "smart-order" | "tier-cleanup";
    isSameGroup?: (c: ExternalProviderCategory) => boolean;
  },
): CategoryOrderDiffItem[] {
  const defaultCurrency = options?.defaultCurrency ?? "PLN";
  const groupPredicate = options?.isSameGroup ?? isExpenseCategory;
  const strategy = options?.strategy ?? "smart-order";
  const scores = options?.scores;

  const originalMap = new Map(originalCategories.map((c) => [c.id, c]));
  const originalGroup = sortCategoriesByOrder(originalCategories.filter((c) => groupPredicate(c)));
  const origIndexMap = new Map<string, number>();
  originalGroup.forEach((cat, idx) => {
    origIndexMap.set(cat.id, idx);
  });

  const group = sortCategoriesByOrder(updatedCategories.filter((c) => groupPredicate(c)));

  // Identify original tier bounds to detect tier realignments
  let lastOrigPrimaryIndex = -1;
  let firstOrigForeignIndex = -1;
  let firstOrigArchivedIndex = -1;
  let lastOrigActiveIndex = -1;

  for (let i = 0; i < originalGroup.length; i++) {
    const c = originalGroup[i];
    if (c.deleted) continue;
    const t = getCategoryCurrencyTier(c.name, defaultCurrency);
    if (t === "primary") {
      lastOrigPrimaryIndex = Math.max(lastOrigPrimaryIndex, i);
      lastOrigActiveIndex = Math.max(lastOrigActiveIndex, i);
    } else if (t === "foreign") {
      if (firstOrigForeignIndex === -1) firstOrigForeignIndex = i;
      lastOrigActiveIndex = Math.max(lastOrigActiveIndex, i);
    } else if (t === "archived") {
      if (firstOrigArchivedIndex === -1) firstOrigArchivedIndex = i;
    }
  }

  // Classify active movers vs passive ripple shifts via LIS
  const lisItems: LISMoverItem[] = group.map((cat, newIndex) => {
    const origIdx = origIndexMap.get(cat.id) ?? -1;
    const scoreData = scores?.get(cat.id);
    return {
      id: cat.id,
      origIndex: origIdx,
      newIndex,
      score: scoreData?.score ?? 0,
    };
  });
  const activeMoverIds = classifyActiveMoversViaLIS(lisItems);

  return group.map((cat, newIndex) => {
    const orig = originalMap.get(cat.id);
    const origIndex = origIndexMap.get(cat.id);
    const prevOrder = typeof orig?.order === "number" ? orig.order : newIndex;
    const currentOrder = typeof cat.order === "number" ? cat.order : newIndex;
    const rankDelta = prevOrder - currentOrder;
    const hasMoved = prevOrder !== currentOrder;
    const isActiveMove = hasMoved && activeMoverIds.has(cat.id);
    const tier = getCategoryCurrencyTier(cat.name, defaultCurrency);

    let reason = "";
    let score: number | undefined;
    let transactionCount: number | undefined;
    let lastActiveDate: Date | null | undefined;

    // Detect currency tier realignments for active movers
    let isTierRealignment = false;
    if (isActiveMove && origIndex !== undefined) {
      if (tier === "foreign" && lastOrigPrimaryIndex !== -1 && origIndex < lastOrigPrimaryIndex) {
        isTierRealignment = true;
        const cur = resolveCategoryCurrency(cat, { defaultCurrency }) || "Foreign";
        reason = `Moved to Foreign tier (${cur})`;
      } else if (
        tier === "primary" &&
        ((firstOrigForeignIndex !== -1 && origIndex > firstOrigForeignIndex) ||
          (firstOrigArchivedIndex !== -1 && origIndex > firstOrigArchivedIndex))
      ) {
        isTierRealignment = true;
        reason = `Promoted to Primary tier (${defaultCurrency})`;
      } else if (tier === "archived" && lastOrigActiveIndex !== -1 && origIndex < lastOrigActiveIndex) {
        isTierRealignment = true;
        reason = "Moved to Archived tier";
      }
    }

    if (!isTierRealignment) {
      if (strategy === "smart-order") {
        const scoreData = scores?.get(cat.id);
        score = scoreData?.score ?? 0;
        transactionCount = scoreData?.transactionCount ?? 0;
        lastActiveDate = scoreData?.lastActiveDate ?? null;
        reason = scoreData
          ? `${transactionCount} ${transactionCount === 1 ? "transaction" : "transactions"}, score ${score.toFixed(1)}`
          : "No transactions";
      } else {
        if (cat.deleted) {
          reason = "Removed / soft-deleted tier";
        } else if (tier === "archived") {
          reason = "Archived tier";
        } else if (tier === "foreign") {
          reason = "Foreign currency tier";
        } else {
          reason = "Primary default currency tier";
        }
      }
    }

    return {
      category: cat,
      previousOrder: prevOrder,
      newOrder: currentOrder,
      rankDelta,
      tier,
      hasMoved,
      isActiveMove,
      score,
      transactionCount,
      lastActiveDate,
      reason,
    };
  });
}

export type ZeroSpendLookbackScope = "current-month" | "3-months" | "6-months" | "12-months" | "all-time";

export interface CategoryZeroSpendEvaluation {
  categoryId: string;
  isZeroSpend: boolean;
  totalSpend: number;
  monthsEvaluated: number;
  lastActiveDate: Date | null;
  lastActiveTimestamp: number | null;
  lifetimeTransactionCount: number;
  isLifetimeDormant: boolean;
}

export interface EvaluateZeroSpendOptions {
  activeMonthDateStr?: string;
  transactions?: ExternalProviderTransaction[];
  defaultCurrency?: string;
  allCategories?: ExternalProviderCategory[];
}

/**
 * Parses point ID or date into a normalized YYYY-MM-01 timestamp and date string.
 */
function parseStatPointDateInternal(
  point: Pick<StatPoint, "id" | "date">,
): { dateStr: string; timestamp: number } | null {
  const raw = point.id || point.date;
  if (!raw) return null;
  const str = String(raw).trim();

  // Match YYYY-MM or YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (isoMatch) {
    const y = Number.parseInt(isoMatch[1], 10);
    const m = Number.parseInt(isoMatch[2], 10) - 1;
    const d = new Date(y, m, 1);
    if (!Number.isNaN(d.getTime())) {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { dateStr, timestamp: d.getTime() };
    }
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth();
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return { dateStr, timestamp: new Date(y, m, 1).getTime() };
  }

  const num = Number(str);
  if (!Number.isNaN(num) && num > 0) {
    const numDate = new Date(num);
    if (!Number.isNaN(numDate.getTime())) {
      const y = numDate.getFullYear();
      const m = numDate.getMonth();
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { dateStr, timestamp: new Date(y, m, 1).getTime() };
    }
  }

  return null;
}

/**
 * Evaluates category zero-spend status across historical lookback scopes:
 * - `current-month`: active month point only
 * - `3-months`: last 3 months up to active month
 * - `6-months`: last 6 months up to active month
 * - `12-months`: last 12 months up to active month
 * - `all-time`: all historical points and lifetime transactions
 */
export function evaluateZeroSpendCategories(
  categories: ExternalProviderCategory[],
  statPoints: StatPoint[] = [],
  scope: ZeroSpendLookbackScope = "current-month",
  options?: EvaluateZeroSpendOptions,
): Map<string, CategoryZeroSpendEvaluation> {
  const validPoints = statPoints
    .map((p) => ({ point: p, parsed: parseStatPointDateInternal(p) }))
    .filter((x): x is { point: StatPoint; parsed: { dateStr: string; timestamp: number } } => x.parsed !== null)
    .sort((a, b) => a.parsed.timestamp - b.parsed.timestamp);

  let targetIndex = validPoints.length - 1;

  if (options?.activeMonthDateStr && validPoints.length > 0) {
    const activeParsed = parseStatPointDateInternal({ id: options.activeMonthDateStr });
    if (activeParsed) {
      const exactIndex = validPoints.findIndex((p) => p.parsed.dateStr === activeParsed.dateStr);
      if (exactIndex >= 0) {
        targetIndex = exactIndex;
      } else {
        const lastBefore = validPoints.findLastIndex((p) => p.parsed.timestamp <= activeParsed.timestamp);
        if (lastBefore >= 0) {
          targetIndex = lastBefore;
        }
      }
    }
  }

  let windowPoints: StatPoint[] = [];

  if (validPoints.length > 0 && targetIndex >= 0) {
    let windowSize = 1;
    switch (scope) {
      case "current-month":
        windowSize = 1;
        break;
      case "3-months":
        windowSize = 3;
        break;
      case "6-months":
        windowSize = 6;
        break;
      case "12-months":
        windowSize = 12;
        break;
      case "all-time":
        windowSize = targetIndex + 1;
        break;
    }
    const startIndex = Math.max(0, targetIndex - windowSize + 1);
    windowPoints = validPoints.slice(startIndex, targetIndex + 1).map((x) => x.point);
  } else if (statPoints.length > 0) {
    // Fallback if statPoints had unparseable dates
    if (scope === "current-month") {
      windowPoints = [statPoints[0]];
    } else if (scope === "3-months") {
      windowPoints = statPoints.slice(0, 3);
    } else if (scope === "6-months") {
      windowPoints = statPoints.slice(0, 6);
    } else if (scope === "12-months") {
      windowPoints = statPoints.slice(0, 12);
    } else {
      windowPoints = statPoints;
    }
  }

  // Activity audit across transactions if provided
  const activityMap = options?.transactions
    ? classifyCategoryActivity(categories, options.transactions, {
        defaultCurrency: options.defaultCurrency,
        allCategories: options.allCategories,
      })
    : null;

  // Compute spend per category across the selected window points
  const results = new Map<string, CategoryZeroSpendEvaluation>();

  for (const cat of categories) {
    let totalSpend = 0;
    for (const point of windowPoints) {
      const catEntry = point.categories?.find((c) => c.id === cat.id);
      if (catEntry) {
        const raw = catEntry.value ?? catEntry.amount ?? catEntry.currentAmount;
        totalSpend += Math.max(0, Number(raw) || 0);
      }
    }

    const audit = activityMap?.get(cat.id);
    const lifetimeCount = audit?.lifetimeTransactionCount ?? 0;
    const lastActiveDate = audit?.lastActiveDate ?? null;
    const lastActiveTimestamp = audit?.lastActiveTimestamp ?? null;

    const isZeroSpend = scope === "all-time" ? totalSpend < 0.005 && lifetimeCount === 0 : totalSpend < 0.005;

    const isLifetimeDormant = totalSpend < 0.005 && lifetimeCount === 0;

    results.set(cat.id, {
      categoryId: cat.id,
      isZeroSpend,
      totalSpend,
      monthsEvaluated: windowPoints.length,
      lastActiveDate,
      lastActiveTimestamp,
      lifetimeTransactionCount: lifetimeCount,
      isLifetimeDormant,
    });
  }

  return results;
}

/**
 * Filters categories to those with zero spend in the specified historical scope.
 */
export function filterZeroSpendCategories(
  categories: ExternalProviderCategory[],
  statPoints: StatPoint[] = [],
  scope: ZeroSpendLookbackScope = "current-month",
  options?: EvaluateZeroSpendOptions,
): ExternalProviderCategory[] {
  const evals = evaluateZeroSpendCategories(categories, statPoints, scope, options);
  return categories.filter((c) => evals.get(c.id)?.isZeroSpend ?? false);
}
