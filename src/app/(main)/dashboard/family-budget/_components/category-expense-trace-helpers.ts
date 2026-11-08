import {
  convertCurrencyAmount,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "./external-provider-data";

function toCategoryMap(
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>,
): Map<string, ExternalProviderCategory> | undefined {
  if (categories instanceof Map) {
    return categories;
  }
  if (Array.isArray(categories)) {
    return new Map(categories.map((c) => [c.id, c]));
  }
  return undefined;
}

export interface TraceCategoryInput {
  id: string;
  name?: string;
  amount?: number;
  percentage?: number;
  isSmartGroup?: boolean;
  children?: Array<{ id: string; name?: string }>;
}

export interface AccountBreakdownItem {
  accountId: string;
  accountName: string;
  totalSpend: number;
  transactionCount: number;
  icon?: string;
  nativeSpend?: number;
  nativeCurrency?: string;
  hasForeignSpend?: boolean;
}

export interface AccountBreakdownSummary {
  allTotalSpend: number;
  allTransactionCount: number;
  accounts: AccountBreakdownItem[];
}

export interface PeriodSpendSummary {
  activeSpend: number;
  baselineSpend: number;
  deltaAbs: number;
  deltaPercent: number | null;
}

/**
 * Resolves all category IDs for trace querying.
 * For smart groups (e.g. Transport & Taxi), includes the parent group ID and all child IDs.
 */
export function resolveCategoryIdsForTrace(category: TraceCategoryInput | null | undefined): string[] {
  if (!category?.id) return [];
  if (category.isSmartGroup && category.children && category.children.length > 0) {
    const ids = new Set<string>([category.id]);
    for (const child of category.children) {
      if (child.id) ids.add(child.id);
    }
    return Array.from(ids);
  }
  return [category.id];
}

export interface ResolvedTransactionSpend {
  nativeAmount: number;
  nativeCurrency: string;
  convertedAmount: number;
  reportingCurrency: string;
  isConverted: boolean;
  rate?: number | null;
}

/**
 * Extracts the monetary expense spend amount from a ExternalProvider transaction.
 */
export function getTransactionSpendAmount(tx: ExternalProviderTransaction): number {
  return Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
}

/**
 * Resolves the true native currency and amount of an expense transaction,
 * and converts it to the reporting currency using upstream exchange rates.
 */
export function resolveTransactionSpend(
  tx: ExternalProviderTransaction,
  defaultCurrency = "PLN",
  currencies: ExternalProviderCurrency[] = [],
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>,
): ResolvedTransactionSpend {
  const categoryMap = toCategoryMap(categories);

  const sourceCategory = tx.sourceId ? categoryMap?.get(tx.sourceId) : undefined;
  const destCategory = tx.destinationId ? categoryMap?.get(tx.destinationId) : undefined;

  const sourceCurrency = tx.sourceCurrencyId ?? sourceCategory?.currencyId ?? defaultCurrency;
  const destCurrency = tx.destinationCurrencyId ?? destCategory?.currencyId ?? defaultCurrency;

  let nativeCurrency = defaultCurrency;
  let nativeAmount = 0;

  if (sourceCurrency && sourceCurrency !== defaultCurrency) {
    nativeCurrency = sourceCurrency;
    nativeAmount = Math.abs(Number(tx.sourceAmount ?? tx.destinationAmount ?? tx.defaultAmount) || 0);
  } else if (destCurrency && destCurrency !== defaultCurrency) {
    nativeCurrency = destCurrency;
    nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
  } else {
    nativeCurrency = tx.sourceCurrencyId ?? tx.destinationCurrencyId ?? defaultCurrency;
    nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
  }

  if (!nativeCurrency) {
    nativeCurrency = defaultCurrency;
  }

  if (nativeCurrency.toUpperCase() === defaultCurrency.toUpperCase()) {
    return {
      nativeAmount,
      nativeCurrency: defaultCurrency,
      convertedAmount: nativeAmount,
      reportingCurrency: defaultCurrency,
      isConverted: false,
      rate: 1,
    };
  }

  const converted = convertCurrencyAmount(nativeAmount, nativeCurrency, defaultCurrency, currencies);
  const convertedAmount = converted ?? nativeAmount;
  const isConverted = converted !== null;
  const rate = isConverted && nativeAmount > 0 ? convertedAmount / nativeAmount : null;

  return {
    nativeAmount,
    nativeCurrency,
    convertedAmount,
    reportingCurrency: defaultCurrency,
    isConverted,
    rate,
  };
}

/**
 * Extracts timestamp for chronological sorting.
 */
export function getTransactionTimestamp(tx: ExternalProviderTransaction): number {
  if (typeof tx.dateTimestamp === "number") return tx.dateTimestamp;
  if (tx.dateTimestampISO) {
    const parsed = Date.parse(tx.dateTimestampISO);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof tx.createdTimestamp === "number") return tx.createdTimestamp;
  return 0;
}

/**
 * Sorts transactions in reverse-chronological order (newest first).
 */
export function sortTransactionsReverseChronological(
  transactions: ExternalProviderTransaction[],
): ExternalProviderTransaction[] {
  return [...transactions]
    .filter((tx) => !tx.deleted)
    .sort((a, b) => {
      const timeDiff = getTransactionTimestamp(b) - getTransactionTimestamp(a);
      if (timeDiff !== 0) return timeDiff;
      return (b.counter ?? 0) - (a.counter ?? 0);
    });
}

/**
 * Aggregates paying accounts and subtotal spends from a list of transactions.
 * Normalizes all amounts into the default reporting currency while recording
 * native currency subtotals per account.
 */
export function computeAccountBreakdown(
  transactions: ExternalProviderTransaction[],
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>,
  defaultCurrency = "PLN",
  currencies: ExternalProviderCurrency[] = [],
): AccountBreakdownSummary {
  const categoryMap = toCategoryMap(categories);

  let allTotalSpend = 0;
  let allTransactionCount = 0;
  const map = new Map<string, AccountBreakdownItem>();

  for (const tx of transactions) {
    if (tx.deleted) continue;

    const resolved = resolveTransactionSpend(tx, defaultCurrency, currencies, categoryMap);
    allTotalSpend += resolved.convertedAmount;
    allTransactionCount += 1;

    const accountId = tx.sourceId ?? "unknown";
    const categoryAccount = categoryMap?.get(accountId);
    const accountName = categoryAccount?.name ?? tx.sourceName ?? "Unknown Account";
    const icon = categoryAccount?.icon;

    const existing = map.get(accountId);
    if (existing) {
      existing.totalSpend += resolved.convertedAmount;
      existing.transactionCount += 1;
      existing.nativeSpend = (existing.nativeSpend ?? 0) + resolved.nativeAmount;
      if (resolved.nativeCurrency !== defaultCurrency) {
        existing.hasForeignSpend = true;
        existing.nativeCurrency = resolved.nativeCurrency;
      }
    } else {
      map.set(accountId, {
        accountId,
        accountName,
        totalSpend: resolved.convertedAmount,
        transactionCount: 1,
        icon,
        nativeSpend: resolved.nativeAmount,
        nativeCurrency: resolved.nativeCurrency,
        hasForeignSpend: resolved.nativeCurrency !== defaultCurrency,
      });
    }
  }

  const accounts = Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);

  return {
    allTotalSpend,
    allTransactionCount,
    accounts,
  };
}

