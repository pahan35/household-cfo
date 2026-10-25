/**
 * Compensation, Time-Off & Benefit Normalization Engine
 *
 * Normalizes Hourly, Monthly, and Annual rates across PLN/USD/EUR,
 * models Time-Off policies (Models A, B, C), computes Two-Layer Benefit
 * and Equity valuations, simulates Fractional Side-Gigs with shared ZUS,
 * and calculates Restructure / Revision Impact Diffs.
 */

import { calculateRealValue } from "../../_components/macro-transforms";
import type {
  BenefitItem,
  ComparatorGlobalConfig,
  EquityGrant,
  NormalizedCompensationSummary,
  OfferRevision,
  RateSpecification,
  RestructureImpactDiff,
  SideGigAddon,
  TimeOffPolicy,
} from "./offer-types";
import { computeAnnualTaxBreakdown, computeMultiYearTaxProjection, STATUTORY_DEFAULTS } from "./polish-tax-engine";

export const DEFAULT_COMPARATOR_CONFIG: ComparatorGlobalConfig = {
  defaultWorkingDaysPerYear: 252,
  defaultStateHolidaysCount: 13,
  workingHoursPerDay: 8,
  annualStaticCostGrowthPct: 0.07,
  fxPessimisticBufferPct: {
    USD: 0.05,
    EUR: 0.03,
    PLN: 0.0,
  },
  manualFxOverrides: {},
  targetMonthlyExpensePln: 14000,
  targetMonthlySavingsPln: 6000,
  activeYearProjection: 1,
};

// ---------------------------------------------------------------------------
// 1. Currency & FX Conversion with Pessimistic Buffer
// ---------------------------------------------------------------------------

export function resolveEffectiveFxRate(
  currency: string,
  config: ComparatorGlobalConfig,
  liveRates?: Record<string, number>,
): { baseRate: number; bufferPct: number; effectiveRate: number } {
  const upper = currency.toUpperCase();
  if (upper === "PLN") {
    return { baseRate: 1.0, bufferPct: 0, effectiveRate: 1.0 };
  }

  // 1. Check manual override
  let baseRate: number | undefined = config.manualFxOverrides[upper];

  // 2. Check live rates from ExternalProvider
  if (baseRate === undefined && liveRates && liveRates[upper]) {
    baseRate = liveRates[upper];
  }

  // 3. Fallback defaults
  if (baseRate === undefined) {
    if (upper === "USD") baseRate = 4.0;
    else if (upper === "EUR") baseRate = 4.3;
    else if (upper === "GBP") baseRate = 5.1;
    else baseRate = 1.0;
  }

  const bufferPct = config.fxPessimisticBufferPct[upper] ?? 0;
  const effectiveRate = baseRate * (1 - bufferPct);

  return { baseRate, bufferPct, effectiveRate };
}

// ---------------------------------------------------------------------------
// 2. Time-Off Normalization & Annual Billable Hours
// ---------------------------------------------------------------------------

export interface TimeOffMetrics {
  annualPaidDays: number;
  effectiveWorkingDays: number;
  timeOffDaysTaken: number;
  hoursPerDay: number;
  annualBillableHours: number;
  unpaidDaysDeductionRatio: number; // For Model C monthly salaries
}

