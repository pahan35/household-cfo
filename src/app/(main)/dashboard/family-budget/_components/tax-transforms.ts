import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  isAccountType,
} from "./external-provider-data";

export interface TaxTagBucket {
  id: string;
  label: string;
  canonicalTag: string;
  matches: string[];
}

export const KNOWN_TAX_BUCKETS: TaxTagBucket[] = [
  {
    id: "pit",
    label: "Personal Income Tax (PIT)",
    canonicalTag: "pit",
    matches: [
      "pit",
      "income-tax",
      "income_tax",
      "incometax",
      "podatek-dochodowy",
      "podatek_dochodowy",
      "налог-на-доход",
    ],
  },
  {
    id: "zus",
    label: "Social Security (ZUS)",
    canonicalTag: "zus",
    matches: ["zus", "social", "social-security", "social_security", "ubezpieczenia", "соцстрах"],
  },
  {
    id: "health",
    label: "Health Insurance (NFZ)",
    canonicalTag: "health",
    matches: ["health", "nfz", "zdrowotne", "zdrowie", "medical", "медстрах"],
  },
  {
    id: "vat",
    label: "Value Added Tax (VAT)",
    canonicalTag: "vat",
    matches: ["vat", "ptun", "ндс"],
  },
  {
    id: "capital-gains",
    label: "Capital Gains Tax (Belka)",
    canonicalTag: "belka",
    matches: ["capital-gains", "capital_gains", "belka", "dividends-tax", "dividend-tax", "налог-на-дивиденды"],
  },
];

export const TAX_CATEGORY_REGEX = /(tax|podat|налог)/i;

/**
 * Normalizes a tag string by lowercasing, trimming, and removing any leading "#".
 */
export function normalizeTaxTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/^#+/, "");
}

/**
 * Matches a tag string against known tax tag buckets.
 */
export function matchTaxBucket(tag: string): TaxTagBucket | null {
  const normalized = normalizeTaxTag(tag);
  if (!normalized) return null;

  for (const bucket of KNOWN_TAX_BUCKETS) {
    if (bucket.matches.includes(normalized) || bucket.canonicalTag === normalized || bucket.id === normalized) {
      return bucket;
    }
  }
  return null;
}

/**
 * Identifies categories dedicated to tax expenses across currencies.
 * Matches non-deleted expense categories whose name matches TAX_CATEGORY_REGEX.
 */
export function findTaxCategories(categories: ExternalProviderCategory[]): ExternalProviderCategory[] {
  return categories.filter((c) => {
    if (c.deleted) return false;
    const type = Number(c.categoryType);
    const isExpense = type === CategoryType.Expense || type === CategoryType.Goal || type === CategoryType.ClassicGoal;
    return isExpense && TAX_CATEGORY_REGEX.test(c.name);
  });
}

/**
 * Returns a Set of tax category IDs from the categories list.
 */
export function getTaxCategoryIds(categories: ExternalProviderCategory[]): Set<string> {
  return new Set(findTaxCategories(categories).map((c) => c.id));
}

/**
 * Checks if a transaction has at least one recognized tax tag.
 */
export function hasRecognizedTaxTag(tx: ExternalProviderTransaction): boolean {
  if (!Array.isArray(tx.tags) || tx.tags.length === 0) {
    return false;
  }
  return tx.tags.some((t) => typeof t === "string" && matchTaxBucket(t) !== null);
}

/**
 * Finds all outgoing tax transactions that lack a recognized tax tag.
 */
export function detectUntaggedTaxTransactions(
  transactions: ExternalProviderTransaction[],
  taxCategoryIds: Iterable<string>,
): ExternalProviderTransaction[] {
  const taxIdSet = taxCategoryIds instanceof Set ? taxCategoryIds : new Set(taxCategoryIds);

  return transactions
    .filter((tx) => {
      if (tx.deleted) return false;
      if (!tx.destinationId || !taxIdSet.has(tx.destinationId)) return false;
      return !hasRecognizedTaxTag(tx);
    })
    .sort((a, b) => {
      const timeA = a.dateTimestamp ?? (a.dateTimestampISO ? Date.parse(a.dateTimestampISO) : 0) ?? 0;
      const timeB = b.dateTimestamp ?? (b.dateTimestampISO ? Date.parse(b.dateTimestampISO) : 0) ?? 0;
      return timeB - timeA;
    });
}

