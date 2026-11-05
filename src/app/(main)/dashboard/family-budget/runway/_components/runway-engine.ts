import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  isAccountType,
  type StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import {
  type ExclusionPreset,
  type ExpenseSlice,
  groupSmartSlices,
} from "@/app/(main)/dashboard/family-budget/_components/expense-transforms";
import { getTaxCategoryIds, matchTaxBucket } from "@/app/(main)/dashboard/family-budget/_components/tax-transforms";
import {
  computeMonthlyPfronRebate,
  getMonthlyZusSpoleczny,
  STATUTORY_DEFAULTS,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/polish-tax-engine";

import type {
  AusterityPreset,
  CapitalPoolConfig,
  CapitalPoolItem,
  CapitalPoolSummary,
  CategoryAusterityItem,
  CategoryAusterityWeight,
  JdgRunwayConfig,
  LookbackWindow,
  RunwayCashflowRow,
  RunwayScenarioResult,
} from "./runway-types";

export const DEFAULT_VOLUNTARY_NFZ_PLN = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY; // 699.11 PLN

export const DEFAULT_JDG_RUNWAY_CONFIG: JdgRunwayConfig = {
  posture: "active",
  regime: "b2b_ryczalt",
  zusStage: "duzy_zus",
  voluntarySickness: true,
  ryczaltYtdHealthTier: "tier2",
  pfronRebate: {
    enabled: false,
    type: "percentage",
    percentage: 0,
    fixedAmountPln: 0,
  },
  monthlyAccountingCostPln: 250,
  suspendedAccountingCostPln: 50,
  voluntaryNfzWhenSuspended: false,
  statutoryVoluntaryNfzPln: DEFAULT_VOLUNTARY_NFZ_PLN,
  wakacjeMonthIndex: 12, // December by default
  includeMonth1TaxTail: true,
  month1Vat7Pln: 0,
  month1PpePln: 0,
  benefitLossReplacementPln: 0,
  residualMonthlyIncomePln: 0,
};

export const DEFAULT_CAPITAL_POOL_CONFIG: CapitalPoolConfig = {
  excludedItemIds: [],
  includeOffBalanceAccounts: true,
  includeGoals: false,
  safetyFloorPln: 10000,
  fxHaircutPct: 0,
};

export const BUILT_IN_AUSTERITY_PRESETS: AusterityPreset[] = [
  {
    id: "preset-normal",
    name: "Normal (100% Baseline)",
    isBuiltIn: true,
    weights: {},
  },
  {
    id: "preset-moderate",
    name: "Moderate Cut (-25% Controllable)",
    isBuiltIn: true,
    weights: {},
  },
  {
    id: "preset-survival",
    name: "Survival Mode (Fixed Only)",
    isBuiltIn: true,
    weights: {},
  },
];

// ---------------------------------------------------------------------------
// 1. Capital Pool Aggregation & Stress Buffer
// ---------------------------------------------------------------------------

export function calculateCapitalPool(items: CapitalPoolItem[], config: CapitalPoolConfig): CapitalPoolSummary {
  const excludedSet = new Set(config.excludedItemIds);
  let totalGrossPln = 0;
  let fxAdjustmentPln = 0;

  const evaluatedItems: CapitalPoolItem[] = items.map((item) => {
    let included = !excludedSet.has(item.id);

    if (item.isOffBalance && !config.includeOffBalanceAccounts) {
      included = false;
    }
    if (item.isGoal && !config.includeGoals) {
      included = false;
    }

    if (included) {
      totalGrossPln += item.convertedPln;

      const isNonPln = item.currencyCode.toUpperCase() !== "PLN";
      if (isNonPln && config.fxHaircutPct !== 0) {
        const haircutDiff = item.convertedPln * (config.fxHaircutPct / 100);
        fxAdjustmentPln += haircutDiff;
      }
    }

    return {
      ...item,
      included,
    };
  });

  const totalEffectiveCapital = Math.max(0, totalGrossPln + fxAdjustmentPln);
  const usableCapitalPln = Math.max(0, totalEffectiveCapital - Math.max(0, config.safetyFloorPln));

  return {
    totalGrossPln,
    fxAdjustmentPln,
    safetyFloorPln: Math.max(0, config.safetyFloorPln),
    usableCapitalPln,
    items: evaluatedItems,
  };
}

export function buildCapitalPoolItems(
  categories: ExternalProviderCategory[],
  currencies: ExternalProviderCurrency[],
  defaultCurrency = "PLN",
): CapitalPoolItem[] {
  const items: CapitalPoolItem[] = [];

  for (const cat of categories) {
    if (cat.deleted) continue;

    const rawType = Number(cat.categoryType);
    const isAccount = isAccountType(rawType);
    const isGoal = rawType === CategoryType.Goal || rawType === CategoryType.ClassicGoal;

    if (!isAccount && !isGoal) continue;

    const rawBalance = typeof cat.balance === "number" ? cat.balance : 0;
    const catCurrency = typeof cat.currency === "string" ? cat.currency : defaultCurrency;
    const convertedPln =
      catCurrency.toUpperCase() === defaultCurrency.toUpperCase()
        ? rawBalance
        : (convertCurrencyAmount(rawBalance, catCurrency, defaultCurrency, currencies) ?? rawBalance);

    items.push({
      id: cat.id,
      name: cat.name,
      categoryType: rawType,
      accountType: typeof cat.accountType === "string" ? cat.accountType : undefined,
      nativeBalance: rawBalance,
      currencyCode: catCurrency,
      convertedPln,
      included: true,
      isOffBalance: Boolean(cat.exceptFromBalance),
      isGoal,
    });
  }

  // Sort descending by converted value
  return items.sort((a, b) => b.convertedPln - a.convertedPln);
}

// ---------------------------------------------------------------------------
// 2. Historical Category Burn Aggregation Without Tax Double-Counting
// ---------------------------------------------------------------------------

export function computeHistoricalCategoryBurn(params: {
  statPoints: StatPoint[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  lookbackWindow: LookbackWindow;
  activePreset?: ExclusionPreset;
  defaultCurrency?: string;
}): CategoryAusterityItem[] {
  const { statPoints, categories, currencies, lookbackWindow, activePreset, defaultCurrency = "PLN" } = params;

  if (statPoints.length === 0) {
    return [];
  }

  // 1. Identify all tax categories to strictly exclude them from living expenses
  const taxCategoryIds = getTaxCategoryIds(categories);
  if (activePreset?.incomeDeductions) {
    for (const id of activePreset.incomeDeductions) {
      taxCategoryIds.add(id);
    }
  }

  // 2. Determine number of months to evaluate from lookbackWindow
  let windowMonths = 3;
  if (lookbackWindow === "1m") {
    windowMonths = 1;
  } else if (lookbackWindow === "3m") {
    windowMonths = 3;
  } else if (lookbackWindow === "6m") {
    windowMonths = 6;
  } else if (lookbackWindow === "12m") {
    windowMonths = 12;
  }

  // Stat points are sorted newest-to-oldest or chronological; let's take the latest windowMonths points with valid category data
  const validPoints = statPoints
    .filter((p) => Array.isArray(p.categories) && p.categories.length > 0)
    .slice(-windowMonths);

  const evaluatedCount = Math.max(1, validPoints.length);

  // 3. Accumulate category spend across evaluated months
  const categorySpendSums = new Map<string, number>();

  const categoryMap = new Map<string, ExternalProviderCategory>(categories.map((c) => [c.id, c]));

  for (const pt of validPoints) {
    for (const cPt of pt.categories) {
      const catId = cPt.id;
      if (taxCategoryIds.has(catId)) continue;

      const catMeta = categoryMap.get(catId);
      if (catMeta) {
        if (catMeta.deleted) continue;
        const rawType = Number(catMeta.categoryType);
        if (rawType === CategoryType.Income || isAccountType(rawType)) continue;
      }

      const amount = Number(cPt.amount ?? cPt.value ?? 0);
      if (amount <= 0) continue;

      categorySpendSums.set(catId, (categorySpendSums.get(catId) ?? 0) + amount);
    }
  }

  // 4. Construct raw slices with average monthly burn
  const rawSlices: ExpenseSlice[] = [];
  for (const [catId, totalSpend] of categorySpendSums.entries()) {
    const catMeta = categoryMap.get(catId);
    const catName = catMeta?.name ?? `Category ${catId.slice(0, 6)}`;
    const avgMonthlySpend = totalSpend / evaluatedCount;

    if (avgMonthlySpend > 0) {
      rawSlices.push({
        id: catId,
        name: catName,
        amount: avgMonthlySpend,
        percentage: 0,
      });
    }
  }

  // 5. Run through groupSmartSlices with thresholdPercent = 0 so no categories are swallowed
  const groupedSlices = groupSmartSlices(rawSlices, 0, defaultCurrency, currencies);

  // 6. Map to CategoryAusterityItem and tag isFixed
  const fixedExpenseSet = new Set(activePreset?.expenseExclusions ?? []);

  const austerityItems: CategoryAusterityItem[] = groupedSlices.map((slice) => {
    const childIds = slice.children?.map((c) => c.id) ?? [slice.id];
    const isFixed = childIds.some((id) => fixedExpenseSet.has(id));

    return {
      id: slice.id,
      name: slice.name,
      baselineMonthlyBurnPln: slice.amount,
      retentionPct: 100,
      enabled: true,
      isFixed,
      childCategoryIds: childIds,
    };
  });

  return austerityItems.sort((a, b) => b.baselineMonthlyBurnPln - a.baselineMonthlyBurnPln);
}

export function calculateAusterityLivingBurn(
  items: CategoryAusterityItem[],
  weights: Record<string, CategoryAusterityWeight>,
): number {
  let totalBurn = 0;

  for (const item of items) {
    const w = weights[item.id] ?? { enabled: item.enabled, retentionPct: item.retentionPct };
    if (!w.enabled) continue;

    const retention = Math.max(0, Math.min(150, w.retentionPct)) / 100;
    totalBurn += item.baselineMonthlyBurnPln * retention;
  }

  return totalBurn;
}

// ---------------------------------------------------------------------------
// 3. Month-1 Tax Tail Detection from Recent Tax Transactions
// ---------------------------------------------------------------------------

export function detectLatestTaxOutflows(
  transactions: ExternalProviderTransaction[],
  currencies: ExternalProviderCurrency[],
  defaultCurrency = "PLN",
): { vat7Pln: number; ppePln: number; referenceMonth?: string } {
  let vat7Pln = 0;
  let ppePln = 0;
  let latestDate: Date | null = null;

  for (const tx of transactions) {
    if (tx.deleted || !Array.isArray(tx.tags)) continue;

    for (const tag of tx.tags) {
      if (typeof tag !== "string") continue;
      const bucket = matchTaxBucket(tag);
      if (!bucket) continue;

      const rawAmount = Math.abs(Number(tx.amount || 0));
      const txCurrency = typeof tx.currency === "string" ? tx.currency : defaultCurrency;
      const converted =
        txCurrency.toUpperCase() === defaultCurrency.toUpperCase()
          ? rawAmount
          : (convertCurrencyAmount(rawAmount, txCurrency, defaultCurrency, currencies) ?? rawAmount);

      if (bucket.id === "vat") {
        vat7Pln += converted;
      } else if (bucket.id === "ppe") {
        ppePln += converted;
      }

      if (typeof tx.date === "string" || typeof tx.date === "number" || tx.date instanceof Date) {
        const d = new Date(tx.date);
        if (!latestDate || d > latestDate) {
          latestDate = d;
        }
      }
    }
  }

  let referenceMonth: string | undefined;
  if (latestDate && !Number.isNaN(latestDate.getTime())) {
    referenceMonth = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, "0")}`;
  }

  return {
    vat7Pln,
    ppePln,
    referenceMonth,
  };
}

// ---------------------------------------------------------------------------
// 4. 60-Month Calendar-Aware Cashflow Projection Engine
// ---------------------------------------------------------------------------

export function projectRunwayScenario(params: {
  startingCapitalPln: number;
  jdgConfig: JdgRunwayConfig;
  monthlyLivingBurnPln: number;
  startYearMonth: string; // YYYY-MM
  maxMonths?: number;
}): RunwayScenarioResult {
  const { startingCapitalPln, jdgConfig, monthlyLivingBurnPln, startYearMonth, maxMonths = 60 } = params;

  const [startYearStr, startMonthStr] = startYearMonth.split("-");
  const parsedStartYear = Number(startYearStr) || new Date().getFullYear();
  const parsedStartMonth = Number(startMonthStr) || new Date().getMonth() + 1;

  let currentCapital = startingCapitalPln;
  const rows: RunwayCashflowRow[] = [];

  let firstDepletionIndex = -1;
  let depletionFraction = 0;

  for (let m = 1; m <= maxMonths; m++) {
    const monthOffset = m - 1;
    const simDate = new Date(parsedStartYear, parsedStartMonth - 1 + monthOffset, 1);
    const calendarYear = simDate.getFullYear();
    const calendarMonth = simDate.getMonth() + 1;
    const yearMonth = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}`;

    const startingBalancePln = currentCapital;

    // Month 1 lagged tax tail
    const month1TaxTailPln =
      m === 1 && jdgConfig.includeMonth1TaxTail
        ? Math.max(0, jdgConfig.month1Vat7Pln) + Math.max(0, jdgConfig.month1PpePln)
        : 0;

    let grossZusPln = 0;
    let pfronRebatePln = 0;
    let netZusPln = 0;
    let healthPln = 0;
    let isRyczaltTier1Reset = false;
    let isWakacjeSkladkoweMonth = false;
    let accountingPln = 0;

    if (jdgConfig.posture === "suspended") {
      grossZusPln = 0;
      pfronRebatePln = 0;
      netZusPln = 0;
      healthPln = jdgConfig.voluntaryNfzWhenSuspended ? Math.max(0, jdgConfig.statutoryVoluntaryNfzPln) : 0;
      accountingPln = Math.max(0, jdgConfig.suspendedAccountingCostPln);
    } else {
      // Active or Wakacje Składkowe
      if (jdgConfig.posture === "wakacje_skladkowe" && calendarMonth === jdgConfig.wakacjeMonthIndex) {
        isWakacjeSkladkoweMonth = true;
        grossZusPln = 0;
        pfronRebatePln = 0;
        netZusPln = 0;
      } else {
        const zus = getMonthlyZusSpoleczny(jdgConfig.zusStage, jdgConfig.voluntarySickness, 1.0);
        grossZusPln = zus.totalSpoleczny;
        pfronRebatePln = computeMonthlyPfronRebate(jdgConfig.pfronRebate, zus.pensionDisability);
        netZusPln = Math.max(0, grossZusPln - pfronRebatePln);
      }

      // Health Insurance (Składka Zdrowotna)
      if (jdgConfig.regime === "b2b_ryczalt") {
        // Calendar-Year Ryczałt Health Tier Reset
        // In the next calendar year, since JDG revenue is 0 forward, annual revenue <= 60k PLN, so resets to Tier 1
        if (calendarYear > parsedStartYear) {
          isRyczaltTier1Reset = jdgConfig.ryczaltYtdHealthTier !== "tier1";
          healthPln = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY;
        } else {
          if (jdgConfig.ryczaltYtdHealthTier === "tier1") {
            healthPln = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY;
          } else if (jdgConfig.ryczaltYtdHealthTier === "tier2") {
            healthPln = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY;
          } else {
            healthPln = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY;
          }
        }
      } else if (jdgConfig.regime === "b2b_liniowy") {
        healthPln = STATUTORY_DEFAULTS.LINIOWY_MIN_HEALTH_MONTHLY;
      } else {
        // b2b_skala min health
        healthPln = STATUTORY_DEFAULTS.LINIOWY_MIN_HEALTH_MONTHLY;
      }

      accountingPln = Math.max(0, jdgConfig.monthlyAccountingCostPln);
    }

    const benefitReplacementPln = Math.max(0, jdgConfig.benefitLossReplacementPln);
    const residualIncomePln = Math.max(0, jdgConfig.residualMonthlyIncomePln);

    const totalJdgObligationsPln = netZusPln + healthPln + accountingPln + month1TaxTailPln;
    const livingBurnPln = Math.max(0, monthlyLivingBurnPln);

    const totalOutflowsPln = totalJdgObligationsPln + livingBurnPln + benefitReplacementPln;
    const netCashflowPln = residualIncomePln - totalOutflowsPln;
    const endingBalancePln = startingBalancePln + netCashflowPln;
    const isDepleted = endingBalancePln <= 0;

    if (isDepleted && firstDepletionIndex === -1) {
      firstDepletionIndex = m;
      if (startingBalancePln > 0 && totalOutflowsPln > residualIncomePln) {
        depletionFraction = startingBalancePln / (totalOutflowsPln - residualIncomePln);
      }
    }

    rows.push({
      monthIndex: m,
      yearMonth,
      calendarYear,
      calendarMonth,
      startingBalancePln,
      grossZusPln,
      pfronRebatePln,
      netZusPln,
      healthPln,
      isRyczaltTier1Reset,
      isWakacjeSkladkoweMonth,
      accountingPln,
      month1TaxTailPln,
      totalJdgObligationsPln,
      livingBurnPln,
      benefitReplacementPln,
      residualIncomePln,
      netCashflowPln,
      endingBalancePln,
      isDepleted,
    });

    currentCapital = endingBalancePln;
  }

  const month1Row = rows[0];
  const month1OutflowPln = month1Row ? month1Row.totalJdgObligationsPln + month1Row.livingBurnPln : 0;
  const month1TaxTailAmount = month1Row ? month1Row.month1TaxTailPln : 0;
  const usableCapitalAfterTaxTailPln = Math.max(0, startingCapitalPln - month1TaxTailAmount);

  // Steady-state monthly burn (from month 2 if available)
  const steadyRow = rows[1] ?? rows[0];
  const ongoingMonthlyBurnPln = steadyRow
    ? steadyRow.totalJdgObligationsPln + steadyRow.livingBurnPln + steadyRow.benefitReplacementPln
    : 0;

  const isCashflowPositive = ongoingMonthlyBurnPln <= jdgConfig.residualMonthlyIncomePln;

  let runwayMonths = maxMonths;
  let exhaustionDate: string | null = null;
  let exhaustionYearMonth: string | null = null;

  if (firstDepletionIndex !== -1) {
    const completedMonths = firstDepletionIndex - 1;
    runwayMonths = Number((completedMonths + Math.min(1, Math.max(0, depletionFraction))).toFixed(1));

    const depletedRow = rows[firstDepletionIndex - 1];
    if (depletedRow) {
      exhaustionYearMonth = depletedRow.yearMonth;
      const monthDate = new Date(depletedRow.calendarYear, depletedRow.calendarMonth - 1, 1);
      exhaustionDate = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
  } else if (isCashflowPositive) {
    runwayMonths = maxMonths;
    exhaustionDate = "Cashflow Positive / 60+ Months";
  } else {
    runwayMonths = maxMonths;
    exhaustionDate = "60+ Months";
  }

  return {
    usableStartingCapitalPln: startingCapitalPln,
    usableCapitalAfterTaxTailPln,
    month1OutflowPln,
    ongoingMonthlyBurnPln,
    runwayMonths,
    exhaustionDate,
    exhaustionYearMonth,
    isCashflowPositive,
    rows,
  };
}
