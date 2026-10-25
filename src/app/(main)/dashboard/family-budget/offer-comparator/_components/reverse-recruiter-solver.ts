/**
 * Reverse Recruiter Quick-Quote Solver
 *
 * Solves backwards from a Target Net Monthly Cashflow (PLN) to the
 * Required Gross Quote across B2B Hourly (Unpaid PTO vs. Paid PTO),
 * B2B Monthly (Ryczałt vs. Liniowy), and UoP (0% vs. 50% AKUP)
 * in PLN, USD, and EUR using monotone binary search.
 */

import { DEFAULT_COMPARATOR_CONFIG, resolveEffectiveFxRate } from "./compensation-engine";
import type { ComparatorGlobalConfig, TaxProfile } from "./offer-types";
import { computeAnnualTaxBreakdown } from "./polish-tax-engine";

export type RecruiterContractScenario =
  | "b2b_hourly_unpaid_pto"
  | "b2b_hourly_paid_pto"
  | "b2b_monthly_ryczalt"
  | "b2b_monthly_liniowy"
  | "uop_monthly_standard"
  | "uop_monthly_akup";

export interface RecruiterScenarioConfig {
  id: RecruiterContractScenario;
  label: string;
  contractType: "b2b_hourly" | "b2b_monthly" | "uop";
  taxProfile: TaxProfile;
  annualBillableHours: number;
}

export function getDefaultScenarioProfiles(
  config: ComparatorGlobalConfig = DEFAULT_COMPARATOR_CONFIG,
): Record<RecruiterContractScenario, RecruiterScenarioConfig> {
  const hoursPerDay = config.workingHoursPerDay || 8;
  const standardWeekdays = config.defaultWorkingDaysPerYear || 252;

  // Unpaid PTO (Model C): 24 vacation + 5 sick + 13 holidays = 42 days off -> 210 days * 8h = 1680h
  const unpaidWorkingDays = Math.max(0, standardWeekdays - 42);
  const unpaidBillableHours = unpaidWorkingDays * hoursPerDay;

  // Paid PTO (Model A/B): full 252 days paid = 2016h
  const paidBillableHours = standardWeekdays * hoursPerDay;

  return {
    b2b_hourly_unpaid_pto: {
      id: "b2b_hourly_unpaid_pto",
      label: "B2B Hourly (Unpaid PTO ~42d off)",
      contractType: "b2b_hourly",
      annualBillableHours: unpaidBillableHours,
      taxProfile: {
        regime: "b2b_ryczalt",
        ryczaltRatePct: 12,
        zusStage: "duzy_zus",
        monthlyAccountingCostPln: 250,
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      },
    },
    b2b_hourly_paid_pto: {
      id: "b2b_hourly_paid_pto",
      label: "B2B Hourly (Paid PTO / Retainer)",
      contractType: "b2b_hourly",
      annualBillableHours: paidBillableHours,
      taxProfile: {
        regime: "b2b_ryczalt",
        ryczaltRatePct: 12,
        zusStage: "duzy_zus",
        monthlyAccountingCostPln: 250,
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      },
    },
    b2b_monthly_ryczalt: {
      id: "b2b_monthly_ryczalt",
      label: "B2B Monthly Ryczałt (12%)",
      contractType: "b2b_monthly",
      annualBillableHours: paidBillableHours,
      taxProfile: {
        regime: "b2b_ryczalt",
        ryczaltRatePct: 12,
        zusStage: "duzy_zus",
        monthlyAccountingCostPln: 250,
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      },
    },
    b2b_monthly_liniowy: {
      id: "b2b_monthly_liniowy",
      label: "B2B Monthly Liniowy (19% + 4.9%)",
      contractType: "b2b_monthly",
      annualBillableHours: paidBillableHours,
      taxProfile: {
        regime: "b2b_liniowy",
        pitRatePct: 19,
        healthRatePct: 4.9,
        monthlyDeductibleCostsPln: 500,
        monthlyAccountingCostPln: 250,
        zusStage: "duzy_zus",
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      },
    },
    uop_monthly_standard: {
      id: "uop_monthly_standard",
      label: "UoP Standard (0% AKUP)",
      contractType: "uop",
      annualBillableHours: paidBillableHours,
      taxProfile: {
        regime: "uop",
        hasAkup: false,
        creativeWorkPct: 0,
        ppkEmployeePct: 2,
        ppkEmployerPct: 1.5,
        jointTaxFiling: false,
        disabilityRights: { enabled: false, statutoryHoursPerWeek: 35, extraVacationDays: 10 },
      },
    },
    uop_monthly_akup: {
      id: "uop_monthly_akup",
      label: "UoP with 50% AKUP (80% Creative)",
      contractType: "uop",
      annualBillableHours: paidBillableHours,
      taxProfile: {
        regime: "uop",
        hasAkup: true,
        creativeWorkPct: 80,
        ppkEmployeePct: 2,
        ppkEmployerPct: 1.5,
        jointTaxFiling: false,
        disabilityRights: { enabled: false, statutoryHoursPerWeek: 35, extraVacationDays: 10 },
      },
    },
  };
}

