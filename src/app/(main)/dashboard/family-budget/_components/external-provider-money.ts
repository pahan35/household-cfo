import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "./external-provider-data";

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export const KNOWN_CURRENCY_CODES = [
  "EUR",
  "USD",
  "PLN",
  "UAH",
  "GBP",
  "CZK",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "CAD",
  "AUD",
  "JPY",
  "HUF",
] as const;

export type KnownCurrencyCode = (typeof KNOWN_CURRENCY_CODES)[number];

const KNOWN_CURRENCY_SET = new Set<string>(KNOWN_CURRENCY_CODES);

/**
 * Matches trailing 3-letter currency code bounded by word boundary, parentheses, brackets, or slash.
 * E.g., "Hotels EUR", "Salary (USD)", "Freelance [USD]", "Travel / EUR".
 * Does NOT match substrings inside words (e.g. "AutoCAD").
 */
const TRAILING_CURRENCY_CODE_REGEX = /(?:[\s([/]|^)([A-Za-z]{3})[)\]\s]*$/;

/**
 * Heuristics for legacy Cyrillic account or category names resolving to UAH.
 */
const CYRILLIC_UAH_REGEX = /(?:грн|гривн[ая]|приват|моно)/i;

/**
 * Resolves the currency code from a ExternalProvider category entity, string name, or fallback.
 * Follows strict priority:
 * 1. `category.currencyId` directly when present and non-empty on a ExternalProviderCategory entity
 * 2. Category name trailing uppercase 3-letter ISO code or legacy Cyrillic match,
 *    when `category.currencyId` is missing/empty or when a plain string name is passed
 * 3. Fallback to default currency ("PLN")
 */
export function resolveCategoryCurrency(
  category: ExternalProviderCategory | string | null | undefined,
  defaultCurrency = "PLN",
): string {
  const normDefault = defaultCurrency !== undefined ? defaultCurrency.trim().toUpperCase() : "PLN";

  if (!category) {
    return normDefault;
  }

  if (typeof category === "string") {
    const trimmed = category.trim();
    if (trimmed.length === 3 && KNOWN_CURRENCY_SET.has(trimmed.toUpperCase())) {
      return trimmed.toUpperCase();
    }
    const match = trimmed.match(TRAILING_CURRENCY_CODE_REGEX);
    if (match) {
      const code = match[1].toUpperCase();
      if (KNOWN_CURRENCY_SET.has(code)) {
        return code;
      }
    }
    if (CYRILLIC_UAH_REGEX.test(trimmed)) {
      return "UAH";
    }
    return normDefault;
  }

  const rawCurrencyId = typeof category.currencyId === "string" ? category.currencyId.trim().toUpperCase() : "";
  if (rawCurrencyId) {
    return rawCurrencyId;
  }

  const name = category.name ? category.name.trim() : "";
  if (name) {
    const match = name.match(TRAILING_CURRENCY_CODE_REGEX);
    if (match) {
      const code = match[1].toUpperCase();
      if (KNOWN_CURRENCY_SET.has(code)) {
        return code;
      }
    }
    if (CYRILLIC_UAH_REGEX.test(name)) {
      return "UAH";
    }
  }

  return normDefault;
}

/**
 * Computes exchange rate from `fromCurrency` to `toCurrency` using ExternalProvider base-USD currency rates:
 * rate = targetRate / sourceRate
 */