export function computeTimeOffMetrics(
  timeOff: TimeOffPolicy,
  hoursPerDay = 8,
  totalWeekdaysPerYear = 252,
  defaultStateHolidays = 13,
): TimeOffMetrics {
  if (timeOff.model === "model_a_separate") {
    const vacation = timeOff.paidVacationDays;
    const sick = timeOff.paidSickDays;
    const sickCoverage = (timeOff.sickPayPct ?? 80) / 100;
    const holidays = timeOff.paidStateHolidays ?? defaultStateHolidays;

    const totalDaysOff = vacation + sick + holidays;
    const effectiveWorkingDays = Math.max(0, totalWeekdaysPerYear - totalDaysOff);

    // Billable/paid equivalent days: sick days count at their coverage percentage
    const annualPaidDays = totalWeekdaysPerYear - sick + sick * sickCoverage;
    const annualBillableHours = annualPaidDays * hoursPerDay;

    return {
      annualPaidDays,
      effectiveWorkingDays,
      timeOffDaysTaken: totalDaysOff,
      hoursPerDay,
      annualBillableHours,
      unpaidDaysDeductionRatio: 1.0,
    };
  }

  if (timeOff.model === "model_b_combined") {
    const combined = timeOff.combinedPtoDays;
    const holidays = timeOff.paidStateHolidaysCount ?? defaultStateHolidays;

    let totalDaysOff = combined;
    if (!timeOff.stateHolidaysDeductedFromPool) {
      // Holidays are separate extra paid days
      totalDaysOff += holidays;
    }

    const effectiveWorkingDays = Math.max(0, totalWeekdaysPerYear - totalDaysOff);
    const annualPaidDays = totalWeekdaysPerYear;
    const annualBillableHours = annualPaidDays * hoursPerDay;

    return {
      annualPaidDays,
      effectiveWorkingDays,
      timeOffDaysTaken: totalDaysOff,
      hoursPerDay,
      annualBillableHours,
      unpaidDaysDeductionRatio: 1.0,
    };
  }

  // Model C: Unpaid / Pure Hourly B2B
  const plannedVacation = timeOff.plannedVacationDays;
  const estimatedSick = timeOff.estimatedSickDays;
  const holidaysTaken = timeOff.stateHolidaysTaken ?? defaultStateHolidays;

  const totalDaysOffUnpaid = plannedVacation + estimatedSick + holidaysTaken;
  const billableWorkingDays = Math.max(0, totalWeekdaysPerYear - totalDaysOffUnpaid);
  const annualBillableHours = billableWorkingDays * hoursPerDay;

  return {
    annualPaidDays: billableWorkingDays,
    effectiveWorkingDays: billableWorkingDays,
    timeOffDaysTaken: totalDaysOffUnpaid,
    hoursPerDay,
    annualBillableHours,
    unpaidDaysDeductionRatio: totalWeekdaysPerYear > 0 ? billableWorkingDays / totalWeekdaysPerYear : 1.0,
  };
}

// ---------------------------------------------------------------------------
// 3. Gross Rate Normalization to PLN
// ---------------------------------------------------------------------------

export function calculateAnnualGrossRevenuePln(
  rateSpec: RateSpecification,
  timeOff: TimeOffPolicy,
  config: ComparatorGlobalConfig,
  hoursPerDay = 8,
  liveRates?: Record<string, number>,
): {
  annualGrossPln: number;
  monthlyGrossPln: number;
  effectiveExchangeRate: number;
  baseExchangeRate: number;
  fxBufferDragPln: number;
  timeOffMetrics: TimeOffMetrics;
} {
  const { baseRate, bufferPct, effectiveRate } = resolveEffectiveFxRate(rateSpec.currency, config, liveRates);

  const timeOffMetrics = computeTimeOffMetrics(
    timeOff,
    hoursPerDay,
    config.defaultWorkingDaysPerYear,
    config.defaultStateHolidaysCount,
  );

  let annualGrossNative = 0;

  if (rateSpec.period === "hourly") {
    let markup = 1.0;
    if (timeOff.model === "model_c_unpaid" && timeOff.ptoRateMarkupPct) {
      markup = 1 + timeOff.ptoRateMarkupPct / 100;
    }
    annualGrossNative = timeOffMetrics.annualBillableHours * rateSpec.amount * markup;
  } else if (rateSpec.period === "monthly") {
    if (timeOff.model === "model_c_unpaid") {
      // Monthly contract with unpaid time off deduction
      annualGrossNative = rateSpec.amount * 12 * timeOffMetrics.unpaidDaysDeductionRatio;
    } else {
      annualGrossNative = rateSpec.amount * 12;
    }
  } else {
    // Annual
    if (timeOff.model === "model_c_unpaid") {
      annualGrossNative = rateSpec.amount * timeOffMetrics.unpaidDaysDeductionRatio;
    } else {
      annualGrossNative = rateSpec.amount;
    }
  }

  const annualGrossPln = annualGrossNative * effectiveRate;
  const annualGrossPlnUnbuffered = annualGrossNative * baseRate;
  const fxBufferDragPln = Math.max(0, annualGrossPlnUnbuffered - annualGrossPln) / 12;

  return {
    annualGrossPln,
    monthlyGrossPln: annualGrossPln / 12,
    effectiveExchangeRate: effectiveRate,
    baseExchangeRate: baseRate,
    fxBufferDragPln,
    timeOffMetrics,
  };
}

// ---------------------------------------------------------------------------
// 4. Two-Layer Benefit & Equity Valuation
// ---------------------------------------------------------------------------

