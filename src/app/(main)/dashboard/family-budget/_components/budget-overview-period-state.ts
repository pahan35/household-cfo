import type { CompareMode } from "./expense-transforms";

export const BUDGET_OVERVIEW_PERIOD_STORAGE_KEY = "family-budget:budget-overview-period-v1";

export interface BudgetOverviewPeriodState {
  month: string;
  compareMode: CompareMode;
  compareDate: string | null;
  traceCategory: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const COMPARE_TO_PARAM: Record<CompareMode, string> = {
  none: "none",
  prev_month: "prev",
  prev_year: "yoy",
  custom: "custom",
};

const PARAM_TO_COMPARE: Record<string, CompareMode> = {
  none: "none",
  prev: "prev_month",
  yoy: "prev_year",
  custom: "custom",
};

function validDate(value: string | null | undefined): string | null {
  if (!value || !DATE_RE.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function readStored(raw: string | null): Partial<BudgetOverviewPeriodState> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<BudgetOverviewPeriodState>;
    return typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Resolves the period/comparison state. Priority: URL search params, then localStorage, then defaults.
 */
export function resolveBudgetOverviewPeriodState(
  search: string,
  storedRaw: string | null,
  defaultMonth: string,
): BudgetOverviewPeriodState {
  const params = new URLSearchParams(search);
  const stored = readStored(storedRaw);

  const month = validDate(params.get("month")) ?? validDate(stored.month) ?? defaultMonth;

  const paramCompare = params.get("compare");
  const compareMode: CompareMode =
    (paramCompare ? PARAM_TO_COMPARE[paramCompare] : undefined) ??
    (stored.compareMode && stored.compareMode in COMPARE_TO_PARAM ? stored.compareMode : "none");

  const compareDate = validDate(params.get("compareDate")) ?? validDate(stored.compareDate);

  return {
    month,
    compareMode,
    compareDate: compareMode === "custom" ? compareDate : null,
    traceCategory: params.get("traceCategory") ?? null,
  };
}

/**
 * Applies the state onto a URL's search params (default values are still written so reloads are exact).
 */
export function applyBudgetOverviewPeriodToParams(params: URLSearchParams, state: BudgetOverviewPeriodState): void {
  params.set("month", state.month);
  params.set("compare", COMPARE_TO_PARAM[state.compareMode]);
  if (state.compareMode === "custom" && state.compareDate) {
    params.set("compareDate", state.compareDate);
  } else {
    params.delete("compareDate");
  }
  if (state.traceCategory) {
    params.set("traceCategory", state.traceCategory);
  } else {
    params.delete("traceCategory");
  }
}
