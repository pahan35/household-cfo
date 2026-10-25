import { format, isValid, parseISO } from "date-fns";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  parseExternalProviderTimestamp,
} from "./external-provider-data";
import { resolveCategoryCurrency } from "./external-provider-money";

// ---------------------------------------------------------------------------
// 1. Currency-Suffix-Tolerant Category Normalizers & Unified Categories
// ---------------------------------------------------------------------------

export const KNOWN_CURRENCY_CODES = [
  "PLN",
  "UAH",
  "EUR",
  "USD",
  "GBP",
  "CZK",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "HUF",
  "RON",
  "BGN",
  "TRY",
  "ILS",
  "AED",
  "GEL",
  "KZT",
  "THB",
  "IDR",
  "JPY",
  "CAD",
  "AUD",
] as const;

export const CURRENCY_SUFFIX_REGEX = /(?:[\s_\-–—([{]+)([A-Za-z]{3})(?:[)\]}]?)$/;

/**
 * Strips trailing 3-letter currency codes (e.g. "Sport PLN" -> "Sport", "Medicine UAH" -> "Medicine").
 */
export function stripCurrencySuffix(name: string): string {
  const trimmed = name.trim();
  const match = trimmed.match(CURRENCY_SUFFIX_REGEX);
  if (match) {
    const code = match[1].toUpperCase();
    if (KNOWN_CURRENCY_CODES.includes(code as (typeof KNOWN_CURRENCY_CODES)[number])) {
      return trimmed.replace(CURRENCY_SUFFIX_REGEX, "").trim();
    }
  }
  return trimmed;
}

/**
 * Unifies category names across currency suffixes and known historical typos / aliases:
 * - "Menthal Health" / "Mental Health" -> "Mental Health"
 * - "Medical services" / "Medical service" / "Medicine" / "Medical" -> "Medicine"
 * - "Learning" / "Education" -> "Learning"
 * - "Massage" -> "Massage"
 * - "Sport" / "Sports" -> "Sport"
 */
export function normalizeUnifiedCategory(categoryName: string): string {
  const stripped = stripCurrencySuffix(categoryName);
  const lower = stripped.toLowerCase();

  if (lower === "menthal health" || lower === "mental health") {
    return "Mental Health";
  }
  if (lower === "medical services" || lower === "medical service" || lower === "medicine" || lower === "medical") {
    return "Medicine";
  }
  if (lower === "learning" || lower === "education") {
    return "Learning";
  }
  if (lower === "massage") {
    return "Massage";
  }
  if (lower === "sport" || lower === "sports") {
    return "Sport";
  }
  if (
    lower === "software & tools" ||
    lower === "software and tools" ||
    lower === "software" ||
    lower === "tools & software" ||
    lower === "tools and software" ||
    lower === "dev tools"
  ) {
    return "Software & Tools";
  }
  return stripped;
}

/**
 * Normalizes a raw tag string (trims, removes leading "#", and lowercases).
 */
export function normalizeLifestyleTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").toLowerCase();
}

/**
 * Resolves a date from transaction timestamp fields.
 * Decodes .NET ticks via parseExternalProviderTimestamp, prioritizes valid ISO strings,
 * and guarantees a valid Date instance fallback.
 */
export function getTransactionDate(tx: ExternalProviderTransaction): Date {
  if (typeof tx.dateTimestampISO === "string" && tx.dateTimestampISO.length > 0) {
    const d = parseISO(tx.dateTimestampISO);
    if (isValid(d)) return d;
  }
  if (typeof tx.dateTimestamp === "number" && !Number.isNaN(tx.dateTimestamp)) {
    const d = parseExternalProviderTimestamp(tx.dateTimestamp);
    if (d && isValid(d)) return d;
  }
  if (typeof tx.date === "string" && tx.date.length > 0) {
    const d = parseISO(tx.date);
    if (isValid(d)) return d;
  }
  if (tx.date instanceof Date && isValid(tx.date)) {
    return tx.date;
  }
  return new Date(0);
}

/**
 * Resolves currency code from category either via currencyId, trailing 3-letter currency code in the name,
 * or legacy heuristics.
 */
export function extractCategoryCurrency(cat?: ExternalProviderCategory): string | undefined {
  if (!cat) return undefined;
  const res = resolveCategoryCurrency(cat, "");
  return res.length > 0 ? res : undefined;
}

/**
 * Resolves the native amount and currency of a transaction, converted to the default currency.
 * If transaction-level currency fields are missing, resolves currency hierarchically from
 * destination category or source account via categoryMap.
 *
 * Implements foreign source currency precedence: when an expense transaction originates from
 * a foreign source account or carries a foreign source currency (e.g. EUR), that foreign currency
 * and amount take precedence over default-currency destination categories.
 */
export function getConvertedTransactionAmount(
  tx: ExternalProviderTransaction,
  defaultCurrency: string,
  currencies: ExternalProviderCurrency[],
  categoryMap?: Map<string, ExternalProviderCategory>,
): { nativeAmount: number; currency: string; convertedAmount: number } {
  const normDefault = defaultCurrency.trim().toUpperCase();

  const sourceCategory = tx.sourceId && categoryMap ? categoryMap.get(tx.sourceId) : undefined;
  const destCategory = tx.destinationId && categoryMap ? categoryMap.get(tx.destinationId) : undefined;

  const sourceCurrency = (tx.sourceCurrencyId ?? (sourceCategory ? extractCategoryCurrency(sourceCategory) : undefined))
    ?.trim()
    .toUpperCase();

  const destCurrency = (tx.destinationCurrencyId ?? (destCategory ? extractCategoryCurrency(destCategory) : undefined))
    ?.trim()
    .toUpperCase();

  const sourceNum = tx.sourceAmount != null ? Math.abs(Number(tx.sourceAmount)) : undefined;
  const destNum = tx.destinationAmount != null ? Math.abs(Number(tx.destinationAmount)) : undefined;
  const defaultNum = tx.defaultAmount != null ? Math.abs(Number(tx.defaultAmount)) : undefined;

  let currency = normDefault;
  let nativeAmount = 0;

  if (sourceCurrency && sourceCurrency !== normDefault) {
    currency = sourceCurrency;
    nativeAmount = (sourceNum && sourceNum > 0 ? sourceNum : (destNum ?? defaultNum)) ?? 0;
  } else if (destCurrency && destCurrency !== normDefault) {
    currency = destCurrency;
    nativeAmount = (destNum && destNum > 0 ? destNum : (sourceNum ?? defaultNum)) ?? 0;
  } else {
    currency = sourceCurrency ?? destCurrency ?? normDefault;
    nativeAmount = destNum ?? sourceNum ?? defaultNum ?? 0;
  }

  if (!currency) {
    currency = normDefault;
  }

  const convertedAmount =
    currency === normDefault
      ? nativeAmount
      : (convertCurrencyAmount(nativeAmount, currency, normDefault, currencies) ?? nativeAmount);

  return { nativeAmount, currency, convertedAmount };
}