export function calculateBenefitValuation(benefits: BenefitItem[]): {
  monthlyHardBudgetOffsetPln: number;
  monthlySubjectiveUtilityPln: number;
  totalMonthlyPerceivedBenefitPln: number;
} {
  let hardOffset = 0;
  let subjective = 0;

  for (const b of benefits) {
    let itemOffset = Math.max(0, b.monthlyBudgetOffsetPln ?? 0);
    // Deduct spouse copay if specified
    if (b.spouseCopayMonthlyPln && b.spouseCopayMonthlyPln > 0) {
      itemOffset = Math.max(0, itemOffset - b.spouseCopayMonthlyPln);
    }
    hardOffset += itemOffset;

    const nonOffsetValue = Math.max(0, b.nominalValuePln - itemOffset);
    const weight = Math.max(0, Math.min(100, b.subjectiveUtilityWeightPct ?? 0)) / 100;
    subjective += nonOffsetValue * weight;
  }

  return {
    monthlyHardBudgetOffsetPln: hardOffset,
    monthlySubjectiveUtilityPln: subjective,
    totalMonthlyPerceivedBenefitPln: hardOffset + subjective,
  };
}

export function calculateEquityValuation(
  equityGrants: EquityGrant[],
  config: ComparatorGlobalConfig,
  liveRates?: Record<string, number>,
): {
  monthlyLiquidEquityPln: number;
  hasIlliquidEquity: boolean;
  totalIlliquidEquityNominalPln: number;
} {
  let monthlyLiquid = 0;
  let hasIlliquid = false;
  let totalIlliquid = 0;

  for (const eq of equityGrants) {
    const { effectiveRate } = resolveEffectiveFxRate(eq.currency, config, liveRates);
    const grantValuePln = eq.totalGrantValue * effectiveRate;

    if (eq.isLiquid && eq.type === "rsu") {
      const vestingYears = Math.max(1, eq.vestingYears || 4);
      const discount = Math.max(0, Math.min(100, eq.volatilityDiscountPct || 0)) / 100;
      const belkaTax = Math.max(0, Math.min(100, eq.belkaTaxPct || 19)) / 100;

      const annualPreTax = (grantValuePln / vestingYears) * (1 - discount);
      const annualPostTax = annualPreTax * (1 - belkaTax);
      monthlyLiquid += annualPostTax / 12;
    } else {
      hasIlliquid = true;
      totalIlliquid += grantValuePln;
    }
  }

  return {
    monthlyLiquidEquityPln: monthlyLiquid,
    hasIlliquidEquity: hasIlliquid,
    totalIlliquidEquityNominalPln: totalIlliquid,
  };
}

// ---------------------------------------------------------------------------
// 5. Side-Gig Shared-ZUS & Threshold Spillover Simulation
// ---------------------------------------------------------------------------

export function simulateSideGigImpact(
  primaryAnnualGrossPln: number,
  primaryTaxProfile: OfferRevision["taxProfile"],
  sideGig: SideGigAddon,
  config: ComparatorGlobalConfig,
  liveRates?: Record<string, number>,
) {
  if (!sideGig.enabled) {
    return undefined;
  }

  const { effectiveRate } = resolveEffectiveFxRate(sideGig.rateSpec.currency, config, liveRates);
  let sideAnnualGrossNative = 0;
  if (sideGig.rateSpec.period === "hourly") {
    // 52 weeks per year times hours per week
    sideAnnualGrossNative = sideGig.rateSpec.amount * sideGig.hoursPerWeek * 52;
  } else if (sideGig.rateSpec.period === "monthly") {
    sideAnnualGrossNative = sideGig.rateSpec.amount * 12;
  } else {
    sideAnnualGrossNative = sideGig.rateSpec.amount;
  }
  const sideAnnualGrossPln = sideAnnualGrossNative * effectiveRate;

  // Primary tax without side gig
  const primaryTax = computeAnnualTaxBreakdown(primaryAnnualGrossPln, primaryTaxProfile, 1);

  // Combined simulation:
  // Since primary offer covers mandatory ZUS Społeczny, side-gig has 0 ZUS Społeczny
  const combinedAnnualGrossPln = primaryAnnualGrossPln + sideAnnualGrossPln;

  // Check health tier cliff for B2B Ryczałt
  const crossesHealthTier =
    primaryAnnualGrossPln <= STATUTORY_DEFAULTS.RYCZALT_HEALTH_THRESHOLD_TIER2 &&
    combinedAnnualGrossPln > STATUTORY_DEFAULTS.RYCZALT_HEALTH_THRESHOLD_TIER2;

  // Check 120k bracket spillover for Skala/UoP
  const crossesTaxBracket =
    primaryAnnualGrossPln <= STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD &&
    combinedAnnualGrossPln > STATUTORY_DEFAULTS.UOP_PIT_BRACKET_THRESHOLD;

  // Calculate side-gig marginal net
  // Side gig is typically billed under B2B Ryczałt or linear tax without ZUS Społeczny
  let sideGigNetMonthly = 0;
  if (sideGig.taxProfile.regime === "b2b_ryczalt") {
    const ryczaltRate = sideGig.taxProfile.ryczaltRatePct / 100;
    // Health contribution jump if it pushes primary over the 300k cliff
    let healthDiff = 0;
    if (crossesHealthTier) {
      healthDiff =
        (STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY - STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY) * 12;
    }
    const sidePit = (sideAnnualGrossPln - 0.5 * healthDiff) * ryczaltRate;
    const sideAccounting = (sideGig.taxProfile.monthlyAccountingCostPln ?? 0) * 12;
    const sideNetAnnual = sideAnnualGrossPln - sidePit - healthDiff - sideAccounting;
    sideGigNetMonthly = sideNetAnnual / 12;
  } else {
    // Fallback linear 19% PIT + 4.9% Zdrowotna
    const sideNetAnnual = sideAnnualGrossPln * (1 - 0.239);
    sideGigNetMonthly = sideNetAnnual / 12;
  }

  const combinedMonthlyGross = (primaryAnnualGrossPln + sideAnnualGrossPln) / 12;
  const combinedMonthlyNet = primaryTax.monthlyNetCashflowPln + sideGigNetMonthly;
  const annualSideHours = sideGig.hoursPerWeek * 52;
  const marginalHourlyRate = annualSideHours > 0 ? (sideGigNetMonthly * 12) / annualSideHours : 0;

  return {
    combinedGrossMonthlyPln: combinedMonthlyGross,
    combinedNetMonthlyPln: combinedMonthlyNet,
    marginalNetMonthlyPln: sideGigNetMonthly,
    marginalNetHourlyRatePln: marginalHourlyRate,
    totalWeeklyHours: sideGig.hoursPerWeek,
    crossesHealthTier,
    crossesTaxBracket,
  };
}