export interface TagTaxAggregate {
  tagId: string;
  label: string;
  canonicalTag: string;
  totalConverted: number;
  percentage: number;
  byCurrency: { currency: string; amount: number }[];
  transactionCount: number;
}

export interface TaxBreakdownResult {
  totalTaxesConverted: number;
  byTag: TagTaxAggregate[];
  untaggedCount: number;
  untaggedTotalConverted: number;
  taxCategoryIds: string[];
}

export interface AggregateTaxesInput {
  transactions: ExternalProviderTransaction[];
  taxCategoryIds: Iterable<string>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
}

/**
 * Aggregates tax transactions by tag bucket and currency.
 */
export function aggregateTaxesByTag(input: AggregateTaxesInput): TaxBreakdownResult {
  const { transactions, currencies, defaultCurrency } = input;
  const taxIdSet = input.taxCategoryIds instanceof Set ? input.taxCategoryIds : new Set(input.taxCategoryIds);

  const otherBucket: TaxTagBucket = {
    id: "other",
    label: "Untagged Taxes",
    canonicalTag: "other",
    matches: [],
  };

  const bucketMap = new Map<
    string,
    {
      bucket: TaxTagBucket;
      totalConverted: number;
      byCurrency: Map<string, number>;
      count: number;
    }
  >();

  // Initialize known buckets and other bucket
  for (const b of KNOWN_TAX_BUCKETS) {
    bucketMap.set(b.id, {
      bucket: b,
      totalConverted: 0,
      byCurrency: new Map(),
      count: 0,
    });
  }
  bucketMap.set("other", {
    bucket: otherBucket,
    totalConverted: 0,
    byCurrency: new Map(),
    count: 0,
  });

  let totalTaxesConverted = 0;
  let untaggedCount = 0;
  let untaggedTotalConverted = 0;

  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!tx.destinationId || !taxIdSet.has(tx.destinationId)) continue;

    const nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
    const currency = (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? defaultCurrency).toUpperCase();
    const converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;

    totalTaxesConverted += converted;

    // Find all matching buckets for this transaction's tags
    const matchedBucketIds = new Set<string>();
    if (Array.isArray(tx.tags) && tx.tags.length > 0) {
      for (const rawTag of tx.tags) {
        if (typeof rawTag === "string") {
          const matched = matchTaxBucket(rawTag);
          if (matched) {
            matchedBucketIds.add(matched.id);
          }
        }
      }
    }

    if (matchedBucketIds.size === 0) {
      untaggedCount += 1;
      untaggedTotalConverted += converted;
      const otherEntry = bucketMap.get("other");
      if (otherEntry) {
        otherEntry.totalConverted += converted;
        otherEntry.count += 1;
        otherEntry.byCurrency.set(currency, (otherEntry.byCurrency.get(currency) ?? 0) + nativeAmount);
      }
    } else {
      // If transaction matches multiple buckets (rare), split converted amount equally
      const share = converted / matchedBucketIds.size;
      const nativeShare = nativeAmount / matchedBucketIds.size;

      for (const bucketId of matchedBucketIds) {
        const entry = bucketMap.get(bucketId);
        if (entry) {
          entry.totalConverted += share;
          entry.count += 1;
          entry.byCurrency.set(currency, (entry.byCurrency.get(currency) ?? 0) + nativeShare);
        }
      }
    }
  }

  const byTag: TagTaxAggregate[] = [];
  for (const entry of bucketMap.values()) {
    if (entry.count > 0) {
      const percentage = totalTaxesConverted > 0 ? (entry.totalConverted / totalTaxesConverted) * 100 : 0;
      const byCurrency = Array.from(entry.byCurrency.entries())
        .map(([curr, amt]) => ({ currency: curr, amount: amt }))
        .sort((a, b) => a.currency.localeCompare(b.currency));

      byTag.push({
        tagId: entry.bucket.id,
        label: entry.bucket.label,
        canonicalTag: entry.bucket.canonicalTag,
        totalConverted: entry.totalConverted,
        percentage,
        byCurrency,
        transactionCount: entry.count,
      });
    }
  }

  // Sort descending by totalConverted
  byTag.sort((a, b) => b.totalConverted - a.totalConverted);

  return {
    totalTaxesConverted,
    byTag,
    untaggedCount,
    untaggedTotalConverted,
    taxCategoryIds: Array.from(taxIdSet),
  };
}