/**
 * Evaluates whether a transaction is classified as an expense or income.
 */
export function isExpenseTransaction(tx: ExternalProviderTransaction, categoryMap: Map<string, ExternalProviderCategory>): boolean {
  if (tx.destinationType !== undefined) {
    const dt = Number(tx.destinationType);
    if (dt === CategoryType.Expense || dt === CategoryType.Goal || dt === CategoryType.ClassicGoal) {
      return true;
    }
  }
  if (tx.destinationId) {
    const cat = categoryMap.get(tx.destinationId);
    if (cat) {
      const type = Number(cat.categoryType);
      return type === CategoryType.Expense || type === CategoryType.Goal || type === CategoryType.ClassicGoal;
    }
  }
  return false;
}

export function isIncomeTransaction(tx: ExternalProviderTransaction, categoryMap: Map<string, ExternalProviderCategory>): boolean {
  if (tx.sourceType !== undefined) {
    const st = Number(tx.sourceType);
    if (st === CategoryType.Income) {
      return true;
    }
  }
  if (tx.sourceId) {
    const cat = categoryMap.get(tx.sourceId);
    if (cat) {
      return Number(cat.categoryType) === CategoryType.Income;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 2. Generic Category & Tag Donut Aggregations with Drill-Down
// ---------------------------------------------------------------------------

export type DonutViewMode = "by-category" | "unified-category" | "by-tag";
export type TransactionFlow = "expenses" | "income";

export interface DonutSlice {
  id: string;
  label: string;
  amount: number;
  currency: string;
  percentage: number;
  transactionCount: number;
  hasTags?: boolean;
  tagNames?: string[];
  isUntagged?: boolean;
}

export interface AggregateDonutInput {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  flow?: TransactionFlow; // "expenses" (default) or "income"
  viewMode?: DonutViewMode; // "by-category" (default), "unified-category", or "by-tag"
  drillDownCategoryId?: string | null; // Category ID or unified name to drill into
  dateRange?: {
    from?: Date | string | null;
    to?: Date | string | null;
  };
}

export interface DonutAggregateResult {
  totalAmount: number;
  currency: string;
  slices: DonutSlice[];
  flow: TransactionFlow;
  viewMode: DonutViewMode;
  isDrillDown: boolean;
  drillDownTargetLabel?: string;
  totalTransactions: number;
}

/**
 * Aggregates transactions into a ranked proportional donut dataset with Category-to-Tag drill-down support.
 */
export function aggregateDonutData(input: AggregateDonutInput): DonutAggregateResult {
  const {
    transactions,
    currencies,
    defaultCurrency,
    flow = "expenses",
    viewMode = "by-category",
    drillDownCategoryId,
    dateRange,
  } = input;

  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>((input.categories ?? []).map((c) => [c.id, c]));

  const fromDate = dateRange?.from ? new Date(dateRange.from) : null;
  const toDate = dateRange?.to ? new Date(dateRange.to) : null;

  // Filter transactions by flow, validity, and optional date window
  const filteredTx = transactions.filter((tx) => {
    if (tx.deleted) return false;

    // Date range filter
    if (fromDate || toDate) {
      const txDate = getTransactionDate(tx);
      if (fromDate && txDate < fromDate) return false;
      if (toDate && txDate > toDate) return false;
    }

    if (flow === "expenses") {
      return isExpenseTransaction(tx, categoryMap);
    }
    return isIncomeTransaction(tx, categoryMap);
  });

  // Drill-down branch: drilling into tags inside a selected category
  if (drillDownCategoryId) {
    const isUnified = viewMode === "unified-category";
    const targetTransactions = filteredTx.filter((tx) => {
      const catId = flow === "expenses" ? tx.destinationId : tx.sourceId;
      if (!catId) return false;
      const cat = categoryMap.get(catId);
      const catName = cat?.name ?? "Other";

      if (isUnified) {
        return normalizeUnifiedCategory(catName) === drillDownCategoryId;
      }
      return catId === drillDownCategoryId || catName === drillDownCategoryId;
    });

    let targetLabel = drillDownCategoryId;
    if (!isUnified) {
      const cat = categoryMap.get(drillDownCategoryId);
      if (cat) targetLabel = cat.name;
    }

    const tagBuckets = new Map<string, { amount: number; count: number }>();
    let untaggedAmount = 0;
    let untaggedCount = 0;
    let totalDrillDownAmount = 0;

    for (const tx of targetTransactions) {
      const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
      totalDrillDownAmount += convertedAmount;

      const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
      const cleanTags = rawTags.map(normalizeLifestyleTag).filter((t) => t.length > 0);

      if (cleanTags.length === 0) {
        untaggedAmount += convertedAmount;
        untaggedCount++;
      } else {
        // Apportion evenly across multiple tags on the same transaction
        const perTagAmount = convertedAmount / cleanTags.length;
        for (const tag of cleanTags) {
          const existing = tagBuckets.get(tag) ?? { amount: 0, count: 0 };
          tagBuckets.set(tag, {
            amount: existing.amount + perTagAmount,
            count: existing.count + 1,
          });
        }
      }
    }

    const slices: DonutSlice[] = [];
    for (const [tag, data] of tagBuckets.entries()) {
      const percentage = totalDrillDownAmount > 0 ? (data.amount / totalDrillDownAmount) * 100 : 0;
      slices.push({
        id: `tag-${tag}`,
        label: `#${tag}`,
        amount: data.amount,
        currency: defaultCurrency,
        percentage,
        transactionCount: data.count,
        tagNames: [tag],
      });
    }

    if (untaggedCount > 0) {
      const percentage = totalDrillDownAmount > 0 ? (untaggedAmount / totalDrillDownAmount) * 100 : 0;
      slices.push({
        id: "untagged",
        label: "Untagged",
        amount: untaggedAmount,
        currency: defaultCurrency,
        percentage,
        transactionCount: untaggedCount,
        isUntagged: true,
      });
    }

    slices.sort((a, b) => b.amount - a.amount);

    return {
      totalAmount: totalDrillDownAmount,
      currency: defaultCurrency,
      slices,
      flow,
      viewMode,
      isDrillDown: true,
      drillDownTargetLabel: targetLabel,
      totalTransactions: targetTransactions.length,
    };
  }

  // Global "By Tag" mode: aggregates across all tags in the period
  if (viewMode === "by-tag") {
    const tagBuckets = new Map<string, { amount: number; count: number }>();
    let untaggedAmount = 0;
    let untaggedCount = 0;
    let totalTagAmount = 0;

    for (const tx of filteredTx) {
      const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
      totalTagAmount += convertedAmount;

      const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
      const cleanTags = rawTags.map(normalizeLifestyleTag).filter((t) => t.length > 0);

      if (cleanTags.length === 0) {
        untaggedAmount += convertedAmount;
        untaggedCount++;
      } else {
        const perTagAmount = convertedAmount / cleanTags.length;
        for (const tag of cleanTags) {
          const existing = tagBuckets.get(tag) ?? { amount: 0, count: 0 };
          tagBuckets.set(tag, {
            amount: existing.amount + perTagAmount,
            count: existing.count + 1,
          });
        }
      }
    }

    const slices: DonutSlice[] = [];
    for (const [tag, data] of tagBuckets.entries()) {
      const percentage = totalTagAmount > 0 ? (data.amount / totalTagAmount) * 100 : 0;
      slices.push({
        id: `tag-${tag}`,
        label: `#${tag}`,
        amount: data.amount,
        currency: defaultCurrency,
        percentage,
        transactionCount: data.count,
        tagNames: [tag],
      });
    }

    if (untaggedCount > 0) {
      const percentage = totalTagAmount > 0 ? (untaggedAmount / totalTagAmount) * 100 : 0;
      slices.push({
        id: "untagged",
        label: "Untagged",
        amount: untaggedAmount,
        currency: defaultCurrency,
        percentage,
        transactionCount: untaggedCount,
        isUntagged: true,
      });
    }

    slices.sort((a, b) => b.amount - a.amount);

    return {
      totalAmount: totalTagAmount,
      currency: defaultCurrency,
      slices,
      flow,
      viewMode,
      isDrillDown: false,
      totalTransactions: filteredTx.length,
    };
  }

  // Category modes ("by-category" or "unified-category")
  const categoryBuckets = new Map<
    string,
    {
      id: string;
      label: string;
      amount: number;
      count: number;
      taggedCount: number;
      tagsSet: Set<string>;
    }
  >();
  let totalPeriodAmount = 0;

  for (const tx of filteredTx) {
    const catId = flow === "expenses" ? tx.destinationId : tx.sourceId;
    const cat = catId ? categoryMap.get(catId) : undefined;
    const rawName = cat?.name ?? "Other";
    const bucketId = viewMode === "unified-category" ? normalizeUnifiedCategory(rawName) : (catId ?? "other");
    const label = viewMode === "unified-category" ? normalizeUnifiedCategory(rawName) : rawName;

    const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
    totalPeriodAmount += convertedAmount;

    let bucket = categoryBuckets.get(bucketId);
    if (!bucket) {
      bucket = {
        id: bucketId,
        label,
        amount: 0,
        count: 0,
        taggedCount: 0,
        tagsSet: new Set<string>(),
      };
      categoryBuckets.set(bucketId, bucket);
    }

    bucket.amount += convertedAmount;
    bucket.count += 1;

    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    const cleanTags = rawTags.map(normalizeLifestyleTag).filter((t) => t.length > 0);
    if (cleanTags.length > 0) {
      bucket.taggedCount += 1;
      for (const t of cleanTags) {
        bucket.tagsSet.add(t);
      }
    }
  }

  const slices: DonutSlice[] = [];
  for (const bucket of categoryBuckets.values()) {
    const percentage = totalPeriodAmount > 0 ? (bucket.amount / totalPeriodAmount) * 100 : 0;
    slices.push({
      id: bucket.id,
      label: bucket.label,
      amount: bucket.amount,
      currency: defaultCurrency,
      percentage,
      transactionCount: bucket.count,
      hasTags: bucket.taggedCount > 0,
      tagNames: Array.from(bucket.tagsSet),
    });
  }

  slices.sort((a, b) => b.amount - a.amount);

  return {
    totalAmount: totalPeriodAmount,
    currency: defaultCurrency,
    slices,
    flow,
    viewMode,
    isDrillDown: false,
    totalTransactions: filteredTx.length,
  };
}

// ---------------------------------------------------------------------------
// 3. Filtered Monthly Trend Series Builder
// ---------------------------------------------------------------------------

export interface MonthlyTrendPoint {
  monthKey: string; // "2025-07"
  monthLabel: string; // "Jul 2025"
  expenses: number;
  income: number;
  net: number;
  transactionCount: number;
}

export interface TrendSeriesInput {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  filterType?: "all" | "category" | "unified-category" | "tag";
  filterValue?: string | null;
  from?: Date | string | null;
  to?: Date | string | null;
}

/**
 * Builds monthly trend series points for expenses, income, or specific category/tag filters.
 */
export function buildMonthlyTrendSeries(input: TrendSeriesInput): MonthlyTrendPoint[] {
  const { transactions, currencies, defaultCurrency, filterType = "all", filterValue, from, to } = input;

  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>((input.categories ?? []).map((c) => [c.id, c]));

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const monthBuckets = new Map<
    string,
    {
      expenses: number;
      income: number;
      count: number;
      date: Date;
    }
  >();

  const normalizedFilterTag = filterType === "tag" && filterValue ? normalizeLifestyleTag(filterValue) : null;

  for (const tx of transactions) {
    if (tx.deleted) continue;

    const txDate = getTransactionDate(tx);
    if (!isValid(txDate) || txDate.getTime() === 0) continue;
    if (fromDate && txDate < fromDate) continue;
    if (toDate && txDate > toDate) continue;

    const isExp = isExpenseTransaction(tx, categoryMap);
    const isInc = isIncomeTransaction(tx, categoryMap);
    if (!isExp && !isInc) continue;

    // Filter check
    if (filterType === "category" && filterValue) {
      const catId = isExp ? tx.destinationId : tx.sourceId;
      const cat = catId ? categoryMap.get(catId) : undefined;
      const name = cat?.name ?? "";
      if (catId !== filterValue && name !== filterValue) continue;
    } else if (filterType === "unified-category" && filterValue) {
      const catId = isExp ? tx.destinationId : tx.sourceId;
      const cat = catId ? categoryMap.get(catId) : undefined;
      const unified = normalizeUnifiedCategory(cat?.name ?? "");
      if (unified !== filterValue) continue;
    } else if (filterType === "tag" && normalizedFilterTag) {
      const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
      const cleanTags = rawTags.map(normalizeLifestyleTag);
      if (!cleanTags.includes(normalizedFilterTag)) continue;
    }

    const monthKey = format(txDate, "yyyy-MM");
    const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);

    let bucket = monthBuckets.get(monthKey);
    if (!bucket) {
      bucket = {
        expenses: 0,
        income: 0,
        count: 0,
        date: txDate,
      };
      monthBuckets.set(monthKey, bucket);
    }

    if (isExp) {
      bucket.expenses += convertedAmount;
    }
    if (isInc) {
      bucket.income += convertedAmount;
    }
    bucket.count += 1;
  }

  const sortedKeys = Array.from(monthBuckets.keys()).sort();
  return sortedKeys.map((key) => {
    const bucket = monthBuckets.get(key)!;
    return {
      monthKey: key,
      monthLabel: format(bucket.date, "MMM yyyy"),
      expenses: Math.round(bucket.expenses * 100) / 100,
      income: Math.round(bucket.income * 100) / 100,
      net: Math.round((bucket.income - bucket.expenses) * 100) / 100,
      transactionCount: bucket.count,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Travel Episode Detection & Concert Costing Engine
// ---------------------------------------------------------------------------

export interface UntaggedCandidateTransaction {
  transaction: ExternalProviderTransaction;
  reason: string;
  confidenceScore: number; // 0..100
  convertedAmount: number;
  currency: string;
}

export interface TravelEpisode {
  id: string;
  destinationTag: string; // e.g. "austria"
  name: string; // e.g. "Austria (Jul 2025)"
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  preBookingTotal: number;
  onSiteTotal: number;
  totalCost: number;
  currency: string;
  transactionCount: number;
  preBookingTransactions: ExternalProviderTransaction[];
  onSiteTransactions: ExternalProviderTransaction[];
  untaggedCandidates: UntaggedCandidateTransaction[];
}

export type ConcertType = "local" | "trip" | "concert-in-travel";

export interface ConcertEvent {
  id: string;
  artistTag: string; // e.g. "coldplay"
  displayName: string; // e.g. "Coldplay Concert"
  concertDate: string; // "YYYY-MM-DD"
  type: ConcertType;
  overlappingTripId?: string;
  ticketCount: number;
  ticketTotal: number;
  onSiteTotal: number;
  directCost: number;
  allocatedTripOverhead: number;
  totalCostWithOverhead: number;
  currency: string;
  transactions: ExternalProviderTransaction[];
}

export const EXCLUDED_TRAVEL_BOOKEND_TAGS = new Set(["travel", "end-travel", "flight", "hotel", "ticket", "concert"]);

export const EXCLUDED_LIFESTYLE_DESTINATION_TAGS = new Set([
  "subscription",
  "subscriptions",
  "sub",
  "tax",
  "taxes",
  "zus",
  "vat-7",
  "vat",
  "ppe",
  "salary",
  "transfer",
  "cash",
  "refund",
  "wc",
  "youtube",
  "storytel",
  "evernote",
  "googledrive",
  "polytopia",
  "nizhelskyi",
  "jetbrains",
  "google",
  "netflix",
  "spotify",
  "apple",
  "icloud",
]);

export const EXCLUDED_DESTINATION_CATEGORY_REGEX =
  /(?:\btax(?:es)?\b|podat|rent|czynsz|flat|apartment|utilit|prąd|gaz|mieszkanie|salary|wynagrodz|insurance|ubezpiecz|software|tools|debt|kredyt)/i;

export const TRAVEL_CATEGORY_REGEX =
  /(transport|flight|airline|airplane|hotel|hostel|restaurant|cafe|dining|uber|taxi|rail|railway|train|tour|rent|ticket|travel|bilety|nocleg|wycieczk|lotnicz)/i;
const FIXED_EXPENSE_CATEGORY_REGEX =
  /(?:\btax(?:es)?\b|podat|rent|czynsz|flat|apartment|utilit|prąd|gaz|mieszkanie|salary|wynagrodz|insurance|ubezpiecz|software|tools)/i;

/**
 * Detects travel episodes from transactions using bookends (#travel/#end-travel),
 * heuristic on-site stay anchor identification, and 300-day pre-booking lookback.
 */
export function detectTravelEpisodes(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
}): TravelEpisode[] {
  const { transactions, currencies, defaultCurrency } = input;
  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>((input.categories ?? []).map((c) => [c.id, c]));

  // 1. Identify all destination tags associated with #travel, #end-travel, or trip tags
  const destinationTxMap = new Map<string, ExternalProviderTransaction[]>();

  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!isExpenseTransaction(tx, categoryMap)) continue;

    // Filter candidate transactions in non-travel categories
    const cat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;
    if (cat?.name && EXCLUDED_DESTINATION_CATEGORY_REGEX.test(cat.name)) {
      continue;
    }

    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    const cleanTags = rawTags.map(normalizeLifestyleTag);

    // Reject transactions tagged with non-travel / reserved tags
    const hasReservedExclusionTag = cleanTags.some(
      (t) =>
        t === "subscription" ||
        t === "sub" ||
        t === "tax" ||
        t === "zus" ||
        t === "vat-7" ||
        t === "vat" ||
        t === "ppe" ||
        t === "salary" ||
        t === "transfer" ||
        t === "cash" ||
        t === "refund",
    );
    if (hasReservedExclusionTag) continue;

    const hasTravelMarker =
      cleanTags.includes("travel") || cleanTags.includes("end-travel") || cleanTags.includes("trip");

    for (const tag of cleanTags) {
      if (!EXCLUDED_TRAVEL_BOOKEND_TAGS.has(tag) && !EXCLUDED_LIFESTYLE_DESTINATION_TAGS.has(tag) && tag.length > 1) {
        if (hasTravelMarker || cleanTags.length >= 1) {
          const list = destinationTxMap.get(tag) ?? [];
          list.push(tx);
          destinationTxMap.set(tag, list);
        }
      }
    }
  }

  interface CandidateCluster {
    txs: ExternalProviderTransaction[];
    hasBookend: boolean;
    startDate: Date;
    endDate: Date;
    isAnchor: boolean;
  }

  function evaluateCluster(clusterTxs: ExternalProviderTransaction[], hasBookendHint: boolean): CandidateCluster {
    const startDate = getTransactionDate(clusterTxs[0]);
    const endDate = getTransactionDate(clusterTxs[clusterTxs.length - 1]);
    const durationMs = endDate.getTime() - startDate.getTime();

    const hasBookend =
      hasBookendHint ||
      clusterTxs.some((tx) => {
        const tags = (tx.tags ?? []).map((t) => normalizeLifestyleTag(String(t)));
        return tags.includes("travel") || tags.includes("end-travel");
      });

    let isAnchor = false;
    if (hasBookend) {
      // Bookended clusters (#travel / #end-travel) are always valid stay anchors
      isAnchor = true;
    } else {
      // Un-bookended heuristic anchor requires:
      // 1. Spanning multiple calendar days (durationMs >= 86,400,000)
      // 2. At least 2 transactions
      // 3. Travel/on-site spending (foreign currency or travel category)
      const hasTravelSpending = clusterTxs.some((tx) => {
        const { currency } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
        if (currency !== defaultCurrency.toUpperCase()) return true;
        const c = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;
        return c?.name ? TRAVEL_CATEGORY_REGEX.test(c.name) : false;
      });

      if (durationMs >= 86400000 && clusterTxs.length >= 2 && hasTravelSpending) {
        isAnchor = true;
      }
    }

    return {
      txs: clusterTxs,
      hasBookend,
      startDate,
      endDate,
      isAnchor,
    };
  }

  const episodes: TravelEpisode[] = [];

  for (const [destTag, allTxs] of destinationTxMap.entries()) {
    // Sort chronologically
    allTxs.sort((a, b) => getTransactionDate(a).getTime() - getTransactionDate(b).getTime());

    // 1. Group transactions into contiguous candidate clusters
    const clusters: CandidateCluster[] = [];
    let currentTxs: ExternalProviderTransaction[] = [];
    let inBookendedTrip = false;

    for (let i = 0; i < allTxs.length; i++) {
      const tx = allTxs[i];
      const txDate = getTransactionDate(tx);
      const tags = (tx.tags ?? []).map((t) => normalizeLifestyleTag(String(t)));
      const isStart = tags.includes("travel");
      const isEnd = tags.includes("end-travel");

      if (currentTxs.length > 0) {
        const prevTx = currentTxs[currentTxs.length - 1];
        const prevDate = getTransactionDate(prevTx);
        const gapDays = (txDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);

        // Break cluster if a new explicit #travel begins, or if gap between transactions exceeds 14 days
        // (or 30 days if inside a bookended trip)
        const maxGap = inBookendedTrip ? 30 : 14;
        if (isStart || gapDays > maxGap) {
          clusters.push(evaluateCluster(currentTxs, inBookendedTrip));
          currentTxs = [];
          inBookendedTrip = false;
        }
      }

      if (isStart) {
        inBookendedTrip = true;
      }

      currentTxs.push(tx);

      if (isEnd) {
        clusters.push(evaluateCluster(currentTxs, true));
        currentTxs = [];
        inBookendedTrip = false;
      }
    }

    if (currentTxs.length > 0) {
      clusters.push(evaluateCluster(currentTxs, inBookendedTrip));
    }

    // 2. Identify anchors and gather pre-bookings
    const anchors = clusters.filter((c) => c.isAnchor);
    if (anchors.length === 0) continue;

    const nonAnchorTxs = clusters.filter((c) => !c.isAnchor).flatMap((c) => c.txs);

    // Build episodes for each anchor
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const preBookings: ExternalProviderTransaction[] = [];
      const onSite: ExternalProviderTransaction[] = [];

      // Sort non-anchor transactions: gather prior payments occurring within [anchor.startDate - 300 days, anchor.startDate]
      // into the first upcoming anchor
      for (let n = nonAnchorTxs.length - 1; n >= 0; n--) {
        const pTx = nonAnchorTxs[n];
        const pDate = getTransactionDate(pTx);
        const daysPrior = (anchor.startDate.getTime() - pDate.getTime()) / (1000 * 3600 * 24);

        if (daysPrior >= 0 && daysPrior <= 300) {
          // Check if this anchor is indeed the first upcoming anchor for this transaction
          const isFirstUpcoming = !anchors.some(
            (other, idx) => idx < i && other.startDate.getTime() >= pDate.getTime(),
          );
          if (isFirstUpcoming) {
            preBookings.push(pTx);
            nonAnchorTxs.splice(n, 1);
          }
        }
      }

      // Inside the anchor itself, separate pre-bookings (>14 days prior without travel markers) from on-site
      for (const tx of anchor.txs) {
        const txDate = getTransactionDate(tx);
        const diffDays = (anchor.endDate.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
        const tags = (tx.tags ?? []).map((t) => normalizeLifestyleTag(String(t)));

        if (diffDays > 14 && !tags.includes("travel") && !tags.includes("end-travel") && anchor.txs.length > 1) {
          preBookings.push(tx);
        } else {
          onSite.push(tx);
        }
      }

      if (onSite.length === 0 && preBookings.length > 0) {
        const lastPre = preBookings.pop();
        if (lastPre) {
          onSite.push(lastPre);
        }
      }

      preBookings.sort((a, b) => getTransactionDate(a).getTime() - getTransactionDate(b).getTime());
      onSite.sort((a, b) => getTransactionDate(a).getTime() - getTransactionDate(b).getTime());

      const effectiveStartDate = onSite.length > 0 ? getTransactionDate(onSite[0]) : anchor.startDate;
      const effectiveEndDate = onSite.length > 0 ? getTransactionDate(onSite[onSite.length - 1]) : anchor.endDate;

      const validStartDate = isValid(effectiveStartDate) ? effectiveStartDate : new Date(0);
      const validEndDate = isValid(effectiveEndDate) ? effectiveEndDate : validStartDate;

      let preBookingTotal = 0;
      for (const tx of preBookings) {
        preBookingTotal += getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap).convertedAmount;
      }

      let onSiteTotal = 0;
      for (const tx of onSite) {
        onSiteTotal += getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap).convertedAmount;
      }

      const isMultiDay = validEndDate.getTime() - validStartDate.getTime() >= 86400000;
      const untaggedCandidates =
        anchor.hasBookend || isMultiDay
          ? findUntaggedTripCandidates({
              transactions,
              categories: categoryMap,
              currencies,
              defaultCurrency,
              startDate: validStartDate,
              endDate: validEndDate,
            })
          : [];

      const capDestination = destTag.charAt(0).toUpperCase() + destTag.slice(1);
      const name = `${capDestination} (${format(validStartDate, "MMM yyyy")})`;
      const episodeId = `trip-${destTag}-${format(validStartDate, "yyyy-MM")}-${i + 1}`;

      episodes.push({
        id: episodeId,
        destinationTag: destTag,
        name,
        startDate: format(validStartDate, "yyyy-MM-dd"),
        endDate: format(validEndDate, "yyyy-MM-dd"),
        preBookingTotal: Math.round(preBookingTotal * 100) / 100,
        onSiteTotal: Math.round(onSiteTotal * 100) / 100,
        totalCost: Math.round((preBookingTotal + onSiteTotal) * 100) / 100,
        currency: defaultCurrency,
        transactionCount: preBookings.length + onSite.length,
        preBookingTransactions: preBookings,
        onSiteTransactions: onSite,
        untaggedCandidates,
      });
    }
  }

  // Sort episodes chronologically descending
  episodes.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return episodes;
}

/**
 * Discovers candidate untagged expense transactions occurring within a trip's date window.
 */
export function findUntaggedTripCandidates(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  startDate: Date;
  endDate: Date;
}): UntaggedCandidateTransaction[] {
  const { transactions, currencies, defaultCurrency, startDate, endDate } = input;
  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>((input.categories ?? []).map((c) => [c.id, c]));

  const startMs = new Date(startDate).setHours(0, 0, 0, 0);
  const endMs = new Date(endDate).setHours(23, 59, 59, 999);

  const candidates: UntaggedCandidateTransaction[] = [];

  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!isExpenseTransaction(tx, categoryMap)) continue;

    const txDate = getTransactionDate(tx);
    const txTime = txDate.getTime();
    if (txTime < startMs || txTime > endMs) continue;

    // Check if untagged
    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    if (rawTags.length > 0) continue;

    const { convertedAmount, currency } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
    const cat = tx.destinationId ? categoryMap.get(tx.destinationId) : undefined;
    const catName = cat?.name ?? "";

    // Ignore obvious fixed recurring expenses
    if (FIXED_EXPENSE_CATEGORY_REGEX.test(catName)) continue;

    let score = 20;
    const reasons: string[] = [];

    if (currency !== defaultCurrency.toUpperCase()) {
      score += 40;
      reasons.push(`Foreign currency (${currency})`);
    }

    if (TRAVEL_CATEGORY_REGEX.test(catName)) {
      score += 30;
      reasons.push(`Travel-relevant category: ${catName}`);
    } else {
      reasons.push(`Occurred during trip dates (${format(txDate, "MMM d")})`);
    }

    candidates.push({
      transaction: tx,
      reason: reasons.join(" • "),
      confidenceScore: Math.min(100, score),
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      currency: defaultCurrency,
    });
  }

  candidates.sort((a, b) => b.confidenceScore - a.confidenceScore || b.convertedAmount - a.convertedAmount);
  return candidates;
}