// ---------------------------------------------------------------------------
// 6. Comprehensive Offer Revision Normalizer
// ---------------------------------------------------------------------------

export function normalizeOfferRevision(
  revision: OfferRevision,
  config: ComparatorGlobalConfig = DEFAULT_COMPARATOR_CONFIG,
  liveRates?: Record<string, number>,
): NormalizedCompensationSummary {
  // 1. Determine daily hours
  let hoursPerDay = config.workingHoursPerDay || 8;
  if (revision.taxProfile.regime === "uop" && revision.taxProfile.disabilityRights?.enabled) {
    hoursPerDay = (revision.taxProfile.disabilityRights.statutoryHoursPerWeek ?? 35) / 5;
  }

  // 2. Compute gross revenues & time off
  const { annualGrossPln, monthlyGrossPln, effectiveExchangeRate, timeOffMetrics } = calculateAnnualGrossRevenuePln(
    revision.rateSpec,
    revision.timeOff,
    config,
    hoursPerDay,
    liveRates,
  );

  // 3. Multi-year tax projection
  const multiYearTax = computeMultiYearTaxProjection(annualGrossPln, revision.taxProfile, config);
  const activeYearTax =
    config.activeYearProjection === 2
      ? multiYearTax.year2
      : config.activeYearProjection === 3
        ? multiYearTax.year3
        : multiYearTax.year1;

  // 4. Two-layer benefits
  const { monthlyHardBudgetOffsetPln, monthlySubjectiveUtilityPln } = calculateBenefitValuation(revision.benefits);

  // 5. Equity grants
  const { monthlyLiquidEquityPln, hasIlliquidEquity, totalIlliquidEquityNominalPln } = calculateEquityValuation(
    revision.equityGrants,
    config,
    liveRates,
  );

  // 6. Hard Cashflow vs. Total Perceived Comp
  const hardNetMonthlyCashflowPln =
    activeYearTax.monthlyNetCashflowPln + monthlyHardBudgetOffsetPln + monthlyLiquidEquityPln;

  const totalPerceivedMonthlyCompPln = hardNetMonthlyCashflowPln + monthlySubjectiveUtilityPln;

  // 7. Effective Net Hourly Rate
  const totalWeeklyHours = revision.expectedWeeklyHours || hoursPerDay * 5;
  const annualExpectedHours = totalWeeklyHours * 52;
  const effectiveNetHourlyRatePln =
    annualExpectedHours > 0 ? (hardNetMonthlyCashflowPln * 12) / annualExpectedHours : 0;

  // 8. Side-gig simulation
  let sideGigSummary: NormalizedCompensationSummary["sideGigSummary"];
  if (revision.sideGig?.enabled && revision.allowsSideGig) {
    const sim = simulateSideGigImpact(annualGrossPln, revision.taxProfile, revision.sideGig, config, liveRates);
    if (sim) {
      sideGigSummary = {
        ...sim,
        totalWeeklyHours: totalWeeklyHours + revision.sideGig.hoursPerWeek,
      };
    }
  }

  return {
    annualGrossRevenuePln: annualGrossPln,
    monthlyGrossRevenuePln: monthlyGrossPln,
    annualBillableHours: timeOffMetrics.annualBillableHours,
    effectiveWorkingDays: timeOffMetrics.effectiveWorkingDays,
    timeOffDaysTaken: timeOffMetrics.timeOffDaysTaken,
    effectiveExchangeRate,
    taxBreakdown: activeYearTax,
    multiYearTax,
    monthlyHardBudgetOffsetPln,
    monthlySubjectiveUtilityPln,
    monthlyLiquidEquityPln,
    hasIlliquidEquity,
    totalIlliquidEquityNominalPln,
    hardNetMonthlyCashflowPln,
    totalPerceivedMonthlyCompPln,
    effectiveNetHourlyRatePln,
    sideGigSummary,
  };
}