export function toFxRateToTarget(
  fromCurrency: string | undefined,
  toCurrency: string | undefined,
  currencies: ExternalProviderCurrency[],
): number {
  const from = (fromCurrency ?? "").trim().toUpperCase();
  const to = (toCurrency ?? "").trim().toUpperCase();

  if (!from || !to || from === to) {
    return 1;
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

  if (fromRate === null || toRate === null || fromRate <= 0) {
    return 1;
  }

  return toRate / fromRate;
}

/**
 * Converts a MoneyAmount into targetCurrency using ExternalProvider FX rates.
 */
export function convertMoney(
  money: MoneyAmount,
  targetCurrency: string,
  currencies: ExternalProviderCurrency[],
): MoneyAmount {
  const target = targetCurrency.trim().toUpperCase() || "PLN";
  const rate = toFxRateToTarget(money.currency, target, currencies);
  return {
    amount: money.amount * rate,
    currency: target,
  };
}

export interface ResolvedTransactionMoney {
  source: MoneyAmount;
  destination: MoneyAmount;
  primary: MoneyAmount;
}

/**
 * Resolves source, destination, and primary monetary values of a transaction atomically.
 */
export function resolveTransactionMoney(
  tx: ExternalProviderTransaction,
  categoryMap?: Map<string, ExternalProviderCategory>,
  accountMap?: Map<string, ExternalProviderCategory>,
  defaultCurrency = "PLN",
): ResolvedTransactionMoney {
  const normDefault = defaultCurrency.trim().toUpperCase() || "PLN";

  const sourceEntity =
    (tx.sourceId ? (accountMap?.get(tx.sourceId) ?? categoryMap?.get(tx.sourceId)) : undefined) ?? undefined;
  const destEntity =
    (tx.destinationId ? (categoryMap?.get(tx.destinationId) ?? accountMap?.get(tx.destinationId)) : undefined) ??
    undefined;

  const sourceCurrency =
    tx.sourceCurrencyId && tx.sourceCurrencyId.trim().length > 0
      ? tx.sourceCurrencyId.trim().toUpperCase()
      : resolveCategoryCurrency(sourceEntity, normDefault);

  const destCurrency =
    tx.destinationCurrencyId && tx.destinationCurrencyId.trim().length > 0
      ? tx.destinationCurrencyId.trim().toUpperCase()
      : resolveCategoryCurrency(destEntity, normDefault);

  const rawSource = tx.sourceAmount != null ? Math.abs(Number(tx.sourceAmount)) : undefined;
  const rawDest = tx.destinationAmount != null ? Math.abs(Number(tx.destinationAmount)) : undefined;
  const rawDefault = tx.defaultAmount != null ? Math.abs(Number(tx.defaultAmount)) : undefined;

  const fallbackAmount = rawDest ?? rawSource ?? rawDefault ?? 0;
  const sourceRaw = rawSource ?? fallbackAmount;
  const destRaw = rawDest ?? fallbackAmount;

  const sourceMoney: MoneyAmount = {
    amount: sourceRaw,
    currency: sourceCurrency,
  };

  const destMoney: MoneyAmount = {
    amount: destRaw,
    currency: destCurrency,
  };

  // Determine transaction classification
  const destType = tx.destinationType ?? (destEntity ? Number(destEntity.categoryType) : undefined);
  const sourceType = tx.sourceType ?? (sourceEntity ? Number(sourceEntity.categoryType) : undefined);

  const isExpense =
    destType === CategoryType.Expense || destType === CategoryType.Goal || destType === CategoryType.ClassicGoal;
  const isIncome = sourceType === CategoryType.Income;

  let primaryMoney = destMoney;

  if (isExpense) {
    // If destination is default currency (e.g. Taxi PLN) but source is foreign (e.g. EUR Card),
    // foreign source takes precedence as the primary monetary amount.
    if (destCurrency === normDefault && sourceCurrency !== normDefault) {
      primaryMoney = sourceMoney.amount > 0 ? sourceMoney : destMoney;
    } else {
      primaryMoney = destMoney.amount > 0 ? destMoney : sourceMoney;
    }
  } else if (isIncome) {
    // For income, source is the income category (e.g. $5,000 USD from Client ACME)
    if (sourceCurrency !== normDefault || destCurrency === normDefault) {
      primaryMoney = sourceMoney.amount > 0 ? sourceMoney : destMoney;
    } else {
      primaryMoney = destMoney.amount > 0 ? destMoney : sourceMoney;
    }
  } else {
    // For transfers: if one side represents a foreign currency relative to default currency,
    // preserve that foreign side as primary (e.g. Kantor USD destination, or foreign account source).
    if (destCurrency !== normDefault && sourceCurrency === normDefault) {
      primaryMoney = destMoney.amount > 0 ? destMoney : sourceMoney;
    } else if (sourceCurrency !== normDefault && destCurrency === normDefault) {
      primaryMoney = sourceMoney.amount > 0 ? sourceMoney : destMoney;
    } else {
      primaryMoney = destMoney.amount > 0 ? destMoney : sourceMoney;
    }
  }

  return {
    source: sourceMoney,
    destination: destMoney,
    primary: primaryMoney,
  };
}

/**
 * Formats a monetary amount or MoneyAmount object with its currency symbol/code.
 */
export function formatMoney(amountOrMoney: number | MoneyAmount, currency = "PLN"): string {
  const amount = typeof amountOrMoney === "number" ? amountOrMoney : amountOrMoney.amount;
  const rawCurrency = typeof amountOrMoney === "number" ? (currency ?? "PLN") : amountOrMoney.currency;
  const normalizedCurrency = rawCurrency?.trim().toUpperCase() || "PLN";

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