/**
 * Aggregates concert events (#concert tag + artist/event tag) and computes event costing,
 * including same-day multi-ticket grouping, local vs. trip classification, and trip overlap.
 */
export function detectConcertEvents(input: {
  transactions: ExternalProviderTransaction[];
  episodes: TravelEpisode[];
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
}): ConcertEvent[] {
  const { transactions, episodes, currencies, defaultCurrency } = input;

  const concertBuckets = new Map<string, ExternalProviderTransaction[]>();

  for (const tx of transactions) {
    if (tx.deleted) continue;
    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    const cleanTags = rawTags.map(normalizeLifestyleTag);

    if (cleanTags.includes("concert")) {
      // Find artist / event tag
      const otherTags = cleanTags.filter((t) => t !== "concert" && t !== "ticket");
      const artistTag = otherTags[0] ?? "general-concert";
      const bucket = concertBuckets.get(artistTag) ?? [];
      bucket.push(tx);
      concertBuckets.set(artistTag, bucket);
    }
  }

  const events: ConcertEvent[] = [];

  for (const [artistTag, txs] of concertBuckets.entries()) {
    txs.sort((a, b) => getTransactionDate(a).getTime() - getTransactionDate(b).getTime());

    const firstDate = getTransactionDate(txs[0]);
    const lastDate = getTransactionDate(txs[txs.length - 1]);
    const validConcertDate = isValid(lastDate) ? lastDate : isValid(firstDate) ? firstDate : new Date(0);
    const concertDateStr = format(validConcertDate, "yyyy-MM-dd");

    let ticketCount = 0;
    let ticketTotal = 0;
    let onSiteTotal = 0;

    for (const tx of txs) {
      const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies);
      const tags = (tx.tags ?? []).map((t) => normalizeLifestyleTag(String(t)));
      if (tags.includes("ticket") || txs.length === 1) {
        ticketCount++;
        ticketTotal += convertedAmount;
      } else {
        onSiteTotal += convertedAmount;
      }
    }

    const directCost = ticketTotal + onSiteTotal;

    // Check overlap with travel episodes
    let concertType: ConcertType = "local";
    let overlappingTripId: string | undefined;
    let allocatedTripOverhead = 0;

    for (const ep of episodes) {
      const epStart = parseISO(ep.startDate).getTime();
      const epEnd = parseISO(ep.endDate).getTime();
      const cDateMs = validConcertDate.getTime();

      if (cDateMs >= epStart && cDateMs <= epEnd) {
        concertType = "concert-in-travel";
        overlappingTripId = ep.id;
        // Allocate proportionate share or transport/hotel portion (e.g. 25% of trip on-site overhead)
        allocatedTripOverhead = Math.round(ep.onSiteTotal * 0.25 * 100) / 100;
        break;
      }
    }

    const capArtist = artistTag.charAt(0).toUpperCase() + artistTag.slice(1);
    const displayName = `${capArtist} Concert`;

    events.push({
      id: `concert-${artistTag}-${concertDateStr}`,
      artistTag,
      displayName,
      concertDate: concertDateStr,
      type: concertType,
      overlappingTripId,
      ticketCount: Math.max(1, ticketCount),
      ticketTotal: Math.round(ticketTotal * 100) / 100,
      onSiteTotal: Math.round(onSiteTotal * 100) / 100,
      directCost: Math.round(directCost * 100) / 100,
      allocatedTripOverhead,
      totalCostWithOverhead: Math.round((directCost + allocatedTripOverhead) * 100) / 100,
      currency: defaultCurrency,
      transactions: txs,
    });
  }

  events.sort((a, b) => b.concertDate.localeCompare(a.concertDate));
  return events;
}

