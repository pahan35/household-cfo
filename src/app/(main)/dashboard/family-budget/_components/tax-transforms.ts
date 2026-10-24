import { format } from "date-fns";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  isAccountType,
} from "./external-provider-data";
import { getMacroData } from "./macro-data";

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

export const TAX_CATEGORY_REGEX = /(?:\btax(?:es)?\b|podat|налог)/i;

export const PFRON_CASHBACK_REGEX = /cashback[\s_-]*taxes/i;

/**
 * Returns true if the income category represents a PFRON tax rebate / ZUS offset ("Cashback taxes").
 */
export function isPfronCashbackCategory(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") return false;
  return PFRON_CASHBACK_REGEX.test(name.trim());
}

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
  isPassThrough?: boolean;
}

export interface TaxBreakdownResult {
  totalTaxesConverted: number;
  totalPersonalTaxesConverted: number;
  totalPassThroughConverted: number;
  byTag: TagTaxAggregate[];
  personalTags: TagTaxAggregate[];
  passThroughTags: TagTaxAggregate[];
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
 * Segregates VAT-7 (#vat) as neutral business pass-through, excluding it from personal taxes.
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

  let totalPersonalTaxesConverted = 0;
  let totalPassThroughConverted = 0;
  let untaggedCount = 0;
  let untaggedTotalConverted = 0;

  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!tx.destinationId || !taxIdSet.has(tx.destinationId)) continue;

    const nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
    const currency = (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? defaultCurrency).toUpperCase();
    const converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;

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
      totalPersonalTaxesConverted += converted;
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
        const isVat = bucketId === "vat";
        if (isVat) {
          totalPassThroughConverted += share;
        } else {
          totalPersonalTaxesConverted += share;
        }

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
      const isPassThrough = entry.bucket.id === "vat";
      const divisor = isPassThrough ? totalPassThroughConverted : totalPersonalTaxesConverted;
      const percentage = divisor > 0 ? (entry.totalConverted / divisor) * 100 : 0;
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
        isPassThrough,
      });
    }
  }

  // Sort descending by totalConverted
  byTag.sort((a, b) => b.totalConverted - a.totalConverted);

  const personalTags = byTag.filter((t) => !t.isPassThrough);
  const passThroughTags = byTag.filter((t) => t.isPassThrough);

  return {
    totalTaxesConverted: totalPersonalTaxesConverted,
    totalPersonalTaxesConverted,
    totalPassThroughConverted,
    byTag,
    personalTags,
    passThroughTags,
    untaggedCount,
    untaggedTotalConverted,
    taxCategoryIds: Array.from(taxIdSet),
  };
}

export interface FxTransferItem {
  id: string;
  sourceAmountUsd: number;
  destinationAmountPln: number;
  realizedRate: number;
  nbpRate: number;
  spreadLossPln: number;
  dateStr?: string;
}

export interface FxFrictionResult {
  tradeSpreadLossPln: number;
  tradeSpreadLossUsd: number;
  vatDragLossPln: number;
  vatDragLossUsd: number;
  totalFxFrictionPln: number;
  totalFxFrictionUsd: number;
  transfers: FxTransferItem[];
}

export interface ComputeFxFrictionInput {
  transactions: ExternalProviderTransaction[];
  defaultCurrency?: string;
  monthKey?: string;
  vatInvoicedNbpRate?: number;
  categories?: ExternalProviderCategory[];
}

/**
 * Computes FX trade spread loss between realized conversion rate and NBP mid-market rate.
 */
export function computeTradeSpreadLoss(
  sourceAmountUsd: number,
  destinationAmountPln: number,
  nbpRate: number,
): { realizedRate: number; tradeSpreadLossPln: number; tradeSpreadLossUsd: number } {
  if (sourceAmountUsd <= 0) {
    return { realizedRate: 0, tradeSpreadLossPln: 0, tradeSpreadLossUsd: 0 };
  }
  const realizedRate = destinationAmountPln / sourceAmountUsd;
  const tradeSpreadLossPln = Math.max(0, sourceAmountUsd * (nbpRate - realizedRate));
  const tradeSpreadLossUsd = nbpRate > 0 ? tradeSpreadLossPln / nbpRate : 0;
  return {
    realizedRate: Number(realizedRate.toFixed(4)),
    tradeSpreadLossPln: Number(tradeSpreadLossPln.toFixed(2)),
    tradeSpreadLossUsd: Number(tradeSpreadLossUsd.toFixed(2)),
  };
}

