import { addMonths, isValid, parseISO, startOfMonth } from "date-fns";

import { type ExternalProviderTransaction, getTransactionTimestamp } from "./external-provider-data";

export type MonthIncompleteReason = "current_month" | "no_subsequent_transactions";

export interface EvaluateMonthCompletenessInput {
  activeMonthDateStr: string;
  transactions?: ExternalProviderTransaction[];
  hasActivity?: boolean;
  referenceDate?: Date;
}

export interface MonthCompletenessResult {
  isIncomplete: boolean;
  reason: MonthIncompleteReason | null;
}

/**
 * Returns a human-friendly description for why a month is flagged as incomplete.
 */
export function getMonthIncompleteDescription(reason: MonthIncompleteReason | null | undefined): string {
  if (reason === "current_month") {
    return "This calendar month is currently in progress. Final spending totals may change as new transactions occur.";
  }
  if (reason === "no_subsequent_transactions") {
    return "Transactions ceased before the following calendar month. Recorded figures may reflect a partial or cutoff period.";
  }
  return "";
}

/**
 * Evaluates whether an active month with recorded activity is incomplete.
 * A month is incomplete if:
 * 1. It is the current calendar month in progress (`activeMonth == currentMonth`), or
 * 2. There are no recorded non-deleted transactions in any subsequent calendar month (`hasTransactionsInFollowingMonth == false`).
 */
export function evaluateMonthCompleteness({
  activeMonthDateStr,
  transactions = [],
  hasActivity = true,
  referenceDate,
}: EvaluateMonthCompletenessInput): MonthCompletenessResult {
  if (!hasActivity) {
    return { isIncomplete: false, reason: null };
  }

  const parsed = parseISO(activeMonthDateStr);
  const targetDate = isValid(parsed) ? parsed : new Date(activeMonthDateStr);
  if (!isValid(targetDate)) {
    return { isIncomplete: false, reason: null };
  }

  const ref = referenceDate ?? new Date();
  const targetMonthStart = startOfMonth(targetDate);
  const currentMonthStart = startOfMonth(ref);

  // 1. Current calendar month in progress
  if (targetMonthStart.getTime() === currentMonthStart.getTime()) {
    return { isIncomplete: true, reason: "current_month" };
  }

  // 2. Historical cutoff check: verify if non-deleted transactions exist in any following month
  const followingMonthStart = startOfMonth(addMonths(targetMonthStart, 1));
  const hasTransactionsInFollowingMonth = transactions.some((tx) => {
    if (tx.deleted) return false;
    const ts = getTransactionTimestamp(tx);
    return ts !== null && ts >= followingMonthStart.getTime();
  });

  if (!hasTransactionsInFollowingMonth) {
    return { isIncomplete: true, reason: "no_subsequent_transactions" };
  }

  return { isIncomplete: false, reason: null };
}
