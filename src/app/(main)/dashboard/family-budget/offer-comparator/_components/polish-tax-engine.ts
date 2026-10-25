/**
 * Polish Tax & Multi-Year ZUS Engine
 *
 * Implements deterministic calculations for:
 * 1. B2B Ryczałt (configurable rates, 3-tier Składka Zdrowotna, 50% health deduction, PFRON ZUS cashback)
 * 2. B2B Podatek Liniowy (19% PIT + 4.9% Zdrowotna)
 * 3. B2B Skala (12%/32% progressive + 9% Zdrowotna)
 * 4. UoP (Umowa o Pracę with 12-month cumulative 30x ZUS cap, 50% AKUP 120k cap, 12%/32% PIT, PPK, and disability rights)
 * 5. Custom fallback percentage + static fee
 * 6. Multi-Year (Years 1–3) ZUS stage progression & inflation indexing
 */

import type {
  AnnualTaxBreakdown,
  ComparatorGlobalConfig,
  MultiYearTaxProjection,
  PfronRebateConfig,
  TaxProfile,
  TaxProfileB2bLiniowy,
  TaxProfileB2bRyczalt,
  TaxProfileB2bSkala,
  TaxProfileCustom,
  TaxProfileUop,
  ZusStage,
} from "./offer-types";

// ---------------------------------------------------------------------------
// Baseline Statutory Constants (Year 1 Standard / 2024-2025 Baseline)
// ---------------------------------------------------------------------------

export const STATUTORY_DEFAULTS = {
  // Duży ZUS (Standard full ZUS base ~ 4,694.40 - 5,140.80 PLN)
  DUZY_ZUS_PENSION_DISABILITY_MONTHLY: 1291.9, // Emerytalne (19.52%) + Rentowe (8.00%) = 27.52%
  DUZY_ZUS_SICKNESS_MONTHLY: 115.01, // Chorobowe dobrowolne (2.45%)
  DUZY_ZUS_ACCIDENT_MONTHLY: 78.4, // Wypadkowe (1.67%)
  DUZY_ZUS_LABOR_FUND_MONTHLY: 115.01, // Fundusz Pracy / Solidarnościowy (2.45%)

  // Preferencyjny ZUS (Mały ZUS - 30% of minimum wage)
  PREF_ZUS_PENSION_DISABILITY_MONTHLY: 355.06,
  PREF_ZUS_SICKNESS_MONTHLY: 31.61,
  PREF_ZUS_ACCIDENT_MONTHLY: 21.54,
  PREF_ZUS_LABOR_FUND_MONTHLY: 0.0, // Exempt from FP when base < minimum wage

  // Ryczałt Health Contribution (Składka Zdrowotna) monthly amounts
  RYCZALT_HEALTH_TIER1_MONTHLY: 419.46, // <= 60k PLN revenue (60% avg wage * 9%)
  RYCZALT_HEALTH_TIER2_MONTHLY: 699.11, // 60k–300k PLN revenue (100% avg wage * 9%)
  RYCZALT_HEALTH_TIER3_MONTHLY: 1258.39, // > 300k PLN revenue (180% avg wage * 9%)

  // Revenue thresholds for Ryczałt health tiers
  RYCZALT_HEALTH_THRESHOLD_TIER1: 60000,
  RYCZALT_HEALTH_THRESHOLD_TIER2: 300000,

  // B2B Liniowy statutory minimum health contribution per month
  LINIOWY_MIN_HEALTH_MONTHLY: 381.78,
  // Annual cap on deductible health insurance for Liniowy
  LINIOWY_ANNUAL_HEALTH_DEDUCTION_CAP: 11600,

  // UoP Statutory Caps & Thresholds
  UOP_ANNUAL_30X_ZUS_CAP: 234720, // 30x average forecast salary
  UOP_ANNUAL_AKUP_CAP: 120000, // 50% AKUP annual deduction cap
  UOP_PIT_BRACKET_THRESHOLD: 120000, // 12% up to 120k, 32% above
  UOP_ANNUAL_TAX_FREE_REDUCTION: 3600, // Kwota zmniejszająca podatek (12% of 30,000 PLN)
  UOP_STANDARD_MONTHLY_KUP: 250, // Standard flat KUP when AKUP not applicable
} as const;

