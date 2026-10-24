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
