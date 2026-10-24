import { BASE_CPI_MONTH, getMacroData } from "./macro-data";

export type ReportingCurrency = "PLN" | "USD";

export interface MacroTimelinePoint {
  dateStr: string; // "YYYY-MM-DD"
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // e.g. "Jan 24"
  timestamp: number;
  cpiIndex: number;
  cpiYoyPercent: number;
  usdPlnRate: number;
  // Nominal values in base currency (PLN)
  rawNominalIncomePln: number;
  rawControllableExpensePln: number;
  rawMarginPln: number;
  // Values converted into active reporting currency
  nominalIncome: number;
  realIncome: number; // Deflated by CPI relative to base month
  purchasingPowerLoss: number; // Nominal minus Real
  purchasingPowerLossPercent: number; // Percentage erosion
  controllableExpense: number;
  realControllableExpense: number;
  nominalMargin: number;
  realMargin: number;
  savingsRate: number;
}

/**
 * Calculates Real Purchasing Power adjusted for cumulative CPI inflation.
 * Formula: Real = Nominal * (baseCpiIndex / currentCpiIndex)
 */
export function calculateRealValue(
  nominalAmount: number,
  currentMonthKey: string,
  baseMonthKey = BASE_CPI_MONTH,
): number {
  const currentMacro = getMacroData(currentMonthKey);
  const baseMacro = getMacroData(baseMonthKey);

  if (currentMacro.cpiIndex <= 0) return nominalAmount;
  return (nominalAmount * baseMacro.cpiIndex) / currentMacro.cpiIndex;
}

/**
 * Converts monetary amount between PLN and USD using historical monthly exchange rate.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: ReportingCurrency,
  toCurrency: ReportingCurrency,
  monthKey: string,
): number {
  if (fromCurrency === toCurrency) return amount;
  const { usdPlnRate } = getMacroData(monthKey);
  if (usdPlnRate <= 0) return amount;

  if (fromCurrency === "PLN" && toCurrency === "USD") {
    return amount / usdPlnRate;
  }
  if (fromCurrency === "USD" && toCurrency === "PLN") {
    return amount * usdPlnRate;
  }
  return amount;
}

export interface FxSensitivityInput {
  usdSalaryGross: number;
  usdPlnRate: number;
  taxRatePct: number;
  monthlyExpensesPln: number;
}

export interface FxSensitivityResult {
  usdSalaryGross: number;
  usdPlnRate: number;
  taxRatePct: number;
  projectedPlnGross: number;
  projectedPlnTax: number;
  projectedPlnNet: number;
  monthlyExpensesPln: number;
  projectedPlnMargin: number;
  projectedSavingsRate: number; // %
  expenseCoverageRatio: number; // multiplier (e.g. 1.8x)
  breakevenFxRate: number; // USD/PLN rate where net income exactly covers expenses
}

export interface FxScenarioStep {
  fxRate: number;
  projectedPlnNet: number;
  projectedPlnMargin: number;
  savingsRate: number;
  isBaseline?: boolean;
}

/**
 * Calculates forward USD/PLN income projection and margin against PLN expenses.
 */
export function simulateUsdIncome(input: FxSensitivityInput): FxSensitivityResult {
  const { usdSalaryGross, usdPlnRate, taxRatePct, monthlyExpensesPln } = input;

  const projectedPlnGross = usdSalaryGross * usdPlnRate;
  const effectiveTaxPct = Math.max(0, Math.min(100, taxRatePct));
  const projectedPlnTax = projectedPlnGross * (effectiveTaxPct / 100);
  const projectedPlnNet = projectedPlnGross - projectedPlnTax;
  const projectedPlnMargin = projectedPlnNet - monthlyExpensesPln;
  const projectedSavingsRate = projectedPlnNet > 0 ? (projectedPlnMargin / projectedPlnNet) * 100 : 0;
  const expenseCoverageRatio = monthlyExpensesPln > 0 ? projectedPlnNet / monthlyExpensesPln : 0;

  // Breakeven rate where: usdSalaryGross * rate * (1 - taxRatePct/100) = monthlyExpensesPln
  const netMultiplier = 1 - effectiveTaxPct / 100;
  const breakevenFxRate =
    usdSalaryGross > 0 && netMultiplier > 0 ? monthlyExpensesPln / (usdSalaryGross * netMultiplier) : 0;

  return {
    usdSalaryGross,
    usdPlnRate,
    taxRatePct,
    projectedPlnGross,
    projectedPlnTax,
    projectedPlnNet,
    monthlyExpensesPln,
    projectedPlnMargin,
    projectedSavingsRate,
    expenseCoverageRatio,
    breakevenFxRate,
  };
}

/**
 * Generates sensitivity scenarios across a range of FX rates (e.g. 3.50 to 4.80)
 */
export function generateFxScenarios(
  usdSalaryGross: number,
  taxRatePct: number,
  monthlyExpensesPln: number,
  currentRate = 3.95,
  steps = [3.5, 3.75, 4.0, 4.25, 4.5, 4.8],
): FxScenarioStep[] {
  // Ensure the current rate is included in the sequence if not already close
  const allRates = Array.from(new Set([...steps, currentRate])).sort((a, b) => a - b);

  return allRates.map((rate) => {
    const sim = simulateUsdIncome({
      usdSalaryGross,
      usdPlnRate: rate,
      taxRatePct,
      monthlyExpensesPln,
    });
    return {
      fxRate: rate,
      projectedPlnNet: sim.projectedPlnNet,
      projectedPlnMargin: sim.projectedPlnMargin,
      savingsRate: sim.projectedSavingsRate,
      isBaseline: Math.abs(rate - currentRate) < 0.01,
    };
  });
}