// ---------------------------------------------------------------------------
// 5. Wellness & Learning Cadence Engine
// ---------------------------------------------------------------------------

export type WellnessStreamId =
  | "massage"
  | "physiotherapy"
  | "mental-health"
  | "pilates"
  | "medical"
  | "sport"
  | "learning";

export interface WellnessStreamMetric {
  streamId: WellnessStreamId;
  label: string;
  totalCost: number;
  totalSessions: number;
  effectiveCostPerSession: number;
  daysBetweenSessions: number | null;
  monthlyCadence: number;
  transactionCount: number;
  currency: string;
  transactions: ExternalProviderTransaction[];
}

export interface WellnessAuditItem {
  transaction: ExternalProviderTransaction;
  streamId: WellnessStreamId;
  suggestedTags: string[];
  reason: string;
  isOutlierPackage: boolean;
  convertedAmount: number;
  currency: string;
  nativeAmount?: number;
  nativeCurrency?: string;
}

export interface LearningFacetMetric {
  facetTag: string; // "platform" | "cert" | "course" | "tutor" | "books" | "other"
  label: string;
  totalCost: number;
  transactionCount: number;
  percentage: number;
  currency: string;
}

export interface LearningDashboardMetrics {
  totalSpend: number;
  monthlyRunRate: number; // Recurring subscriptions / run rate
  facets: LearningFacetMetric[];
  transactions: ExternalProviderTransaction[];
  currency: string;
}