// ---------------------------------------------------------------------------
// ZUS Stage & Inflation Helpers
// ---------------------------------------------------------------------------

export interface ZusMonthlyAmounts {
  pensionDisability: number;
  sickness: number;
  accident: number;
  laborFund: number;
  totalSpoleczny: number;
}

/**
 * Calculates monthly ZUS Społeczny breakdown given stage, sickness preference, and inflation multiplier.
 */
export function getMonthlyZusSpoleczny(
  stage: ZusStage,
  voluntarySickness: boolean,
  inflationMultiplier = 1.0,
): ZusMonthlyAmounts {
  if (stage === "ulga_na_start") {
    return {
      pensionDisability: 0,
      sickness: 0,
      accident: 0,
      laborFund: 0,
      totalSpoleczny: 0,
    };
  }

  const isPref = stage === "preferencyjny";
  const penDis =
    (isPref
      ? STATUTORY_DEFAULTS.PREF_ZUS_PENSION_DISABILITY_MONTHLY
      : STATUTORY_DEFAULTS.DUZY_ZUS_PENSION_DISABILITY_MONTHLY) * inflationMultiplier;

  const sickness = voluntarySickness
    ? (isPref ? STATUTORY_DEFAULTS.PREF_ZUS_SICKNESS_MONTHLY : STATUTORY_DEFAULTS.DUZY_ZUS_SICKNESS_MONTHLY) *
      inflationMultiplier
    : 0;

  const accident =
    (isPref ? STATUTORY_DEFAULTS.PREF_ZUS_ACCIDENT_MONTHLY : STATUTORY_DEFAULTS.DUZY_ZUS_ACCIDENT_MONTHLY) *
    inflationMultiplier;

  const laborFund =
    (isPref ? STATUTORY_DEFAULTS.PREF_ZUS_LABOR_FUND_MONTHLY : STATUTORY_DEFAULTS.DUZY_ZUS_LABOR_FUND_MONTHLY) *
    inflationMultiplier;

  return {
    pensionDisability: penDis,
    sickness,
    accident,
    laborFund,
    totalSpoleczny: penDis + sickness + accident + laborFund,
  };
}

/**
 * Resolves the projected ZUS stage for years 1, 2, and 3.
 */
export function resolveZusStageForYear(initialStage: ZusStage, yearIndex: 1 | 2 | 3): ZusStage {
  if (yearIndex === 1) return initialStage;

  if (initialStage === "ulga_na_start") {
    // Year 2: Preferencyjny ZUS, Year 3: Preferencyjny ZUS (runs for 24 months)
    return "preferencyjny";
  }

  if (initialStage === "preferencyjny") {
    // Year 2: Duży ZUS, Year 3: Duży ZUS
    return "duzy_zus";
  }

  return "duzy_zus";
}

/**
 * Computes the monthly PFRON ZUS cash rebate amount for an entrepreneur with a disability.
 * Credits either a % of mandatory Pension + Disability ZUS or a fixed PLN/month.
 */
export function computeMonthlyPfronRebate(pfronConfig: PfronRebateConfig, pensionDisabilityMonthly: number): number {
  if (!pfronConfig.enabled || pensionDisabilityMonthly <= 0) {
    return 0;
  }

  if (pfronConfig.type === "fixed_pln") {
    return Math.min(pfronConfig.fixedAmountPln, pensionDisabilityMonthly);
  }

  // percentage type
  const pct = Math.max(0, Math.min(100, pfronConfig.percentage)) / 100;
  return pensionDisabilityMonthly * pct;
}

// ---------------------------------------------------------------------------
// 1. B2B Ryczałt Calculator
// ---------------------------------------------------------------------------