export interface IncomeSourceSummary {
  sourceId: string;
  sourceName: string;
  totalConverted: number;
  percentageOfGross: number;
  nativeAmount: number;
  currency: string;
  isArchived: boolean;
  limitAmount?: number;
}

export interface IncomeTaxMetrics {
  grossIncome: number;
  totalTaxes: number;
  effectiveTaxRate: number;
  netDisposableIncome: number;
  controllableExpenses: number;
  coverageRatio: number;
  netSurplus: number;
  incomeSources: IncomeSourceSummary[];
}

export interface ComputeIncomeTaxMetricsInput {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  controllableExpenses?: number;
  taxCategoryIds?: Iterable<string>;
}

/**
 * Computes high-level income and tax metrics:
 * Gross Income, Total Taxes, Effective Tax Rate %, Net Disposable Income, and Expense Coverage Ratio.
 */
export function computeIncomeTaxMetrics(input: ComputeIncomeTaxMetricsInput): IncomeTaxMetrics {
  const { transactions, categories, currencies, defaultCurrency, controllableExpenses = 0 } = input;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const taxIdSet = input.taxCategoryIds
    ? input.taxCategoryIds instanceof Set
      ? input.taxCategoryIds
      : new Set(input.taxCategoryIds)
    : getTaxCategoryIds(categories);

  let grossIncome = 0;
  let totalTaxes = 0;

  const incomeMap = new Map<
    string,
    {
      sourceId: string;
      sourceName: string;
      totalConverted: number;
      nativeAmount: number;
      currency: string;
      isArchived: boolean;
      limitAmount?: number;
    }
  >();

  for (const tx of transactions) {
    if (tx.deleted) continue;

    // 1. Check if outgoing tax payment
    if (tx.destinationId && taxIdSet.has(tx.destinationId)) {
      const nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
      const currency = (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? defaultCurrency).toUpperCase();
      const converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;
      totalTaxes += converted;
      continue;
    }

    // 2. Check if income arriving from an income source
    const sourceCat = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;
    const destCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;

    const isSourceIncome =
      Number(tx.sourceType) === CategoryType.Income || Number(sourceCat?.categoryType) === CategoryType.Income;
    const isDestAccount =
      isAccountType(tx.destinationType) || (destCat !== undefined && isAccountType(destCat.categoryType));

    if (isSourceIncome && isDestAccount) {
      const sourceId = tx.sourceId ?? "unknown-income";
      const sourceName = tx.sourceName ?? sourceCat?.name ?? "Unknown Income";
      const nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
      const currency = (
        tx.destinationCurrencyId ??
        tx.sourceCurrencyId ??
        sourceCat?.currencyId ??
        defaultCurrency
      ).toUpperCase();
      const converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;

      grossIncome += converted;

      const existing = incomeMap.get(sourceId);
      if (existing) {
        existing.totalConverted += converted;
        existing.nativeAmount += nativeAmount;
      } else {
        const isArchived = sourceCat ? sourceCat.name.startsWith("_") : false;
        incomeMap.set(sourceId, {
          sourceId,
          sourceName,
          totalConverted: converted,
          nativeAmount,
          currency,
          isArchived,
          limitAmount: sourceCat?.limitAmount,
        });
      }
    }
  }

  const effectiveTaxRate = grossIncome > 0 ? (totalTaxes / grossIncome) * 100 : 0;
  const netDisposableIncome = grossIncome - totalTaxes;
  const coverageRatio = controllableExpenses > 0 ? (netDisposableIncome / controllableExpenses) * 100 : 0;
  const netSurplus = netDisposableIncome - controllableExpenses;

  const incomeSources: IncomeSourceSummary[] = Array.from(incomeMap.values())
    .map((item) => ({
      ...item,
      percentageOfGross: grossIncome > 0 ? (item.totalConverted / grossIncome) * 100 : 0,
    }))
    .sort((a, b) => b.totalConverted - a.totalConverted);

  return {
    grossIncome,
    totalTaxes,
    effectiveTaxRate,
    netDisposableIncome,
    controllableExpenses,
    coverageRatio,
    netSurplus,
    incomeSources,
  };
}