export const PASS_OVERRIDE_REGEX = /^([0-9]+)x$/i;

// ---------------------------------------------------------------------------
// 5.1 Wellness Coverage Sub-Tags & Scope/Person Tags Taxonomy
// ---------------------------------------------------------------------------

export const MEDICAL_COVERED_TAGS = ["consult", "exams", "vaccine", "insurance", "doctor", "lab"] as const;
export const MEDICAL_OUT_OF_POCKET_TAGS = [
  "dentist",
  "pharmacy",
  "physio",
  "physiotherapy",
  "optician",
  "medicines",
] as const;
export const SPORT_COVERED_TAGS = ["gym", "multisport", "fitness", "pool", "swim"] as const;
export const SPORT_OUT_OF_POCKET_TAGS = ["pilates", "trainer", "coach"] as const;
export const SCOPE_PERSON_TAGS = ["wife", "partner", "family", "me", "kid", "child"] as const;

export const SPORT_ACTIVITY_TAGS = ["pilates", "gym", "multisport"] as const;
export const MEDICAL_SERVICE_TAGS = ["consult", "exams", "dentist", "pharmacy", "physio", "vaccine"] as const;
export const SCOPE_TAGS = ["wife", "partner", "family", "me"] as const;
export const PASS_TAGS = ["10x", "5x", "1x"] as const;