export interface SolvedGrossQuote {
  scenarioId: RecruiterContractScenario;
  scenarioLabel: string;
  currency: string;
  targetNetMonthlyPln: number;
  solvedAnnualGrossPln: number;
  solvedMonthlyGrossPln: number;
  // Quotes in the requested currency (after FX & pessimistic buffer)
  quoteHourly: number;
  quoteMonthly: number;
  quoteAnnual: number;
  effectiveExchangeRate: number;
  verifiedMonthlyNetPln: number;
  errorPln: number;
}

/**
 * Solves for the required Annual Gross in PLN using a 32-step binary search over [0, 10,000,000 PLN].
 */
export function solveGrossPlnForTargetNet(
  targetNetMonthlyPln: number,
  taxProfile: TaxProfile,
  maxIterations = 32,
): number {
  if (targetNetMonthlyPln <= 0) return 0;

  const targetAnnualNetPln = targetNetMonthlyPln * 12;

  let low = 0;
  let high = 10_000_000; // 10 million PLN search space covers even massive C-level salaries

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const { annualNetCashflowPln } = computeAnnualTaxBreakdown(mid, taxProfile, 1);

    if (annualNetCashflowPln < targetAnnualNetPln) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Solves a single recruiter quote scenario in a specific currency.
 */
export function solveRecruiterQuote(
  targetNetMonthlyPln: number,
  scenario: RecruiterScenarioConfig,
  currency: "PLN" | "USD" | "EUR" | string = "PLN",
  config: ComparatorGlobalConfig = DEFAULT_COMPARATOR_CONFIG,
  liveRates?: Record<string, number>,
): SolvedGrossQuote {
  const solvedAnnualGrossPln = solveGrossPlnForTargetNet(targetNetMonthlyPln, scenario.taxProfile);
  const solvedMonthlyGrossPln = solvedAnnualGrossPln / 12;

  const { effectiveRate } = resolveEffectiveFxRate(currency, config, liveRates);
  const annualGrossInCurrency = effectiveRate > 0 ? solvedAnnualGrossPln / effectiveRate : 0;
  const monthlyGrossInCurrency = annualGrossInCurrency / 12;
  const hourlyGrossInCurrency =
    scenario.annualBillableHours > 0 ? annualGrossInCurrency / scenario.annualBillableHours : 0;

  const verification = computeAnnualTaxBreakdown(solvedAnnualGrossPln, scenario.taxProfile, 1);
  const verifiedMonthlyNetPln = verification.monthlyNetCashflowPln;
  const errorPln = Math.abs(verifiedMonthlyNetPln - targetNetMonthlyPln);

  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    currency,
    targetNetMonthlyPln,
    solvedAnnualGrossPln,
    solvedMonthlyGrossPln,
    quoteHourly: hourlyGrossInCurrency,
    quoteMonthly: monthlyGrossInCurrency,
    quoteAnnual: annualGrossInCurrency,
    effectiveExchangeRate: effectiveRate,
    verifiedMonthlyNetPln,
    errorPln,
  };
}

export interface QuickQuoteMatrixRow {
  scenarioId: RecruiterContractScenario;
  scenarioLabel: string;
  contractType: "b2b_hourly" | "b2b_monthly" | "uop";
  pln: { hourly: number; monthly: number };
  usd: { hourly: number; monthly: number };
  eur: { hourly: number; monthly: number };
}

/**
 * Generates the full 6-scenario Quick Quote Cheat Sheet across PLN, USD, and EUR.
 */
export function generateQuickQuoteMatrix(
  targetNetMonthlyPln: number,
  config: ComparatorGlobalConfig = DEFAULT_COMPARATOR_CONFIG,
  liveRates?: Record<string, number>,
): QuickQuoteMatrixRow[] {
  const scenarios = getDefaultScenarioProfiles(config);
  const scenarioKeys = Object.keys(scenarios) as RecruiterContractScenario[];

  return scenarioKeys.map((key) => {
    const sc = scenarios[key];
    const plnQuote = solveRecruiterQuote(targetNetMonthlyPln, sc, "PLN", config, liveRates);
    const usdQuote = solveRecruiterQuote(targetNetMonthlyPln, sc, "USD", config, liveRates);
    const eurQuote = solveRecruiterQuote(targetNetMonthlyPln, sc, "EUR", config, liveRates);

    return {
      scenarioId: sc.id,
      scenarioLabel: sc.label,
      contractType: sc.contractType,
      pln: { hourly: plnQuote.quoteHourly, monthly: plnQuote.quoteMonthly },
      usd: { hourly: usdQuote.quoteHourly, monthly: usdQuote.quoteMonthly },
      eur: { hourly: eurQuote.quoteHourly, monthly: eurQuote.quoteMonthly },
    };
  });
}
