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

function isAccountType(type: number | undefined | null): boolean {
  const t = Number(type);
  return t === CategoryType.Account || t === CategoryType.BankAccount || t === CategoryType.DebtAccount;
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