export function isSportActivityTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return (
    SPORT_ACTIVITY_TAGS.includes(norm as (typeof SPORT_ACTIVITY_TAGS)[number]) ||
    isSportCoveredTag(norm) ||
    isSportOutOfPocketTag(norm)
  );
}

export function isMedicalServiceTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return (
    MEDICAL_SERVICE_TAGS.includes(norm as (typeof MEDICAL_SERVICE_TAGS)[number]) ||
    isMedicalCoveredTag(norm) ||
    isMedicalOutOfPocketTag(norm)
  );
}

export function isScopeTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return SCOPE_TAGS.includes(norm as (typeof SCOPE_TAGS)[number]) || isSpouseOrFamilyTag(norm);
}

export function isMedicalCoveredTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return MEDICAL_COVERED_TAGS.includes(norm as (typeof MEDICAL_COVERED_TAGS)[number]);
}

export function isMedicalOutOfPocketTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return MEDICAL_OUT_OF_POCKET_TAGS.includes(norm as (typeof MEDICAL_OUT_OF_POCKET_TAGS)[number]);
}

export function isSportCoveredTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return SPORT_COVERED_TAGS.includes(norm as (typeof SPORT_COVERED_TAGS)[number]);
}

export function isSportOutOfPocketTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return SPORT_OUT_OF_POCKET_TAGS.includes(norm as (typeof SPORT_OUT_OF_POCKET_TAGS)[number]);
}