export function calculateB2bRyczaltTaxes(
  annualGrossRevenuePln: number,
  profile: TaxProfileB2bRyczalt,
  yearIndex: 1 | 2 | 3 = 1,
  annualGrowthRate = 0.07,
): AnnualTaxBreakdown {
  const inflationMultiplier = (1 + annualGrowthRate) ** (yearIndex - 1);
  const activeStage = resolveZusStageForYear(profile.zusStage, yearIndex);

  const monthlyZus = getMonthlyZusSpoleczny(activeStage, profile.voluntarySickness, inflationMultiplier);
  const annualZusSpoleczny = monthlyZus.totalSpoleczny * 12;

  // PFRON rebate (refunds pension + disability ZUS)
  const monthlyPfronRebate = computeMonthlyPfronRebate(profile.pfronRebate, monthlyZus.pensionDisability);
  const annualPfronRebate = monthlyPfronRebate * 12;
  const annualNetZusSpoleczny = Math.max(0, annualZusSpoleczny - annualPfronRebate);

  // 3-Tier Health Contribution based on annual revenue
  let monthlyHealth: number;
  if (annualGrossRevenuePln <= STATUTORY_DEFAULTS.RYCZALT_HEALTH_THRESHOLD_TIER1) {
    monthlyHealth = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY * inflationMultiplier;
  } else if (annualGrossRevenuePln <= STATUTORY_DEFAULTS.RYCZALT_HEALTH_THRESHOLD_TIER2) {
    monthlyHealth = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY * inflationMultiplier;
  } else {
    monthlyHealth = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY * inflationMultiplier;
  }
  const annualHealth = monthlyHealth * 12;

  // Ryczałt Tax Base: Revenue - ZUS Społeczny (gross paid) - 50% Zdrowotna
  const deductibleHealth = 0.5 * annualHealth;
  const taxableBase = Math.max(0, annualGrossRevenuePln - annualZusSpoleczny - deductibleHealth);
  const ryczaltRate = Math.max(0, profile.ryczaltRatePct) / 100;
  const annualPit = taxableBase * ryczaltRate;

  const annualAccounting = Math.max(0, profile.monthlyAccountingCostPln) * 12 * inflationMultiplier;

  // Total deductions: Net ZUS (after PFRON rebate) + Health + PIT + Accounting
  const totalDeductions = annualNetZusSpoleczny + annualHealth + annualPit + annualAccounting;
  const annualNetCashflow = annualGrossRevenuePln - totalDeductions;

  return {
    annualGrossPln: annualGrossRevenuePln,
    annualZusSpolecznyPln: annualZusSpoleczny,
    annualPfronRebatePln: annualPfronRebate,
    annualNetZusSpolecznyPln: annualNetZusSpoleczny,
    annualHealthInsurancePln: annualHealth,
    annualPitPln: annualPit,
    annualAccountingCostPln: annualAccounting,
    annualPpkEmployeePln: 0,
    annualPpkEmployerPln: 0,
    annualTotalTaxesAndContributionsPln: totalDeductions,
    annualNetCashflowPln: annualNetCashflow,
    monthlyNetCashflowPln: annualNetCashflow / 12,
    effectiveTaxRatePct: annualGrossRevenuePln > 0 ? (totalDeductions / annualGrossRevenuePln) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 2. B2B Podatek Liniowy Calculator
// ---------------------------------------------------------------------------

export function calculateB2bLiniowyTaxes(
  annualGrossRevenuePln: number,
  profile: TaxProfileB2bLiniowy,
  yearIndex: 1 | 2 | 3 = 1,
  annualGrowthRate = 0.07,
): AnnualTaxBreakdown {
  const inflationMultiplier = (1 + annualGrowthRate) ** (yearIndex - 1);
  const activeStage = resolveZusStageForYear(profile.zusStage, yearIndex);

  const monthlyZus = getMonthlyZusSpoleczny(activeStage, profile.voluntarySickness, inflationMultiplier);
  const annualZusSpoleczny = monthlyZus.totalSpoleczny * 12;

  const monthlyPfronRebate = computeMonthlyPfronRebate(profile.pfronRebate, monthlyZus.pensionDisability);
  const annualPfronRebate = monthlyPfronRebate * 12;
  const annualNetZusSpoleczny = Math.max(0, annualZusSpoleczny - annualPfronRebate);

  const annualAccounting = Math.max(0, profile.monthlyAccountingCostPln) * 12 * inflationMultiplier;
  const annualDeductibleCosts = Math.max(0, profile.monthlyDeductibleCostsPln) * 12;

  // Health Insurance: 4.9% of income (revenue minus costs and ZUS), with monthly minimum
  const incomeBeforeHealth = Math.max(
    0,
    annualGrossRevenuePln - annualDeductibleCosts - annualAccounting - annualZusSpoleczny,
  );
  const healthRate = Math.max(0, profile.healthRatePct) / 100;
  const minAnnualHealth = STATUTORY_DEFAULTS.LINIOWY_MIN_HEALTH_MONTHLY * 12 * inflationMultiplier;
  const annualHealth = Math.max(minAnnualHealth, incomeBeforeHealth * healthRate);

  // Health deduction cap for Liniowy
  const deductibleHealth = Math.min(
    annualHealth,
    STATUTORY_DEFAULTS.LINIOWY_ANNUAL_HEALTH_DEDUCTION_CAP * inflationMultiplier,
  );
  const taxableIncome = Math.max(0, incomeBeforeHealth - deductibleHealth);
  const pitRate = Math.max(0, profile.pitRatePct) / 100;
  const annualPit = taxableIncome * pitRate;

  const totalDeductions = annualNetZusSpoleczny + annualHealth + annualPit + annualAccounting + annualDeductibleCosts;
  const annualNetCashflow = annualGrossRevenuePln - totalDeductions;

  return {
    annualGrossPln: annualGrossRevenuePln,
    annualZusSpolecznyPln: annualZusSpoleczny,
    annualPfronRebatePln: annualPfronRebate,
    annualNetZusSpolecznyPln: annualNetZusSpoleczny,
    annualHealthInsurancePln: annualHealth,
    annualPitPln: annualPit,
    annualAccountingCostPln: annualAccounting,
    annualPpkEmployeePln: 0,
    annualPpkEmployerPln: 0,
    annualTotalTaxesAndContributionsPln: totalDeductions,
    annualNetCashflowPln: annualNetCashflow,
    monthlyNetCashflowPln: annualNetCashflow / 12,
    effectiveTaxRatePct: annualGrossRevenuePln > 0 ? (totalDeductions / annualGrossRevenuePln) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 3. B2B Skala Calculator
// ---------------------------------------------------------------------------

export function calculateB2bSkalaTaxes(
  annualGrossRevenuePln: number,
  profile: TaxProfileB2bSkala,
  yearIndex: 1 | 2 | 3 = 1,
  annualGrowthRate = 0.07,
): AnnualTaxBreakdown {
  const inflationMultiplier = (1 + annualGrowthRate) ** (yearIndex - 1);
  const activeStage = resolveZusStageForYear(profile.zusStage, yearIndex);

  const monthlyZus = getMonthlyZusSpoleczny(activeStage, profile.voluntarySickness, inflationMultiplier);
  const annualZusSpoleczny = monthlyZus.totalSpoleczny * 12;

  const monthlyPfronRebate = computeMonthlyPfronRebate(profile.pfronRebate, monthlyZus.pensionDisability);
  const annualPfronRebate = monthlyPfronRebate * 12;
  const annualNetZusSpoleczny = Math.max(0, annualZusSpoleczny - annualPfronRebate);

  const annualAccounting = Math.max(0, profile.monthlyAccountingCostPln) * 12 * inflationMultiplier;
  const annualDeductibleCosts = Math.max(0, profile.monthlyDeductibleCostsPln) * 12;

  const income = Math.max(0, annualGrossRevenuePln - annualDeductibleCosts - annualAccounting - annualZusSpoleczny);

  // 9% Health Insurance on Skala (no deduction from income)
  const annualHealth = income * 0.09;

  // Progressive PIT: 12% up to 120,000 PLN minus 3,600 PLN kwota wolna; 32% above 120,000 PLN
  let annualPit = 0;
  if (income <= 30000) {
    annualPit = 0;
  } else if (income <= STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD) {
    annualPit = Math.max(0, income * 0.12 - STATUTORY_DEFAULTS.UOP_ANNUAL_TAX_FREE_REDUCTION);
  } else {
    const basePit =
      STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD * 0.12 - STATUTORY_DEFAULTS.UOP_ANNUAL_TAX_FREE_REDUCTION;
    const excess = income - STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD;
    annualPit = basePit + excess * 0.32;
  }

  const totalDeductions = annualNetZusSpoleczny + annualHealth + annualPit + annualAccounting + annualDeductibleCosts;
  const annualNetCashflow = annualGrossRevenuePln - totalDeductions;

  return {
    annualGrossPln: annualGrossRevenuePln,
    annualZusSpolecznyPln: annualZusSpoleczny,
    annualPfronRebatePln: annualPfronRebate,
    annualNetZusSpolecznyPln: annualNetZusSpoleczny,
    annualHealthInsurancePln: annualHealth,
    annualPitPln: annualPit,
    annualAccountingCostPln: annualAccounting,
    annualPpkEmployeePln: 0,
    annualPpkEmployerPln: 0,
    annualTotalTaxesAndContributionsPln: totalDeductions,
    annualNetCashflowPln: annualNetCashflow,
    monthlyNetCashflowPln: annualNetCashflow / 12,
    effectiveTaxRatePct: annualGrossRevenuePln > 0 ? (totalDeductions / annualGrossRevenuePln) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 4. UoP (Umowa o Pracę) 12-Month Cumulative Simulation
// ---------------------------------------------------------------------------

export function calculateUopTaxes(
  annualGrossSalaryPln: number,
  profile: TaxProfileUop,
  yearIndex: 1 | 2 | 3 = 1,
  annualGrowthRate = 0.07,
): AnnualTaxBreakdown {
  const inflationMultiplier = (1 + annualGrowthRate) ** (yearIndex - 1);
  const monthlyGross = annualGrossSalaryPln / 12;

  const cap30x = STATUTORY_DEFAULTS.UOP_ANNUAL_30X_ZUS_CAP * inflationMultiplier;
  const akupAnnualCap = STATUTORY_DEFAULTS.UOP_ANNUAL_AKUP_CAP;
  const pitBracket = profile.jointTaxFiling
    ? STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD * 2
    : STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD;
  const taxFreeReduction = profile.jointTaxFiling
    ? STATUTORY_DEFAULTS.UOP_ANNUAL_TAX_FREE_REDUCTION * 2
    : STATUTORY_DEFAULTS.UOP_ANNUAL_TAX_FREE_REDUCTION;

  let cumulativeGross = 0;
  let cumulativePensionDisabilityBase = 0;
  let cumulativeAkupDeduction = 0;
  let cumulativeTaxableIncome = 0;
  let cumulativePitPaid = 0;

  let totalEmployeeZus = 0;
  let totalHealth = 0;
  let totalPpkEmployee = 0;
  let totalPpkEmployer = 0;

  const ppkEmpRate = Math.max(0, profile.ppkEmployeePct) / 100;
  const ppkEmplrRate = Math.max(0, profile.ppkEmployerPct) / 100;
  const creativeWorkRate = Math.max(0, Math.min(100, profile.creativeWorkPct)) / 100;

  for (let m = 1; m <= 12; m++) {
    cumulativeGross += monthlyGross;

    // 1. ZUS Społeczny Employee:
    // Emerytalne 9.76%, Rentowe 1.50% (capped at 30x average forecast salary)
    // Chorobowe 2.45% (uncapped)
    const prevPenDisBase = cumulativePensionDisabilityBase;
    const newPenDisBase = Math.min(cap30x, prevPenDisBase + monthlyGross);
    const subjectToPenDis = Math.max(0, newPenDisBase - prevPenDisBase);
    cumulativePensionDisabilityBase = newPenDisBase;

    const emerytalne = subjectToPenDis * 0.0976;
    const rentowe = subjectToPenDis * 0.015;
    const chorobowe = monthlyGross * 0.0245;
    const monthEmployeeZus = emerytalne + rentowe + chorobowe;
    totalEmployeeZus += monthEmployeeZus;

    // 2. Health Insurance (9% of Gross - Employee ZUS)
    const healthBase = Math.max(0, monthlyGross - monthEmployeeZus);
    const monthHealth = healthBase * 0.09;
    totalHealth += monthHealth;

    // 3. PPK
    const monthPpkEmployee = monthlyGross * ppkEmpRate;
    const monthPpkEmployer = monthlyGross * ppkEmplrRate;
    totalPpkEmployee += monthPpkEmployee;
    totalPpkEmployer += monthPpkEmployer;

    // 4. KUP / 50% AKUP
    let monthKup = 0;
    if (profile.hasAkup && creativeWorkRate > 0) {
      const creativeGross = monthlyGross * creativeWorkRate;
      // Proportional ZUS deduction from creative portion
      const creativeZus = monthEmployeeZus * creativeWorkRate;
      const creativeBase = Math.max(0, creativeGross - creativeZus);
      const potentialAkup = creativeBase * 0.5;

      const remainingAkupCap = Math.max(0, akupAnnualCap - cumulativeAkupDeduction);
      const appliedAkup = Math.min(potentialAkup, remainingAkupCap);
      cumulativeAkupDeduction += appliedAkup;

      // Standard KUP for the non-creative portion
      const nonCreativeRate = 1 - creativeWorkRate;
      const nonCreativeKup = STATUTORY_DEFAULTS.UOP_STANDARD_MONTHLY_KUP * nonCreativeRate;
      monthKup = appliedAkup + nonCreativeKup;
    } else {
      monthKup = STATUTORY_DEFAULTS.UOP_STANDARD_MONTHLY_KUP;
    }

    // 5. Monthly Taxable Base (Employer PPK is taxable revenue for employee PIT)
    const monthTaxableIncome = Math.max(0, monthlyGross + monthPpkEmployer - monthEmployeeZus - monthKup);
    cumulativeTaxableIncome += monthTaxableIncome;

    // 6. Progressive Cumulative PIT Calculation
    let monthExpectedCumulativePit = 0;
    if (cumulativeTaxableIncome <= pitBracket) {
      monthExpectedCumulativePit = Math.max(0, cumulativeTaxableIncome * 0.12 - (taxFreeReduction / 12) * m);
    } else {
      const baseBracketPit = pitBracket * 0.12 - taxFreeReduction;
      const excess = cumulativeTaxableIncome - pitBracket;
      monthExpectedCumulativePit = baseBracketPit + excess * 0.32;
    }

    const monthPit = Math.max(0, monthExpectedCumulativePit - cumulativePitPaid);
    cumulativePitPaid += monthPit;
  }

  const annualPit = cumulativePitPaid;
  // Note: Direct PFRON ZUS cash rebate is 0 PLN on UoP
  const annualTotalDeductions = totalEmployeeZus + totalHealth + annualPit + totalPpkEmployee;
  const annualNetCashflow = annualGrossSalaryPln - annualTotalDeductions;

  return {
    annualGrossPln: annualGrossSalaryPln,
    annualZusSpolecznyPln: totalEmployeeZus,
    annualPfronRebatePln: 0,
    annualNetZusSpolecznyPln: totalEmployeeZus,
    annualHealthInsurancePln: totalHealth,
    annualPitPln: annualPit,
    annualAccountingCostPln: 0,
    annualPpkEmployeePln: totalPpkEmployee,
    annualPpkEmployerPln: totalPpkEmployer,
    annualTotalTaxesAndContributionsPln: annualTotalDeductions,
    annualNetCashflowPln: annualNetCashflow,
    monthlyNetCashflowPln: annualNetCashflow / 12,
    effectiveTaxRatePct: annualGrossSalaryPln > 0 ? (annualTotalDeductions / annualGrossSalaryPln) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// 5. Custom Fallback Calculator
// ---------------------------------------------------------------------------

export function calculateCustomTaxes(
  annualGrossPln: number,
  profile: TaxProfileCustom,
  yearIndex: 1 | 2 | 3 = 1,
  annualGrowthRate = 0.07,
): AnnualTaxBreakdown {
  const inflationMultiplier = (1 + annualGrowthRate) ** (yearIndex - 1);
  const taxPct = Math.max(0, profile.effectiveTaxRatePct) / 100;
  const annualPercentTax = annualGrossPln * taxPct;
  const annualStatic = Math.max(0, profile.staticMonthlyCostPln) * 12 * inflationMultiplier;

  const totalDeductions = annualPercentTax + annualStatic;
  const netCashflow = annualGrossPln - totalDeductions;

  return {
    annualGrossPln,
    annualZusSpolecznyPln: 0,
    annualPfronRebatePln: 0,
    annualNetZusSpolecznyPln: 0,
    annualHealthInsurancePln: 0,
    annualPitPln: annualPercentTax,
    annualAccountingCostPln: annualStatic,
    annualPpkEmployeePln: 0,
    annualPpkEmployerPln: 0,
    annualTotalTaxesAndContributionsPln: totalDeductions,
    annualNetCashflowPln: netCashflow,
    monthlyNetCashflowPln: netCashflow / 12,
    effectiveTaxRatePct: annualGrossPln > 0 ? (totalDeductions / annualGrossPln) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Unified Tax Dispatcher & Multi-Year Projection Engine
// ---------------------------------------------------------------------------

/**
 * Computes the annual tax breakdown for a specific projection year (Year 1, 2, or 3).
 */
export function computeAnnualTaxBreakdown(
  annualGrossPln: number,
  taxProfile: TaxProfile,
  yearIndex: 1 | 2 | 3 = 1,
  annualGrowthRate = 0.07,
): AnnualTaxBreakdown {
  switch (taxProfile.regime) {
    case "b2b_ryczalt":
      return calculateB2bRyczaltTaxes(annualGrossPln, taxProfile, yearIndex, annualGrowthRate);
    case "b2b_liniowy":
      return calculateB2bLiniowyTaxes(annualGrossPln, taxProfile, yearIndex, annualGrowthRate);
    case "b2b_skala":
      return calculateB2bSkalaTaxes(annualGrossPln, taxProfile, yearIndex, annualGrowthRate);
    case "uop":
      return calculateUopTaxes(annualGrossPln, taxProfile, yearIndex, annualGrowthRate);
    case "custom":
      return calculateCustomTaxes(annualGrossPln, taxProfile, yearIndex, annualGrowthRate);
  }
}

/**
 * Computes a comprehensive 3-year projection (Year 1, 2, and 3) including ZUS base growth
 * and stage transitions.
 */
export function computeMultiYearTaxProjection(
  annualGrossPln: number,
  taxProfile: TaxProfile,
  config?: Partial<ComparatorGlobalConfig>,
): MultiYearTaxProjection {
  const growthRate = config?.annualStaticCostGrowthPct ?? 0.07;

  return {
    year1: computeAnnualTaxBreakdown(annualGrossPln, taxProfile, 1, growthRate),
    year2: computeAnnualTaxBreakdown(annualGrossPln, taxProfile, 2, growthRate),
    year3: computeAnnualTaxBreakdown(annualGrossPln, taxProfile, 3, growthRate),
    zusBaseGrowthPct: growthRate * 100,
  };
}