/**
 * Computes VAT-7 currency rate drag (extra USD expended to remit fixed-PLN VAT at realized rate vs invoice date NBP rate).
 */
export function computeVatCurrencyDrag(
  vatPln: number,
  invoiceNbpRate: number,
  realizedRate: number,
): { vatDragLossUsd: number; vatDragLossPln: number } {
  if (invoiceNbpRate <= 0 || realizedRate <= 0 || vatPln <= 0) {
    return { vatDragLossUsd: 0, vatDragLossPln: 0 };
  }
  const usdExpended = vatPln / realizedRate;
  const usdInvoiced = vatPln / invoiceNbpRate;
  const vatDragLossUsd = Math.max(0, usdExpended - usdInvoiced);
  const vatDragLossPln = Math.max(0, vatPln - usdInvoiced * realizedRate);
  return {
    vatDragLossUsd: Number(vatDragLossUsd.toFixed(2)),
    vatDragLossPln: Number(vatDragLossPln.toFixed(2)),
  };
}

/**
 * Computes foreign exchange friction for USD income streams (trade spread and VAT drag).
 */
export function computeFxFriction(input: ComputeFxFrictionInput): FxFrictionResult {
  const { transactions, categories = [] } = input;
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const taxIdSet = getTaxCategoryIds(categories);

  const transfers: FxTransferItem[] = [];
  let totalSpreadLossPln = 0;
  let totalUsdTransferred = 0;
  let totalPlnReceived = 0;
  let totalVatPln = 0;

  for (const tx of transactions) {
    if (tx.deleted) continue;

    // Check if VAT tax payment
    if (tx.destinationId && taxIdSet.has(tx.destinationId)) {
      if (Array.isArray(tx.tags) && tx.tags.some((t) => typeof t === "string" && matchTaxBucket(t)?.id === "vat")) {
        const amt = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
        totalVatPln += amt;
      }
    }

    const srcCat = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;
    const destCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;

    const srcCurr = (tx.sourceCurrencyId ?? srcCat?.currencyId ?? "").toUpperCase();
    const destCurr = (tx.destinationCurrencyId ?? destCat?.currencyId ?? "").toUpperCase();

    // Check for USD -> PLN currency transfer
    if (srcCurr === "USD" && destCurr === "PLN") {
      const srcAmt = Math.abs(Number(tx.sourceAmount ?? tx.defaultAmount) || 0);
      const destAmt = Math.abs(Number(tx.destinationAmount ?? tx.currentAmount) || 0);

      if (srcAmt > 0 && destAmt > 0) {
        totalUsdTransferred += srcAmt;
        totalPlnReceived += destAmt;

        let dateStr: string | undefined;
        let txMonthKey = input.monthKey;
        if (!txMonthKey) {
          if (tx.dateTimestampISO) {
            dateStr = tx.dateTimestampISO;
            txMonthKey = tx.dateTimestampISO.slice(0, 7);
          } else if (tx.dateTimestamp) {
            dateStr = format(new Date(tx.dateTimestamp), "yyyy-MM-dd");
            txMonthKey = format(new Date(tx.dateTimestamp), "yyyy-MM");
          } else {
            txMonthKey = format(new Date(), "yyyy-MM");
          }
        }

        const nbpRate = getMacroData(txMonthKey).usdPlnRate;
        const spread = computeTradeSpreadLoss(srcAmt, destAmt, nbpRate);

        totalSpreadLossPln += spread.tradeSpreadLossPln;
        transfers.push({
          id: tx.id,
          sourceAmountUsd: srcAmt,
          destinationAmountPln: destAmt,
          realizedRate: spread.realizedRate,
          nbpRate,
          spreadLossPln: spread.tradeSpreadLossPln,
          dateStr,
        });
      }
    }
  }

  // VAT currency drag computation
  let vatDragLossUsd = 0;
  let vatDragLossPln = 0;

  if (totalVatPln > 0 && input.vatInvoicedNbpRate && totalUsdTransferred > 0) {
    const avgRealizedRate = totalPlnReceived / totalUsdTransferred;
    const drag = computeVatCurrencyDrag(totalVatPln, input.vatInvoicedNbpRate, avgRealizedRate);
    vatDragLossUsd = drag.vatDragLossUsd;
    vatDragLossPln = drag.vatDragLossPln;
  }

  const latestMonthKey = input.monthKey ?? format(new Date(), "yyyy-MM");
  const defaultNbpRate = getMacroData(latestMonthKey).usdPlnRate;
  const totalSpreadLossUsd = defaultNbpRate > 0 ? totalSpreadLossPln / defaultNbpRate : 0;

  const totalFxFrictionPln = Number((totalSpreadLossPln + vatDragLossPln).toFixed(2));
  const totalFxFrictionUsd = Number((totalSpreadLossUsd + vatDragLossUsd).toFixed(2));

  return {
    tradeSpreadLossPln: Number(totalSpreadLossPln.toFixed(2)),
    tradeSpreadLossUsd: Number(totalSpreadLossUsd.toFixed(2)),
    vatDragLossPln,
    vatDragLossUsd,
    totalFxFrictionPln,
    totalFxFrictionUsd,
    transfers,
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
  isTaxRebate?: boolean;
}

export interface IncomeTaxMetrics {
  grossIncome: number;
  totalTaxes: number;
  grossZus: number;
  pfronCashback: number;
  netZus: number;
  passThroughVat: number;
  fxFriction: number;
  fxFrictionDetails?: FxFrictionResult;
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
  monthKey?: string;
  vatInvoicedNbpRate?: number;
}

/**
 * Computes high-level income and tax metrics:
 * Gross Income, Total Taxes, Effective Tax Rate %, Net Disposable Income, and Expense Coverage Ratio.
 * Excludes PFRON cashback from gross income and credits it directly against ZUS.
 * Excludes pass-through VAT-7 from personal taxes and accounts for USD FX friction.
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
  let pfronCashback = 0;
  let grossZus = 0;
  let passThroughVat = 0;
  let otherPersonalTaxes = 0;

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
      isTaxRebate: boolean;
    }
  >();

  for (const tx of transactions) {
    if (tx.deleted) continue;

    // 1. Check if outgoing tax payment
    if (tx.destinationId && taxIdSet.has(tx.destinationId)) {
      const nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
      const currency = (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? defaultCurrency).toUpperCase();
      const converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;

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
        otherPersonalTaxes += converted;
      } else {
        const share = converted / matchedBucketIds.size;
        for (const bucketId of matchedBucketIds) {
          if (bucketId === "vat") {
            passThroughVat += share;
          } else if (bucketId === "zus") {
            grossZus += share;
          } else {
            otherPersonalTaxes += share;
          }
        }
      }
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

      const isTaxRebate =
        isPfronCashbackCategory(sourceName) || (sourceCat ? isPfronCashbackCategory(sourceCat.name) : false);

      if (isTaxRebate) {
        pfronCashback += converted;
      } else {
        grossIncome += converted;
      }

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
          isTaxRebate,
        });
      }
    }
  }

  // Net ZUS: Gross ZUS minus PFRON cashback rebate
  const netZus = Math.max(0, grossZus - pfronCashback);
  const totalTaxes = otherPersonalTaxes + netZus;

  // Realized FX friction
  const fxFrictionDetails = computeFxFriction({
    transactions,
    defaultCurrency,
    monthKey: input.monthKey,
    vatInvoicedNbpRate: input.vatInvoicedNbpRate,
    categories,
  });
  const fxFriction = fxFrictionDetails.totalFxFrictionPln;

  const effectiveTaxRate = grossIncome > 0 ? (totalTaxes / grossIncome) * 100 : 0;
  const netDisposableIncome = grossIncome - totalTaxes - fxFriction;
  const coverageRatio = controllableExpenses > 0 ? (netDisposableIncome / controllableExpenses) * 100 : 0;
  const netSurplus = netDisposableIncome - controllableExpenses;

  const incomeSources: IncomeSourceSummary[] = Array.from(incomeMap.values())
    .map((item) => ({
      ...item,
      percentageOfGross: !item.isTaxRebate && grossIncome > 0 ? (item.totalConverted / grossIncome) * 100 : 0,
    }))
    .sort((a, b) => b.totalConverted - a.totalConverted);

  return {
    grossIncome,
    totalTaxes,
    grossZus,
    pfronCashback,
    netZus,
    passThroughVat,
    fxFriction,
    fxFrictionDetails,
    effectiveTaxRate,
    netDisposableIncome,
    controllableExpenses,
    coverageRatio,
    netSurplus,
    incomeSources,
  };
}