// ---------------------------------------------------------------------------
// 7. Restructure Revision Impact Diff
// ---------------------------------------------------------------------------

export function computeRestructureRevisionDiff(
  baseRevision: OfferRevision,
  targetRevision: OfferRevision,
  config: ComparatorGlobalConfig = DEFAULT_COMPARATOR_CONFIG,
  liveRates?: Record<string, number>,
): RestructureImpactDiff {
  const baseSummary = normalizeOfferRevision(baseRevision, config, liveRates);
  const targetSummary = normalizeOfferRevision(targetRevision, config, liveRates);

  const monthlyGrossDeltaPln = targetSummary.monthlyGrossRevenuePln - baseSummary.monthlyGrossRevenuePln;

  const { fxBufferDragPln: baseFxDrag } = calculateAnnualGrossRevenuePln(
    baseRevision.rateSpec,
    baseRevision.timeOff,
    config,
    8,
    liveRates,
  );
  const { fxBufferDragPln: targetFxDrag } = calculateAnnualGrossRevenuePln(
    targetRevision.rateSpec,
    targetRevision.timeOff,
    config,
    8,
    liveRates,
  );
  const fxBufferDragPln = targetFxDrag - baseFxDrag;

  const netCashflowDeltaPln =
    targetSummary.taxBreakdown.monthlyNetCashflowPln - baseSummary.taxBreakdown.monthlyNetCashflowPln;

  const benefitOffsetDeltaPln = targetSummary.monthlyHardBudgetOffsetPln - baseSummary.monthlyHardBudgetOffsetPln;

  // Detect spouse downgrade:
  // Base had family health, target has individual or reduced offset
  const baseHealth = baseRevision.benefits.find((b) => b.category === "health");
  const targetHealth = targetRevision.benefits.find((b) => b.category === "health");
  let spouseDowngradeCostPln = 0;
  if (baseHealth?.tier === "family" && targetHealth?.tier === "individual") {
    spouseDowngradeCostPln = targetHealth.spouseCopayMonthlyPln || 300;
  }

  // Real purchasing power calculation if historical dates are present
  let realPurchasingPowerDeltaPln: number | undefined;
  if (baseRevision.effectiveDate && targetRevision.effectiveDate) {
    const baseReal = calculateRealValue(baseSummary.hardNetMonthlyCashflowPln, baseRevision.effectiveDate);
    const targetReal = calculateRealValue(targetSummary.hardNetMonthlyCashflowPln, targetRevision.effectiveDate);
    realPurchasingPowerDeltaPln = targetReal - baseReal;
  }

  const effectiveHourlyRateDeltaPln = targetSummary.effectiveNetHourlyRatePln - baseSummary.effectiveNetHourlyRatePln;

  const netMonthlyGainPln =
    targetSummary.hardNetMonthlyCashflowPln - baseSummary.hardNetMonthlyCashflowPln - spouseDowngradeCostPln;

  return {
    baseTrackId: baseRevision.trackId,
    baseRevisionId: baseRevision.id,
    targetRevisionId: targetRevision.id,
    monthlyGrossDeltaPln,
    fxBufferDragPln,
    netCashflowDeltaPln,
    benefitOffsetDeltaPln,
    spouseDowngradeCostPln,
    realPurchasingPowerDeltaPln,
    effectiveHourlyRateDeltaPln,
    netMonthlyGainPln,
  };
}