/**
 * Filters transactions by selected paying account ID.
 */
export function filterTransactionsByAccount(
  transactions: ExternalProviderTransaction[],
  selectedAccountId: string | null | undefined,
): ExternalProviderTransaction[] {
  if (!selectedAccountId || selectedAccountId === "all") {
    return transactions.filter((tx) => !tx.deleted);
  }
  return transactions.filter((tx) => !tx.deleted && tx.sourceId === selectedAccountId);
}

/**
 * Computes spend totals and variances between active and comparison baseline periods.
 * Amounts are normalized into reporting currency using exchange rates for valid comparison.
 */
export function computePeriodSpendSummary(
  activeTransactions: ExternalProviderTransaction[],
  baselineTransactions?: ExternalProviderTransaction[],
  defaultCurrency = "PLN",
  currencies: ExternalProviderCurrency[] = [],
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>,
): PeriodSpendSummary {
  const activeSpend = activeTransactions
    .filter((tx) => !tx.deleted)
    .reduce((sum, tx) => sum + resolveTransactionSpend(tx, defaultCurrency, currencies, categories).convertedAmount, 0);

  const baselineSpend = (baselineTransactions ?? [])
    .filter((tx) => !tx.deleted)
    .reduce((sum, tx) => sum + resolveTransactionSpend(tx, defaultCurrency, currencies, categories).convertedAmount, 0);

  const deltaAbs = activeSpend - baselineSpend;
  const deltaPercent = baselineSpend > 0 ? (deltaAbs / baselineSpend) * 100 : null;

  return {
    activeSpend,
    baselineSpend,
    deltaAbs,
    deltaPercent,
  };
}

/**
 * Resolves child subcategory name if the destination matches a child in smart group.
 */
export function identifySubcategoryName(
  destinationId: string | undefined,
  children?: Array<{ id: string; name?: string }>,
  categories?: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>,
): string | null {
  if (!destinationId) return null;

  if (children && children.length > 0) {
    const match = children.find((c) => c.id === destinationId);
    if (match?.name) return match.name;
  }

  const categoryMap = toCategoryMap(categories);

  return categoryMap?.get(destinationId)?.name ?? null;
}

/**
 * Builds the "Open in Ledger" deep link carrying every resolved category ID (and an optional account filter).
 */
export function buildLedgerLink(categoryIds: string[], accountId?: string | null): string {
  const ids = categoryIds.filter(Boolean);
  if (ids.length === 0) return "/dashboard/family-budget";
  const params = [`categoryId=${ids.map(encodeURIComponent).join(",")}`];
  if (accountId) params.push(`accountId=${encodeURIComponent(accountId)}`);
  return `/dashboard/family-budget?${params.join("&")}`;
}

/**
 * Parses a comma-separated `categoryId` query parameter into a de-duplicated ID list.
 */
export function parseLedgerCategoryIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}