export function isSpouseOrFamilyTag(tag: string): boolean {
  const norm = normalizeLifestyleTag(tag);
  return norm === "wife" || norm === "partner" || norm === "family";
}

/**
 * Extracts explicit pass multiplier overrides (e.g. #10x, #5x, #1x) from transaction tags.
 */
export function getPassMultiplierFromTags(tags?: string[]): number | null {
  if (!Array.isArray(tags)) return null;
  for (const rawTag of tags) {
    if (typeof rawTag !== "string") continue;
    const clean = normalizeLifestyleTag(rawTag);
    const match = clean.match(PASS_OVERRIDE_REGEX);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

/**
 * Computes wellness & sport streams, session cadence, effective cost per session,
 * and identifies package outliers and untagged audit transactions.
 */
export function computeWellnessMetrics(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
}): {
  streams: WellnessStreamMetric[];
  auditQueue: WellnessAuditItem[];
} {
  const { transactions, currencies, defaultCurrency } = input;
  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>((input.categories ?? []).map((c) => [c.id, c]));

  const streamBuckets: Record<
    WellnessStreamId,
    {
      label: string;
      txs: ExternalProviderTransaction[];
      sessions: number;
      totalCost: number;
    }
  > = {
    massage: { label: "Massage", txs: [], sessions: 0, totalCost: 0 },
    physiotherapy: { label: "Physiotherapy", txs: [], sessions: 0, totalCost: 0 },
    "mental-health": { label: "Mental Health", txs: [], sessions: 0, totalCost: 0 },
    pilates: { label: "Pilates", txs: [], sessions: 0, totalCost: 0 },
    medical: { label: "General Medical", txs: [], sessions: 0, totalCost: 0 },
    sport: { label: "General Sport", txs: [], sessions: 0, totalCost: 0 },
    learning: { label: "Learning", txs: [], sessions: 0, totalCost: 0 },
  };

  const auditQueue: WellnessAuditItem[] = [];

  // Group transactions into streams
  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!isExpenseTransaction(tx, categoryMap)) continue;

    const catId = tx.destinationId;
    const cat = catId ? categoryMap.get(catId) : undefined;
    const rawCatName = cat?.name ?? "";
    const unifiedCat = normalizeUnifiedCategory(rawCatName);

    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    const cleanTags = rawTags.map(normalizeLifestyleTag);

    const { convertedAmount, nativeAmount, currency } = getConvertedTransactionAmount(
      tx,
      defaultCurrency,
      currencies,
      categoryMap,
    );

    // Classify into wellness stream
    let targetStream: WellnessStreamId | null = null;
    let defaultMultiplier = 1;

    if (unifiedCat === "Massage" || cleanTags.includes("massage")) {
      targetStream = "massage";
      defaultMultiplier = 1;
    } else if (
      unifiedCat === "Mental Health" ||
      cleanTags.includes("mental-health") ||
      cleanTags.includes("psychologist")
    ) {
      targetStream = "mental-health";
      defaultMultiplier = 1;
    } else if (cleanTags.includes("physio") || cleanTags.includes("physiotherapy")) {
      targetStream = "physiotherapy";
      defaultMultiplier = 1;
    } else if (cleanTags.includes("pilates")) {
      targetStream = "pilates";
      defaultMultiplier = 10; // Pilates default pass multiplier
    } else if (unifiedCat === "Medicine") {
      targetStream = "medical";
      defaultMultiplier = 1;
      const hasServiceTag = cleanTags.some(isMedicalServiceTag);
      if (!hasServiceTag) {
        const baseSuggestions = ["consult", "exams", "dentist", "pharmacy", "wife"];
        const suggestedTags = baseSuggestions.filter((t) => !cleanTags.includes(t));
        const reason = cleanTags.length === 0 ? "Untagged medical expense" : "Missing medical service tag";
        auditQueue.push({
          transaction: tx,
          streamId: "medical",
          suggestedTags,
          reason,
          isOutlierPackage: false,
          convertedAmount,
          currency: defaultCurrency,
          nativeAmount,
          nativeCurrency: currency,
        });
      }
    } else if (unifiedCat === "Sport") {
      targetStream = "sport";
      defaultMultiplier = 1;
      const hasActivityTag = cleanTags.some(isSportActivityTag);
      if (!hasActivityTag) {
        const baseSuggestions = ["gym", "multisport", "pilates", "wife"];
        const suggestedTags = baseSuggestions.filter((t) => !cleanTags.includes(t));
        const reason = cleanTags.length === 0 ? "Untagged sport expense" : "Missing sport activity tag";
        auditQueue.push({
          transaction: tx,
          streamId: "sport",
          suggestedTags,
          reason,
          isOutlierPackage: false,
          convertedAmount,
          currency: defaultCurrency,
          nativeAmount,
          nativeCurrency: currency,
        });
      }
    } else if (unifiedCat === "Learning") {
      targetStream = "learning";
      defaultMultiplier = 1;
    }

    if (targetStream) {
      const override = getPassMultiplierFromTags(tx.tags);
      const sessionCount = override ?? defaultMultiplier;

      const bucket = streamBuckets[targetStream];
      bucket.txs.push(tx);
      bucket.sessions += sessionCount;
      bucket.totalCost += convertedAmount;
    }
  }

  // Detect package outliers (>= 4x median single visit cost in Mental Health or Physio)
  for (const streamId of ["mental-health", "physiotherapy"] as const) {
    const bucket = streamBuckets[streamId];
    if (bucket.txs.length < 3) continue;

    const singleVisitCosts = bucket.txs
      .filter((tx) => getPassMultiplierFromTags(tx.tags) === null)
      .map((tx) => getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap).convertedAmount)
      .sort((a, b) => a - b);

    if (singleVisitCosts.length > 0) {
      const mid = Math.floor(singleVisitCosts.length / 2);
      const median =
        singleVisitCosts.length % 2 !== 0
          ? singleVisitCosts[mid]
          : (singleVisitCosts[mid - 1] + singleVisitCosts[mid]) / 2;

      for (const tx of bucket.txs) {
        const {
          convertedAmount,
          nativeAmount,
          currency: txCurrency,
        } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
        if (convertedAmount >= 4 * median && getPassMultiplierFromTags(tx.tags) === null) {
          const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
          const cleanTags = rawTags.map(normalizeLifestyleTag);
          const baseSuggestions = ["10x", "5x", "wife"];
          const suggestedTags = baseSuggestions.filter((t) => !cleanTags.includes(t));

          const normTxCurrency = txCurrency.toUpperCase();
          const normDefault = defaultCurrency.toUpperCase();
          let nativeMedian = Math.round(median);
          if (normTxCurrency !== normDefault) {
            const converted = convertCurrencyAmount(median, normDefault, normTxCurrency, currencies);
            if (converted != null && !Number.isNaN(converted)) {
              nativeMedian = Math.round(converted);
            }
          }

          auditQueue.push({
            transaction: tx,
            streamId,
            suggestedTags,
            reason: `Likely multi-session package (${nativeAmount} ${txCurrency} vs median ${nativeMedian} ${txCurrency})`,
            isOutlierPackage: true,
            convertedAmount,
            currency: defaultCurrency,
            nativeAmount,
            nativeCurrency: txCurrency,
          });
        }
      }
    }
  }

  // Reorder audit queue: package outliers first, then untagged entries, descending by date within each tier
  auditQueue.sort((a, b) => {
    if (a.isOutlierPackage && !b.isOutlierPackage) return -1;
    if (!a.isOutlierPackage && b.isOutlierPackage) return 1;

    const dateA = getTransactionDate(a.transaction).getTime();
    const dateB = getTransactionDate(b.transaction).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return b.transaction.id.localeCompare(a.transaction.id);
  });

  // Calculate cadence and format stream metrics
  const streams: WellnessStreamMetric[] = [];
  for (const [id, bucket] of Object.entries(streamBuckets) as [
    WellnessStreamId,
    (typeof streamBuckets)[WellnessStreamId],
  ][]) {
    if (bucket.txs.length === 0) continue;

    bucket.txs.sort((a, b) => getTransactionDate(a).getTime() - getTransactionDate(b).getTime());
    const firstDate = getTransactionDate(bucket.txs[0]);
    const lastDate = getTransactionDate(bucket.txs[bucket.txs.length - 1]);

    const totalDays = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24));
    const activeMonths = Math.max(1, totalDays / 30.4);

    const daysBetweenSessions = bucket.sessions > 1 ? Math.round((totalDays / bucket.sessions) * 10) / 10 : null;
    const monthlyCadence = Math.round((bucket.sessions / activeMonths) * 10) / 10;
    const effectiveCostPerSession =
      bucket.sessions > 0 ? Math.round((bucket.totalCost / bucket.sessions) * 100) / 100 : 0;

    streams.push({
      streamId: id,
      label: bucket.label,
      totalCost: Math.round(bucket.totalCost * 100) / 100,
      totalSessions: bucket.sessions,
      effectiveCostPerSession,
      daysBetweenSessions,
      monthlyCadence,
      transactionCount: bucket.txs.length,
      currency: defaultCurrency,
      transactions: bucket.txs,
    });
  }

  return { streams, auditQueue };
}

