import { format } from "date-fns";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  isAccountType,
} from "./external-provider-data";
import { resolveCategoryCurrency, toFxRateToTarget } from "./external-provider-money";
import { getMacroData } from "./macro-data";

export interface TaxTagBucket {
  id: string;
  label: string;
  canonicalTag: string;
  matches: string[];
}

export const KNOWN_TAX_BUCKETS: TaxTagBucket[] = [
  {
    id: "ppe",
    label: "Flat-rate Income Tax (PPE)",
    canonicalTag: "PPE",
    matches: [
      "ppe",
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
    label: "Value Added Tax (VAT-7)",
    canonicalTag: "VAT-7",
    matches: ["vat-7", "vat7", "vat", "ptun", "ндс"],
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
    if (
      bucket.matches.includes(normalized) ||
      bucket.canonicalTag.toLowerCase() === normalized ||
      bucket.id.toLowerCase() === normalized
    ) {
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

export type TaxTimelineTimingMode = "cash" | "accrual";

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
  periodMode?: "month" | "year";
  periodKey?: string;
  timingMode?: TaxTimelineTimingMode;
}

export interface AggregateTaxesInput {
  transactions: ExternalProviderTransaction[];
  taxCategoryIds: Iterable<string>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  periodMode?: "month" | "year";
  periodKey?: string;
  monthKey?: string;
  timingMode?: TaxTimelineTimingMode;
}

/**
 * Aggregates tax transactions by tag bucket and currency.
 * Segregates VAT-7 (#vat) as neutral business pass-through, excluding it from personal taxes.
 * Supports filtering by Month ("yyyy-MM") or Year ("yyyy") and Cash vs. Accrual ("M - 1") timing basis.
 */
export function aggregateTaxesByTag(input: AggregateTaxesInput): TaxBreakdownResult {
  const { transactions, currencies, defaultCurrency } = input;
  const taxIdSet = input.taxCategoryIds instanceof Set ? input.taxCategoryIds : new Set(input.taxCategoryIds);
  const periodKey = input.periodKey ?? input.monthKey;
  const periodMode = input.periodMode ?? (periodKey?.includes("-") ? "month" : "year");
  const timingMode: TaxTimelineTimingMode = input.timingMode ?? "cash";

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

    if (periodKey) {
      const txMonth = getTransactionMonthKey(tx);
      if (!txMonth) continue;
      const effectiveMonth = timingMode === "accrual" ? getPreviousMonthKey(txMonth) : txMonth;
      const inPeriod =
        periodMode === "year" ? effectiveMonth.startsWith(`${periodKey}-`) : effectiveMonth === periodKey;
      if (!inPeriod) continue;
    }

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
    periodMode,
    periodKey,
    timingMode,
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
  invoicedUsdVat?: number;
  expendedUsdForVat?: number;
  realizedSellRate?: number;
  nbpRate?: number;
  totalVatPln?: number;
}

export interface ComputeFxFrictionInput {
  transactions: ExternalProviderTransaction[];
  defaultCurrency?: string;
  periodMode?: "month" | "year";
  periodKey?: string;
  monthKey?: string;
  timingMode?: TaxTimelineTimingMode;
  vatInvoicedNbpRate?: number;
  categories?: ExternalProviderCategory[];
  currencies?: ExternalProviderCurrency[];
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
): { vatDragLossUsd: number; vatDragLossPln: number; invoicedUsdVat: number; expendedUsdForVat: number } {
  if (invoiceNbpRate <= 0 || realizedRate <= 0 || vatPln <= 0) {
    return { vatDragLossUsd: 0, vatDragLossPln: 0, invoicedUsdVat: 0, expendedUsdForVat: 0 };
  }
  const usdExpended = vatPln / realizedRate;
  const usdInvoiced = vatPln / invoiceNbpRate;
  const vatDragLossUsd = Math.max(0, usdExpended - usdInvoiced);
  const vatDragLossPln = Math.max(0, vatPln * (1 - realizedRate / invoiceNbpRate));
  return {
    vatDragLossUsd: Number(vatDragLossUsd.toFixed(2)),
    vatDragLossPln: Number(vatDragLossPln.toFixed(2)),
    invoicedUsdVat: Number(usdInvoiced.toFixed(2)),
    expendedUsdForVat: Number(usdExpended.toFixed(2)),
  };
}

/**
 * Computes foreign exchange friction for USD income streams:
 * - VAT-7 currency drag on 23% VAT paid in USD (when client pays in USD and VAT-7 is settled in PLN)
 * - Trade spread loss on remaining non-VAT USD conversions
 * - Automatically derives NBP reference rate and realized USD/PLN sell rate
 */
export function computeFxFriction(input: ComputeFxFrictionInput): FxFrictionResult {
  const { transactions, categories = [], currencies = [] } = input;
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const taxIdSet = getTaxCategoryIds(categories);

  const periodKey = input.periodKey ?? input.monthKey;
  const periodMode = input.periodMode ?? (periodKey?.includes("-") ? "month" : "year");
  const timingMode: TaxTimelineTimingMode = input.timingMode ?? "cash";

  const transfers: FxTransferItem[] = [];
  let totalSpreadLossPln = 0;
  let totalUsdTransferred = 0;
  let totalPlnReceived = 0;
  let totalVatPln = 0;

  for (const tx of transactions) {
    if (tx.deleted) continue;

    const txMonth = getTransactionMonthKey(tx);

    // 1. Check if VAT tax payment
    if (tx.destinationId && taxIdSet.has(tx.destinationId)) {
      if (Array.isArray(tx.tags) && tx.tags.some((t) => typeof t === "string" && matchTaxBucket(t)?.id === "vat")) {
        if (periodKey && txMonth) {
          const effectiveMonth = timingMode === "accrual" ? getPreviousMonthKey(txMonth) : txMonth;
          const inPeriod =
            periodMode === "year" ? effectiveMonth.startsWith(`${periodKey}-`) : effectiveMonth === periodKey;
          if (!inPeriod) continue;
        }
        const amt = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
        totalVatPln += amt;
      }
    }

    const srcCat = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;
    const destCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;

    const srcCurr = (tx.sourceCurrencyId ?? srcCat?.currencyId ?? "").toUpperCase();
    const destCurr = (tx.destinationCurrencyId ?? destCat?.currencyId ?? "").toUpperCase();

    // 2. Check for USD -> PLN currency transfer
    if (srcCurr === "USD" && destCurr === "PLN") {
      if (periodKey && txMonth) {
        const inPeriod = periodMode === "year" ? txMonth.startsWith(`${periodKey}-`) : txMonth === periodKey;
        if (!inPeriod) continue;
      }

      const srcAmt = Math.abs(Number(tx.sourceAmount ?? tx.defaultAmount) || 0);
      const destAmt = Math.abs(Number(tx.destinationAmount ?? tx.currentAmount) || 0);

      if (srcAmt > 0 && destAmt > 0) {
        totalUsdTransferred += srcAmt;
        totalPlnReceived += destAmt;

        let dateStr: string | undefined;
        const txMonthKey = txMonth ?? periodKey;
        if (tx.dateTimestampISO) {
          dateStr = tx.dateTimestampISO;
        } else if (tx.dateTimestamp) {
          dateStr = format(new Date(tx.dateTimestamp), "yyyy-MM-dd");
        }

        const refMonth = txMonthKey ?? format(new Date(), "yyyy-MM");
        const nbpRate = input.vatInvoicedNbpRate ?? getMacroData(refMonth).usdPlnRate;
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

  // Derive reference NBP rate
  const latestMonthKey =
    periodKey && periodMode === "year" ? `${periodKey}-12` : (periodKey ?? format(new Date(), "yyyy-MM"));
  let defaultNbpRate = input.vatInvoicedNbpRate ?? getMacroData(latestMonthKey).usdPlnRate;
  if (!defaultNbpRate || defaultNbpRate <= 0) {
    if (currencies.length > 0) {
      defaultNbpRate = toFxRateToTarget("USD", "PLN", currencies);
    }
    if (!defaultNbpRate || defaultNbpRate <= 0) {
      defaultNbpRate = 4.0;
    }
  }

  // Fallback to all USD->PLN transfers if period-specific transfer is empty but VAT was paid
  let effectiveUsdTransferred = totalUsdTransferred;
  let effectivePlnReceived = totalPlnReceived;
  if (effectiveUsdTransferred === 0 && totalVatPln > 0) {
    for (const tx of transactions) {
      if (tx.deleted) continue;
      const sCat = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;
      const dCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;
      const sCurr = (tx.sourceCurrencyId ?? sCat?.currencyId ?? "").toUpperCase();
      const dCurr = (tx.destinationCurrencyId ?? dCat?.currencyId ?? "").toUpperCase();
      if (sCurr === "USD" && dCurr === "PLN") {
        const sAmt = Math.abs(Number(tx.sourceAmount ?? tx.defaultAmount) || 0);
        const dAmt = Math.abs(Number(tx.destinationAmount ?? tx.currentAmount) || 0);
        if (sAmt > 0 && dAmt > 0) {
          effectiveUsdTransferred += sAmt;
          effectivePlnReceived += dAmt;
        }
      }
    }
  }

  const realizedSellRate = effectiveUsdTransferred > 0 ? effectivePlnReceived / effectiveUsdTransferred : 0;

  // VAT currency drag computation
  let vatDragLossUsd = 0;
  let vatDragLossPln = 0;
  let invoicedUsdVat = 0;
  let expendedUsdForVat = 0;

  if (totalVatPln > 0 && defaultNbpRate > 0 && realizedSellRate > 0) {
    const drag = computeVatCurrencyDrag(totalVatPln, defaultNbpRate, realizedSellRate);
    vatDragLossUsd = drag.vatDragLossUsd;
    vatDragLossPln = drag.vatDragLossPln;
    invoicedUsdVat = drag.invoicedUsdVat;
    expendedUsdForVat = drag.expendedUsdForVat;
  }

  // Non-overlapping trade spread loss on remaining USD sold for net earnings
  const usdForVat =
    totalUsdTransferred > 0 && realizedSellRate > 0 ? Math.min(totalUsdTransferred, totalVatPln / realizedSellRate) : 0;
  const remainingUsd = Math.max(0, totalUsdTransferred - usdForVat);

  let tradeSpreadLossPln = 0;
  let tradeSpreadLossUsd = 0;
  if (remainingUsd > 0 && realizedSellRate > 0 && defaultNbpRate > realizedSellRate) {
    tradeSpreadLossPln = Number((remainingUsd * (defaultNbpRate - realizedSellRate)).toFixed(2));
    tradeSpreadLossUsd = defaultNbpRate > 0 ? Number((tradeSpreadLossPln / defaultNbpRate).toFixed(2)) : 0;
  } else if (totalVatPln === 0 && totalUsdTransferred > 0) {
    tradeSpreadLossPln = Number(totalSpreadLossPln.toFixed(2));
    tradeSpreadLossUsd = defaultNbpRate > 0 ? Number((tradeSpreadLossPln / defaultNbpRate).toFixed(2)) : 0;
  }

  const totalFxFrictionPln = Number((tradeSpreadLossPln + vatDragLossPln).toFixed(2));
  const totalFxFrictionUsd = Number((tradeSpreadLossUsd + vatDragLossUsd).toFixed(2));

  return {
    tradeSpreadLossPln,
    tradeSpreadLossUsd,
    vatDragLossPln,
    vatDragLossUsd,
    totalFxFrictionPln,
    totalFxFrictionUsd,
    transfers,
    invoicedUsdVat: invoicedUsdVat > 0 ? invoicedUsdVat : undefined,
    expendedUsdForVat: expendedUsdForVat > 0 ? expendedUsdForVat : undefined,
    realizedSellRate: realizedSellRate > 0 ? Number(realizedSellRate.toFixed(4)) : undefined,
    nbpRate: Number(defaultNbpRate.toFixed(4)),
    totalVatPln: totalVatPln > 0 ? Number(totalVatPln.toFixed(2)) : undefined,
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

export interface YoYComparison {
  priorGrossIncome: number;
  grossDelta: number;
  grossDeltaPct: number | null;
  priorTotalTaxes: number;
  taxesDelta: number;
  priorNetDisposable: number;
  netDisposableDelta: number;
  netDisposableDeltaPct: number | null;
  priorEffectiveTaxRate: number;
  effectiveTaxRateDelta: number;
  priorPeriodKey: string;
  priorPeriodLabel: string;
}

export interface IncomeTaxMetrics {
  rawGrossInflow: number;
  grossIncome: number;
  totalTaxes: number;
  personalTaxes: number;
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
  periodMode?: "month" | "year";
  periodKey?: string;
  timingMode?: TaxTimelineTimingMode;
  yoy?: YoYComparison;
}

export interface ComputeIncomeTaxMetricsInput {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  controllableExpenses?: number;
  taxCategoryIds?: Iterable<string>;
  periodMode?: "month" | "year";
  periodKey?: string;
  monthKey?: string;
  timingMode?: TaxTimelineTimingMode;
  vatInvoicedNbpRate?: number;
  computeYoY?: boolean;
}

/**
 * Derives prior-year period key for YoY comparisons:
 * "2026-10" -> "2025-10" (Month Mode)
 * "2026" -> "2025" (Year Mode)
 */
export function getYoYPeriodKey(periodKey: string, periodMode: "month" | "year"): string {
  if (periodMode === "year") {
    const y = parseInt(periodKey, 10);
    return isNaN(y) ? periodKey : String(y - 1);
  }
  const [yStr, mStr] = periodKey.split("-");
  const y = parseInt(yStr, 10);
  return isNaN(y) ? periodKey : `${y - 1}-${mStr}`;
}

/**
 * Computes high-level income and tax metrics:
 * - Scoped to Month ("yyyy-MM") or Year ("yyyy") with Cash vs. Accrual ("M - 1") timing basis
 * - True Gross Inflow: Raw client non-rebate bank inflows MINUS pass-through VAT-7 remittances
 * - Net Personal Taxes: PPE / PIT + Health + Belka + Net ZUS (Gross ZUS minus PFRON cashback)
 * - USD FX & VAT-7 Drag: Realized VAT-7 rate drag + trade spread loss
 * - Net Disposable Income: True Gross Inflow - Net Personal Taxes - FX & VAT-7 Drag
 * - YoY comparison deltas vs. M - 12 (Month Mode) or Y - 1 (Year Mode)
 */
export function computeIncomeTaxMetrics(input: ComputeIncomeTaxMetricsInput): IncomeTaxMetrics {
  const { transactions, categories, currencies, defaultCurrency, controllableExpenses = 0 } = input;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  let taxIdSet: Set<string>;
  if (input.taxCategoryIds) {
    taxIdSet = input.taxCategoryIds instanceof Set ? input.taxCategoryIds : new Set(input.taxCategoryIds);
  } else {
    taxIdSet = getTaxCategoryIds(categories);
  }

  const periodKey = input.periodKey ?? input.monthKey;
  const periodMode = input.periodMode ?? (periodKey?.includes("-") ? "month" : "year");
  const timingMode: TaxTimelineTimingMode = input.timingMode ?? "cash";

  let rawGrossInflow = 0;
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

    const txMonth = getTransactionMonthKey(tx);

    // 1. Check if outgoing tax payment
    if (tx.destinationId && taxIdSet.has(tx.destinationId)) {
      if (periodKey && txMonth) {
        const effectiveMonth = timingMode === "accrual" ? getPreviousMonthKey(txMonth) : txMonth;
        const inPeriod =
          periodMode === "year" ? effectiveMonth.startsWith(`${periodKey}-`) : effectiveMonth === periodKey;
        if (!inPeriod) continue;
      }

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
      const isTaxRebate =
        isPfronCashbackCategory(sourceName) || (sourceCat ? isPfronCashbackCategory(sourceCat.name) : false);

      if (periodKey && txMonth) {
        const effectiveMonth = isTaxRebate && timingMode === "accrual" ? getPreviousMonthKey(txMonth) : txMonth;
        const inPeriod =
          periodMode === "year" ? effectiveMonth.startsWith(`${periodKey}-`) : effectiveMonth === periodKey;
        if (!inPeriod) continue;
      }

      const currency = (
        tx.sourceCurrencyId ??
        (sourceCat ? resolveCategoryCurrency(sourceCat, defaultCurrency) : undefined) ??
        defaultCurrency
      ).toUpperCase();
      const destCurrency = (
        tx.destinationCurrencyId ??
        (destCat ? resolveCategoryCurrency(destCat, defaultCurrency) : undefined) ??
        defaultCurrency
      ).toUpperCase();

      const sourceAmount = tx.sourceAmount != null ? Math.abs(Number(tx.sourceAmount)) : undefined;
      const destAmount = tx.destinationAmount != null ? Math.abs(Number(tx.destinationAmount)) : undefined;

      const nativeAmount = (sourceAmount && sourceAmount > 0 ? sourceAmount : destAmount) ?? 0;
      let converted = 0;
      if (destCurrency === defaultCurrency.toUpperCase() && destAmount && destAmount > 0) {
        converted = destAmount;
      } else {
        converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;
      }

      if (isTaxRebate) {
        pfronCashback += converted;
      } else {
        rawGrossInflow += converted;
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

  // True Gross Inflow: raw client inflows minus pass-through VAT-7 remittances
  const grossIncome = Math.max(0, rawGrossInflow - passThroughVat);

  // Realized FX friction
  const fxFrictionDetails = computeFxFriction({
    transactions,
    defaultCurrency,
    periodMode,
    periodKey,
    monthKey: periodKey ?? input.monthKey,
    timingMode,
    vatInvoicedNbpRate: input.vatInvoicedNbpRate,
    categories,
    currencies,
  });
  const fxFriction = fxFrictionDetails.totalFxFrictionPln;

  const effectiveTaxRate = grossIncome > 0 ? (totalTaxes / grossIncome) * 100 : 0;
  const netDisposableIncome = grossIncome - totalTaxes - fxFriction;
  const coverageRatio = controllableExpenses > 0 ? (netDisposableIncome / controllableExpenses) * 100 : 0;
  const netSurplus = netDisposableIncome - controllableExpenses;

  const incomeSources: IncomeSourceSummary[] = Array.from(incomeMap.values())
    .map((item) => ({
      ...item,
      percentageOfGross: !item.isTaxRebate && rawGrossInflow > 0 ? (item.totalConverted / rawGrossInflow) * 100 : 0,
    }))
    .sort((a, b) => b.totalConverted - a.totalConverted);

  // Compute Year-over-Year comparison deltas
  let yoy: YoYComparison | undefined;
  if (input.computeYoY !== false && periodKey) {
    const priorPeriodKey = getYoYPeriodKey(periodKey, periodMode);
    const prior = computeIncomeTaxMetrics({
      ...input,
      periodKey: priorPeriodKey,
      monthKey: undefined,
      computeYoY: false,
    });
    const priorGross = prior.grossIncome;
    const grossDelta = Number((grossIncome - priorGross).toFixed(2));
    const grossDeltaPct = priorGross > 0 ? Number(((grossDelta / priorGross) * 100).toFixed(1)) : null;

    const priorTaxes = prior.totalTaxes;
    const taxesDelta = Number((totalTaxes - priorTaxes).toFixed(2));

    const priorNet = prior.netDisposableIncome;
    const netDisposableDelta = Number((netDisposableIncome - priorNet).toFixed(2));
    const netDisposableDeltaPct = priorNet > 0 ? Number(((netDisposableDelta / priorNet) * 100).toFixed(1)) : null;

    const priorEffectiveTaxRate = prior.effectiveTaxRate;
    const effectiveTaxRateDelta = Number((effectiveTaxRate - priorEffectiveTaxRate).toFixed(1));

    const priorPeriodLabel = periodMode === "year" ? priorPeriodKey : formatMonthLabel(priorPeriodKey);

    yoy = {
      priorGrossIncome: priorGross,
      grossDelta,
      grossDeltaPct,
      priorTotalTaxes: priorTaxes,
      taxesDelta,
      priorNetDisposable: priorNet,
      netDisposableDelta,
      netDisposableDeltaPct,
      priorEffectiveTaxRate,
      effectiveTaxRateDelta,
      priorPeriodKey,
      priorPeriodLabel,
    };
  }

  return {
    rawGrossInflow,
    grossIncome,
    totalTaxes,
    personalTaxes: totalTaxes,
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
    periodMode,
    periodKey,
    timingMode,
    yoy,
  };
}

export interface IncomeTaxTimelinePoint {
  monthKey: string;
  monthLabel: string;
  grossIncome: number;
  incomeBySource: Record<string, number>;
  ppe: number;
  health: number;
  grossZus: number;
  pfronCashback: number;
  netZus: number;
  passThroughVat: number;
  otherPersonalTaxes: number;
  totalPersonalTaxes: number;
  effectiveTaxRate: number;
  netYield: number;
}

export interface IncomeSourceFilterItem {
  id: string;
  name: string;
  currency: string;
  totalConverted: number;
}

export interface IncomeTaxTimelineResult {
  points: IncomeTaxTimelinePoint[];
  availableSources: IncomeSourceFilterItem[];
  timingMode: TaxTimelineTimingMode;
  totalSelectedGross: number;
  totalPersonalTaxes: number;
  overallEffectiveRate: number;
}

export interface ComputeIncomeTaxTimelineInput {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  taxCategoryIds?: Iterable<string>;
  timingMode?: TaxTimelineTimingMode;
  selectedSourceIds?: string[] | Set<string> | null;
}

/**
 * Extracts "yyyy-MM" from a ExternalProvider transaction.
 */
export function getTransactionMonthKey(tx: ExternalProviderTransaction): string | null {
  if (tx.dateTimestampISO) {
    const match = /^(\d{4}-\d{2})/.exec(tx.dateTimestampISO);
    if (match) return match[1];
  }
  if (typeof tx.dateTimestamp === "number" && !isNaN(tx.dateTimestamp) && tx.dateTimestamp > 0) {
    try {
      return format(new Date(tx.dateTimestamp), "yyyy-MM");
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Computes previous month key "yyyy-MM" (M - 1).
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Formats "yyyy-MM" into human-friendly label like "Jan 2024".
 */
export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return monthKey;
  const date = new Date(year, month - 1, 1);
  return format(date, "MMM yyyy");
}

/**
 * Aggregates historical transactions chronologically into monthly timeline points:
 * - Isolates client gross income by source (excluding PFRON cashback rebates)
 * - Computes PPE, Health, Gross ZUS, and nets PFRON cashback against ZUS (Net ZUS)
 * - Supports Cash Basis (taxes in payment month M) vs. Accrual Basis (taxes shifted to M - 1)
 * - Dynamically recalculates selected gross and effective tax rate when sources are filtered
 */
export function computeIncomeTaxTimeline(input: ComputeIncomeTaxTimelineInput): IncomeTaxTimelineResult {
  const { transactions, categories, currencies, defaultCurrency } = input;
  const timingMode: TaxTimelineTimingMode = input.timingMode ?? "cash";

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  let taxIdSet: Set<string>;
  if (input.taxCategoryIds) {
    taxIdSet = input.taxCategoryIds instanceof Set ? input.taxCategoryIds : new Set(input.taxCategoryIds);
  } else {
    taxIdSet = getTaxCategoryIds(categories);
  }

  const selectedSourcesSet = input.selectedSourceIds
    ? input.selectedSourceIds instanceof Set
      ? input.selectedSourceIds
      : new Set(input.selectedSourceIds)
    : null;

  const isSourceSelected = (sourceId: string) => selectedSourcesSet === null || selectedSourcesSet.has(sourceId);

  interface RawMonthData {
    incomesBySource: Map<string, number>;
    ppe: number;
    health: number;
    grossZus: number;
    pfronCashback: number;
    passThroughVat: number;
    otherPersonalTaxes: number;
  }

  const rawMonthMap = new Map<string, RawMonthData>();

  function getOrCreateMonthData(m: string): RawMonthData {
    let entry = rawMonthMap.get(m);
    if (!entry) {
      entry = {
        incomesBySource: new Map(),
        ppe: 0,
        health: 0,
        grossZus: 0,
        pfronCashback: 0,
        passThroughVat: 0,
        otherPersonalTaxes: 0,
      };
      rawMonthMap.set(m, entry);
    }
    return entry;
  }

  const availableSourcesMap = new Map<string, IncomeSourceFilterItem>();

  for (const tx of transactions) {
    if (tx.deleted) continue;
    const monthKey = getTransactionMonthKey(tx);
    if (!monthKey) continue;

    const nativeAmount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
    const currency = (tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? defaultCurrency).toUpperCase();
    const converted = convertCurrencyAmount(nativeAmount, currency, defaultCurrency, currencies) ?? nativeAmount;

    // 1. Tax payment
    if (tx.destinationId && taxIdSet.has(tx.destinationId)) {
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

      const monthData = getOrCreateMonthData(monthKey);
      if (matchedBucketIds.size === 0) {
        monthData.otherPersonalTaxes += converted;
      } else {
        const share = converted / matchedBucketIds.size;
        for (const bucketId of matchedBucketIds) {
          if (bucketId === "vat") {
            monthData.passThroughVat += share;
          } else if (bucketId === "zus") {
            monthData.grossZus += share;
          } else if (bucketId === "ppe") {
            monthData.ppe += share;
          } else if (bucketId === "health") {
            monthData.health += share;
          } else {
            monthData.otherPersonalTaxes += share;
          }
        }
      }
      continue;
    }

    // 2. Income stream
    const sourceCat = tx.sourceId ? categoryMap.get(tx.sourceId) : undefined;
    const destCat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;

    const isSourceIncome =
      Number(tx.sourceType) === CategoryType.Income || Number(sourceCat?.categoryType) === CategoryType.Income;
    const isDestAccount =
      isAccountType(tx.destinationType) || (destCat !== undefined && isAccountType(destCat.categoryType));

    if (isSourceIncome && isDestAccount) {
      const sourceId = tx.sourceId ?? "unknown-income";
      const sourceName = tx.sourceName ?? sourceCat?.name ?? "Unknown Income";
      const isTaxRebate =
        isPfronCashbackCategory(sourceName) || (sourceCat ? isPfronCashbackCategory(sourceCat.name) : false);

      const monthData = getOrCreateMonthData(monthKey);

      if (isTaxRebate) {
        monthData.pfronCashback += converted;
      } else {
        monthData.incomesBySource.set(sourceId, (monthData.incomesBySource.get(sourceId) ?? 0) + converted);

        const existing = availableSourcesMap.get(sourceId);
        if (existing) {
          existing.totalConverted += converted;
        } else {
          availableSourcesMap.set(sourceId, {
            id: sourceId,
            name: sourceName,
            currency,
            totalConverted: converted,
          });
        }
      }
    }
  }

  interface MonthTaxes {
    ppe: number;
    health: number;
    grossZus: number;
    pfronCashback: number;
    passThroughVat: number;
    otherPersonalTaxes: number;
  }

  const finalTaxesByMonth = new Map<string, MonthTaxes>();

  function getOrCreateFinalTax(m: string): MonthTaxes {
    let entry = finalTaxesByMonth.get(m);
    if (!entry) {
      entry = {
        ppe: 0,
        health: 0,
        grossZus: 0,
        pfronCashback: 0,
        passThroughVat: 0,
        otherPersonalTaxes: 0,
      };
      finalTaxesByMonth.set(m, entry);
    }
    return entry;
  }

  const allInflowMonths = Array.from(rawMonthMap.entries())
    .filter(([_, d]) => d.incomesBySource.size > 0)
    .map(([m]) => m)
    .sort();
  const minInflowMonth = allInflowMonths.length > 0 ? allInflowMonths[0] : null;

  for (const [m, data] of rawMonthMap.entries()) {
    const hasTaxActivity =
      data.ppe > 0 ||
      data.health > 0 ||
      data.grossZus > 0 ||
      data.pfronCashback > 0 ||
      data.passThroughVat > 0 ||
      data.otherPersonalTaxes > 0;

    if (!hasTaxActivity) continue;

    if (timingMode === "cash") {
      const dest = getOrCreateFinalTax(m);
      dest.ppe += data.ppe;
      dest.health += data.health;
      dest.grossZus += data.grossZus;
      dest.pfronCashback += data.pfronCashback;
      dest.passThroughVat += data.passThroughVat;
      dest.otherPersonalTaxes += data.otherPersonalTaxes;
    } else {
      // Accrual basis: Shift taxes to month M - 1
      const prevMonth = getPreviousMonthKey(m);
      // In accrual mode, do not shift taxes into periods preceding the earliest recorded inflow month
      if (minInflowMonth !== null && prevMonth < minInflowMonth) {
        continue;
      }
      const dest = getOrCreateFinalTax(prevMonth);
      dest.ppe += data.ppe;
      dest.health += data.health;
      dest.grossZus += data.grossZus;
      dest.pfronCashback += data.pfronCashback;
      dest.passThroughVat += data.passThroughVat;
      dest.otherPersonalTaxes += data.otherPersonalTaxes;
    }
  }

  const allMonthKeysSet = new Set<string>();
  for (const [m, data] of rawMonthMap.entries()) {
    if (data.incomesBySource.size > 0) {
      allMonthKeysSet.add(m);
    }
  }
  for (const [m, data] of finalTaxesByMonth.entries()) {
    const hasTaxActivity =
      data.ppe > 0 ||
      data.health > 0 ||
      data.grossZus > 0 ||
      data.pfronCashback > 0 ||
      data.passThroughVat > 0 ||
      data.otherPersonalTaxes > 0;
    if (hasTaxActivity) {
      allMonthKeysSet.add(m);
    }
  }

  const allMonthKeys = Array.from(allMonthKeysSet).sort();

  const points: IncomeTaxTimelinePoint[] = [];

  for (const m of allMonthKeys) {
    const raw = rawMonthMap.get(m);
    const tax = finalTaxesByMonth.get(m) ?? {
      ppe: 0,
      health: 0,
      grossZus: 0,
      pfronCashback: 0,
      passThroughVat: 0,
      otherPersonalTaxes: 0,
    };

    let grossIncome = 0;
    const incomeBySource: Record<string, number> = {};
    if (raw?.incomesBySource) {
      for (const [sId, amt] of raw.incomesBySource.entries()) {
        incomeBySource[sId] = Number(amt.toFixed(2));
        if (isSourceSelected(sId)) {
          grossIncome += amt;
        }
      }
    }
    grossIncome = Number(grossIncome.toFixed(2));

    const ppe = Number(tax.ppe.toFixed(2));
    const health = Number(tax.health.toFixed(2));
    const grossZus = Number(tax.grossZus.toFixed(2));
    const pfronCashback = Number(tax.pfronCashback.toFixed(2));
    const netZus = Number(Math.max(0, grossZus - pfronCashback).toFixed(2));
    const passThroughVat = Number(tax.passThroughVat.toFixed(2));
    const otherPersonalTaxes = Number(tax.otherPersonalTaxes.toFixed(2));
    const totalPersonalTaxes = Number((ppe + health + netZus + otherPersonalTaxes).toFixed(2));
    const effectiveTaxRate = grossIncome > 0 ? Number(((totalPersonalTaxes / grossIncome) * 100).toFixed(2)) : 0;
    const netYield = Number((grossIncome - totalPersonalTaxes).toFixed(2));

    points.push({
      monthKey: m,
      monthLabel: formatMonthLabel(m),
      grossIncome,
      incomeBySource,
      ppe,
      health,
      grossZus,
      pfronCashback,
      netZus,
      passThroughVat,
      otherPersonalTaxes,
      totalPersonalTaxes,
      effectiveTaxRate,
      netYield,
    });
  }

  const totalSelectedGross = Number(points.reduce((sum, p) => sum + p.grossIncome, 0).toFixed(2));
  const totalPersonalTaxes = Number(points.reduce((sum, p) => sum + p.totalPersonalTaxes, 0).toFixed(2));
  const overallEffectiveRate =
    totalSelectedGross > 0 ? Number(((totalPersonalTaxes / totalSelectedGross) * 100).toFixed(2)) : 0;

  const availableSources = Array.from(availableSourcesMap.values())
    .map((s) => ({ ...s, totalConverted: Number(s.totalConverted.toFixed(2)) }))
    .sort((a, b) => b.totalConverted - a.totalConverted);

  return {
    points,
    availableSources,
    timingMode,
    totalSelectedGross,
    totalPersonalTaxes,
    overallEffectiveRate,
  };
}