/**
 * Computes Learning facet metrics (#platform, #cert, #course, #tutor, #books)
 * and monthly recurring run rate.
 */
export function computeLearningMetrics(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
}): LearningDashboardMetrics {
  const { transactions, currencies, defaultCurrency } = input;
  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>((input.categories ?? []).map((c) => [c.id, c]));

  const facetBuckets: Record<string, { label: string; amount: number; count: number }> = {
    platform: { label: "Platforms & Subscriptions", amount: 0, count: 0 },
    cert: { label: "Certifications & Exams", amount: 0, count: 0 },
    course: { label: "Courses & Bootcamps", amount: 0, count: 0 },
    tutor: { label: "Tutors & Mentors", amount: 0, count: 0 },
    books: { label: "Books & Materials", amount: 0, count: 0 },
    other: { label: "Other Learning", amount: 0, count: 0 },
  };

  const learningTxs: ExternalProviderTransaction[] = [];
  let totalSpend = 0;
  let platformSpendLast90Days = 0;

  const nowMs = Date.now();
  const ninetyDaysAgoMs = nowMs - 90 * 24 * 3600 * 1000;

  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!isExpenseTransaction(tx, categoryMap)) continue;

    const catId = tx.destinationId;
    const cat = catId ? categoryMap.get(catId) : undefined;
    const unifiedCat = normalizeUnifiedCategory(cat?.name ?? "");
    if (unifiedCat !== "Learning") continue;

    const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);
    totalSpend += convertedAmount;
    learningTxs.push(tx);

    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    const cleanTags = rawTags.map(normalizeLifestyleTag);

    let matchedFacet = "other";
    if (cleanTags.includes("platform") || cleanTags.includes("sub") || cleanTags.includes("subscription")) {
      matchedFacet = "platform";
      const txTime = getTransactionDate(tx).getTime();
      if (txTime >= ninetyDaysAgoMs) {
        platformSpendLast90Days += convertedAmount;
      }
    } else if (cleanTags.includes("cert") || cleanTags.includes("certification") || cleanTags.includes("exam")) {
      matchedFacet = "cert";
    } else if (cleanTags.includes("course") || cleanTags.includes("bootcamp")) {
      matchedFacet = "course";
    } else if (cleanTags.includes("tutor") || cleanTags.includes("mentor")) {
      matchedFacet = "tutor";
    } else if (cleanTags.includes("book") || cleanTags.includes("books")) {
      matchedFacet = "books";
    }

    facetBuckets[matchedFacet].amount += convertedAmount;
    facetBuckets[matchedFacet].count += 1;
  }

  // Monthly run rate: estimated from recent platform subscriptions
  const monthlyRunRate = Math.round((platformSpendLast90Days / 3) * 100) / 100;

  const facets: LearningFacetMetric[] = [];
  for (const [tag, bucket] of Object.entries(facetBuckets)) {
    if (bucket.count === 0 && bucket.amount === 0) continue;
    const percentage = totalSpend > 0 ? Math.round((bucket.amount / totalSpend) * 1000) / 10 : 0;
    facets.push({
      facetTag: tag,
      label: bucket.label,
      totalCost: Math.round(bucket.amount * 100) / 100,
      transactionCount: bucket.count,
      percentage,
      currency: defaultCurrency,
    });
  }

  facets.sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    monthlyRunRate,
    facets,
    transactions: learningTxs,
    currency: defaultCurrency,
  };
}
