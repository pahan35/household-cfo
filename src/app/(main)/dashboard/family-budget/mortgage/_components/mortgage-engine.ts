import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import {
  resolveCategoryCurrency,
  toFxRateToTarget,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-money";

import type {
  AmortizationMonthSchedule,
  AmortizationSummary,
  BudgetImpactSummary,
  CourtFeesBreakdown,
  GoalSavingsAudit,
  HomeGoalTrackingConfig,
  MortgageFinancingConfig,
  MortgageSimulatorConfig,
  NotaryFeeBreakdown,
  OverlapPhaseCashflow,
  OverlapTimelineConfig,
  OverlapTimelineSummary,
  PropertyAcquisitionConfig,
  PropertyAcquisitionSummary,
} from "./mortgage-types";

export const DEFAULT_PROPERTY_ACQUISITION_CONFIG: PropertyAcquisitionConfig = {
  pricingMode: "area_and_price_per_sqm",
  areaSqm: 65,
  pricePerSqmPln: 15000,
  customTotalPricePln: 975000,
  includeParking: true,
  parkingPricePln: 45000,
  includeStorage: true,
  storagePricePln: 15000,
  renovationBudgetPln: 200000,
  renovationContingencyPct: 10,
  renovationFundingMode: "cash",
  bankValuationFeePln: 500,
};

export const DEFAULT_MORTGAGE_FINANCING_CONFIG: MortgageFinancingConfig = {
  downPaymentPct: 20,
  loanTermYears: 25,
  referenceRatePct: 5.0, // WIBOR 3M / 6M benchmark
  bankMarginPct: 1.85,
  rateStressDeltaPct: 0,
  installmentType: "equal",
};

export const DEFAULT_OVERLAP_TIMELINE_CONFIG: OverlapTimelineConfig = {
  monthsToSigning: 6,
  constructionWaitMonths: 18,
  finishingOverlapMonths: 3,
  currentMonthlyRentPln: 3500,
  newCommunityAdminFeePln: 900,
  averageTrancheDrawnPctDuringConstruction: 50,
};

export const DEFAULT_HOME_GOAL_TRACKING_CONFIG: HomeGoalTrackingConfig = {
  linkedGoalCategoryIds: [],
  customMonthlyNetIncomeFallbackPln: 18000,
  lookbackWindow: "6m",
};

export const DEFAULT_MORTGAGE_SIMULATOR_CONFIG: MortgageSimulatorConfig = {
  property: DEFAULT_PROPERTY_ACQUISITION_CONFIG,
  financing: DEFAULT_MORTGAGE_FINANCING_CONFIG,
  overlap: DEFAULT_OVERLAP_TIMELINE_CONFIG,
  goalTracking: DEFAULT_HOME_GOAL_TRACKING_CONFIG,
};

/**
 * Calculates Polish statutory maximum notary fee (taksa notarialna) based on transaction value
 * according to Dz.U. regulation, plus 23% VAT, splitting 50% for developer agreement / preliminary.
 */
export function calculateNotaryFees(transactionValuePln: number, customFeePln?: number): NotaryFeeBreakdown {
  let baseFeePln = 0;

  if (typeof customFeePln === "number" && customFeePln > 0) {
    baseFeePln = customFeePln;
  } else if (transactionValuePln <= 3000) {
    baseFeePln = 100;
  } else if (transactionValuePln <= 10000) {
    baseFeePln = 100 + (transactionValuePln - 3000) * 0.03;
  } else if (transactionValuePln <= 30000) {
    baseFeePln = 310 + (transactionValuePln - 10000) * 0.02;
  } else if (transactionValuePln <= 60000) {
    baseFeePln = 710 + (transactionValuePln - 30000) * 0.01;
  } else if (transactionValuePln <= 1000000) {
    baseFeePln = 1010 + (transactionValuePln - 60000) * 0.004;
  } else if (transactionValuePln <= 2000000) {
    baseFeePln = 4770 + (transactionValuePln - 1000000) * 0.002;
  } else {
    baseFeePln = Math.min(10000, 6770 + (transactionValuePln - 2000000) * 0.0025);
  }

  // Notary excerpts (wypisy notarialne ~6 copies @ ~30 PLN)
  const excerptsPln = 180;
  baseFeePln += excerptsPln;

  const vatPln = Math.round(baseFeePln * 0.23 * 100) / 100;
  const totalNotaryWithVatPln = Math.round((baseFeePln + vatPln) * 100) / 100;

  // By Polish Developer Act, developer contract notary fees are split 50/50 between buyer and developer
  const buyerSharePln = Math.round((totalNotaryWithVatPln / 2) * 100) / 100;

  return {
    baseFeePln: Math.round(baseFeePln * 100) / 100,
    vatPln,
    totalNotaryWithVatPln,
    buyerSharePln,
  };
}

/**
 * Calculates standard Polish court and land register fees (KW) for property and mortgage.
 */
export function calculateCourtFees(): CourtFeesBreakdown {
  const ownershipRegisterEntryPln = 200;
  const mortgageRegisterEntryPln = 200;
  const pcc3MortgageTaxPln = 19;
  return {
    ownershipRegisterEntryPln,
    mortgageRegisterEntryPln,
    pcc3MortgageTaxPln,
    totalCourtFeesPln: ownershipRegisterEntryPln + mortgageRegisterEntryPln + pcc3MortgageTaxPln,
  };
}

/**
 * Calculates property acquisition cost, primary market 0% PCC, notary/court fees,
 * down payment amount, and resulting bank loan principal.
 */
export function calculatePropertyAcquisition(
  config: PropertyAcquisitionConfig,
  downPaymentPct: number,
): PropertyAcquisitionSummary {
  const apartmentPricePln =
    config.pricingMode === "area_and_price_per_sqm"
      ? Math.round(config.areaSqm * config.pricePerSqmPln)
      : Math.round(config.customTotalPricePln);

  const parkingPricePln = config.includeParking ? Math.max(0, Math.round(config.parkingPricePln)) : 0;
  const storagePricePln = config.includeStorage ? Math.max(0, Math.round(config.storagePricePln)) : 0;
  const propertyTotalPln = apartmentPricePln + parkingPricePln + storagePricePln;

  const renovationBasePln = Math.max(0, Math.round(config.renovationBudgetPln));
  const contingencyFraction = Math.max(0, config.renovationContingencyPct) / 100;
  const renovationContingencyPln = Math.round(renovationBasePln * contingencyFraction);
  const renovationTotalPln = renovationBasePln + renovationContingencyPln;

  const notaryFees = calculateNotaryFees(propertyTotalPln, config.customNotaryFeePln);
  const courtFees = calculateCourtFees();
  const bankFeesPln = Math.max(0, Math.round(config.bankValuationFeePln));
  const totalClosingFeesPln = Math.round(notaryFees.buyerSharePln + courtFees.totalCourtFeesPln + bankFeesPln);

  const safeDownPaymentPct = Math.min(100, Math.max(0, downPaymentPct));

  let projectTotalPln = propertyTotalPln;
  let downPaymentPln = 0;
  let loanPrincipalPln = 0;
  let upfrontCashMilestone1Pln = 0;
  let upfrontCashMilestone2Pln = 0;

  if (config.renovationFundingMode === "mortgage") {
    // Renovation is bundled into mortgage. Down payment percentage applies to (property + renovation).
    projectTotalPln = propertyTotalPln + renovationTotalPln;
    downPaymentPln = Math.round(projectTotalPln * (safeDownPaymentPct / 100));
    loanPrincipalPln = projectTotalPln - downPaymentPln;
    upfrontCashMilestone1Pln = downPaymentPln + totalClosingFeesPln;
    upfrontCashMilestone2Pln = 0; // Renovation already financed
  } else {
    // Renovation is cash-funded by buyer. Mortgage covers property only.
    projectTotalPln = propertyTotalPln;
    downPaymentPln = Math.round(propertyTotalPln * (safeDownPaymentPct / 100));
    loanPrincipalPln = propertyTotalPln - downPaymentPln;
    upfrontCashMilestone1Pln = downPaymentPln + totalClosingFeesPln;
    upfrontCashMilestone2Pln = renovationTotalPln;
  }

  const totalCashRequiredPln = upfrontCashMilestone1Pln + upfrontCashMilestone2Pln;

  return {
    apartmentPricePln,
    parkingPricePln,
    storagePricePln,
    propertyTotalPln,
    renovationBasePln,
    renovationContingencyPln,
    renovationTotalPln,
    projectTotalPln,
    pccTaxPln: 0, // 0% PCC on primary market
    pccTaxRatePct: 0,
    notaryFees,
    courtFees,
    bankFeesPln,
    totalClosingFeesPln,
    downPaymentPln,
    loanPrincipalPln,
    upfrontCashMilestone1Pln,
    upfrontCashMilestone2Pln,
    totalCashRequiredPln,
  };
}

/**
 * Calculates loan amortization schedule for equal (annuity) or decreasing installments.
 */
export function calculateAmortization(
  loanPrincipalPln: number,
  financing: MortgageFinancingConfig,
): AmortizationSummary {
  const nominalRatePct = Math.max(0, financing.referenceRatePct + financing.bankMarginPct);
  const effectiveRatePct = Math.max(0.01, nominalRatePct + financing.rateStressDeltaPct);
  const totalMonths = Math.max(1, Math.round(financing.loanTermYears * 12));
  const monthlyRate = effectiveRatePct / 100 / 12;

  if (loanPrincipalPln <= 0) {
    return {
      effectiveRatePct,
      nominalRatePct,
      monthlyRate,
      totalMonths,
      firstMonthInstallmentPln: 0,
      lastMonthInstallmentPln: 0,
      totalPaymentPln: 0,
      totalInterestPln: 0,
      schedule: [],
    };
  }

  const schedule: AmortizationMonthSchedule[] = [];
  let remainingPrincipal = loanPrincipalPln;

  if (financing.installmentType === "equal") {
    // Equal annuity payment: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const factor = (1 + monthlyRate) ** totalMonths;
    const monthlyPayment = (loanPrincipalPln * (monthlyRate * factor)) / (factor - 1);

    let totalInterest = 0;
    for (let month = 1; month <= totalMonths; month++) {
      const interestPart = remainingPrincipal * monthlyRate;
      let principalPart = monthlyPayment - interestPart;

      if (month === totalMonths || principalPart > remainingPrincipal) {
        principalPart = remainingPrincipal;
      }
      remainingPrincipal = Math.max(0, remainingPrincipal - principalPart);
      totalInterest += interestPart;

      schedule.push({
        monthIndex: month,
        installmentTotalPln: Math.round(monthlyPayment),
        principalPartPln: Math.round(principalPart),
        interestPartPln: Math.round(interestPart),
        remainingPrincipalPln: Math.round(remainingPrincipal),
      });
    }

    const firstMonthInstallmentPln = Math.round(monthlyPayment);
    const totalPaymentPln = Math.round(firstMonthInstallmentPln * totalMonths);

    return {
      effectiveRatePct,
      nominalRatePct,
      monthlyRate,
      totalMonths,
      firstMonthInstallmentPln,
      lastMonthInstallmentPln: firstMonthInstallmentPln,
      totalPaymentPln,
      totalInterestPln: Math.round(totalInterest),
      schedule,
    };
  }

  // Decreasing installments: fixed principal part each month
  const fixedPrincipalPart = loanPrincipalPln / totalMonths;
  let totalInterest = 0;
  let firstMonthInstallmentPln = 0;
  let lastMonthInstallmentPln = 0;

  for (let month = 1; month <= totalMonths; month++) {
    const interestPart = remainingPrincipal * monthlyRate;
    const principalPart = month === totalMonths ? remainingPrincipal : fixedPrincipalPart;
    const installmentTotal = principalPart + interestPart;

    if (month === 1) firstMonthInstallmentPln = Math.round(installmentTotal);
    if (month === totalMonths) lastMonthInstallmentPln = Math.round(installmentTotal);

    remainingPrincipal = Math.max(0, remainingPrincipal - principalPart);
    totalInterest += interestPart;

    schedule.push({
      monthIndex: month,
      installmentTotalPln: Math.round(installmentTotal),
      principalPartPln: Math.round(principalPart),
      interestPartPln: Math.round(interestPart),
      remainingPrincipalPln: Math.round(remainingPrincipal),
    });
  }

  return {
    effectiveRatePct,
    nominalRatePct,
    monthlyRate,
    totalMonths,
    firstMonthInstallmentPln,
    lastMonthInstallmentPln,
    totalPaymentPln: Math.round(loanPrincipalPln + totalInterest),
    totalInterestPln: Math.round(totalInterest),
    schedule,
  };
}

/**
 * Projects multi-phase cashflows: saving, construction grace period interest,
 * finishing overlap, and post-move-in steady state.
 */
export function calculateOverlapTimeline(params: {
  propertySummary: PropertyAcquisitionSummary;
  amortization: AmortizationSummary;
  overlapConfig: OverlapTimelineConfig;
}): OverlapTimelineSummary {
  const { propertySummary, amortization, overlapConfig } = params;

  // 1. Saving Phase
  const savingDuration = Math.max(1, overlapConfig.monthsToSigning);
  const savingPhase: OverlapPhaseCashflow = {
    phaseKey: "saving",
    phaseTitle: "Saving to Signing",
    durationMonths: savingDuration,
    monthlyRentPln: overlapConfig.currentMonthlyRentPln,
    monthlyMortgagePln: 0,
    monthlyAdminFeePln: 0,
    monthlyTotalHousingCostPln: overlapConfig.currentMonthlyRentPln,
    totalPhaseOutflowPln: overlapConfig.currentMonthlyRentPln * savingDuration,
  };

  // 2. Construction Wait Phase (Interest-only grace period on drawn tranches)
  const constructionDuration = Math.max(1, overlapConfig.constructionWaitMonths);
  const avgDrawnRatio = Math.max(0, Math.min(100, overlapConfig.averageTrancheDrawnPctDuringConstruction)) / 100;
  const avgDrawnPrincipal = propertySummary.loanPrincipalPln * avgDrawnRatio;
  const monthlyGracePeriodInterestPln = Math.round(avgDrawnPrincipal * amortization.monthlyRate);
  const monthlyConstructionCostPln = overlapConfig.currentMonthlyRentPln + monthlyGracePeriodInterestPln;

  const constructionPhase: OverlapPhaseCashflow = {
    phaseKey: "construction",
    phaseTitle: "Construction Wait (Grace Period)",
    durationMonths: constructionDuration,
    monthlyRentPln: overlapConfig.currentMonthlyRentPln,
    monthlyMortgagePln: monthlyGracePeriodInterestPln,
    monthlyAdminFeePln: 0,
    monthlyTotalHousingCostPln: monthlyConstructionCostPln,
    totalPhaseOutflowPln: monthlyConstructionCostPln * constructionDuration,
  };

  // 3. Finishing Overlap Phase (Key handover: rent + full mortgage + new community admin fee)
  const finishingDuration = Math.max(1, overlapConfig.finishingOverlapMonths);
  const monthlyFinishingCostPln =
    overlapConfig.currentMonthlyRentPln + amortization.firstMonthInstallmentPln + overlapConfig.newCommunityAdminFeePln;

  const finishingPhase: OverlapPhaseCashflow = {
    phaseKey: "finishing",
    phaseTitle: "Finishing & Overlap Window",
    durationMonths: finishingDuration,
    monthlyRentPln: overlapConfig.currentMonthlyRentPln,
    monthlyMortgagePln: amortization.firstMonthInstallmentPln,
    monthlyAdminFeePln: overlapConfig.newCommunityAdminFeePln,
    monthlyTotalHousingCostPln: monthlyFinishingCostPln,
    totalPhaseOutflowPln: monthlyFinishingCostPln * finishingDuration,
  };

  // 4. Steady State Phase (Post move-in: rent replaced by mortgage + admin fee)
  const steadyMonthlyCostPln = amortization.firstMonthInstallmentPln + overlapConfig.newCommunityAdminFeePln;
  const steadyPhase: OverlapPhaseCashflow = {
    phaseKey: "steady_state",
    phaseTitle: "Steady State (Post Move-in)",
    durationMonths: 12,
    monthlyRentPln: 0,
    monthlyMortgagePln: amortization.firstMonthInstallmentPln,
    monthlyAdminFeePln: overlapConfig.newCommunityAdminFeePln,
    monthlyTotalHousingCostPln: steadyMonthlyCostPln,
    totalPhaseOutflowPln: steadyMonthlyCostPln * 12,
  };

  const phases = [savingPhase, constructionPhase, finishingPhase, steadyPhase];

  let peakMonthlyHousingCostPln = 0;
  let peakPhaseKey: "saving" | "construction" | "finishing" | "steady_state" = "finishing";

  for (const phase of phases) {
    if (phase.monthlyTotalHousingCostPln > peakMonthlyHousingCostPln) {
      peakMonthlyHousingCostPln = phase.monthlyTotalHousingCostPln;
      peakPhaseKey = phase.phaseKey;
    }
  }

  // Total overlap cost: outflow spent during saving, construction, and finishing prior to full move-in
  const totalOverlapCostPln =
    savingPhase.totalPhaseOutflowPln + constructionPhase.totalPhaseOutflowPln + finishingPhase.totalPhaseOutflowPln;

  // Month-by-month timeline projection
  const timelineMonths: OverlapTimelineSummary["timelineMonths"] = [];
  let monthCounter = 1;

  for (const phase of phases) {
    for (let m = 0; m < phase.durationMonths; m++) {
      timelineMonths.push({
        monthIndex: monthCounter++,
        phaseKey: phase.phaseKey,
        rentPln: phase.monthlyRentPln,
        mortgagePln: phase.monthlyMortgagePln,
        adminFeePln: phase.monthlyAdminFeePln,
        totalPln: phase.monthlyTotalHousingCostPln,
      });
    }
  }

  return {
    phases,
    peakMonthlyHousingCostPln,
    peakPhaseKey,
    totalOverlapCostPln,
    timelineMonths,
  };
}

/**
 * Computes average monthly net cashflow margin (Net Income - Living Expenses)
 * across a selected lookback window from ExternalProvider /stat/ping data points.
 */
export function computeHistoricalNetCashflowMargin(params: {
  statPoints: StatPoint[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  lookbackWindow: "3m" | "6m" | "12m" | "all";
  fallbackMarginPln?: number;
}): number {
  const { statPoints, categories, currencies, lookbackWindow, fallbackMarginPln = 10000 } = params;

  if (statPoints.length === 0) {
    return fallbackMarginPln;
  }

  const categoryMap = new Map<string, ExternalProviderCategory>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  let windowMonths = 6;
  if (lookbackWindow === "3m") windowMonths = 3;
  else if (lookbackWindow === "6m") windowMonths = 6;
  else if (lookbackWindow === "12m") windowMonths = 12;
  else if (lookbackWindow === "all") windowMonths = statPoints.length;

  const validPoints = statPoints
    .filter((p) => Array.isArray(p.categories) && p.categories.length > 0)
    .slice(-windowMonths);

  if (validPoints.length === 0) {
    return fallbackMarginPln;
  }

  let totalNetCashflowPln = 0;
  let pointsWithActivity = 0;

  for (const point of validPoints) {
    let monthIncomePln = 0;
    let monthExpensePln = 0;

    for (const cPt of point.categories) {
      const cat = categoryMap.get(cPt.id);
      if (!cat || cat.deleted) continue;

      const rawAmount = Math.abs(Number(cPt.amount ?? cPt.value ?? 0));
      if (rawAmount <= 0) continue;

      const currencyCode = resolveCategoryCurrency(cat, "PLN");
      const fxRate = toFxRateToTarget(currencyCode, "PLN", currencies);
      const amountPln = rawAmount * fxRate;

      const catType = Number(cat.categoryType);
      if (catType === CategoryType.Income) {
        monthIncomePln += amountPln;
      } else if (catType === CategoryType.Expense) {
        monthExpensePln += amountPln;
      }
    }

    if (monthIncomePln > 0 || monthExpensePln > 0) {
      totalNetCashflowPln += monthIncomePln - monthExpensePln;
      pointsWithActivity++;
    }
  }

  if (pointsWithActivity === 0) {
    return fallbackMarginPln;
  }

  const avgMonthlyMargin = Math.round(totalNetCashflowPln / pointsWithActivity);
  // If income wasn't tracked and net is negative, use fallback
  if (avgMonthlyMargin <= 0 && fallbackMarginPln > 0) {
    return fallbackMarginPln;
  }

  return avgMonthlyMargin;
}

/**
 * Calculates ExternalProvider Goal accumulation, progress toward Milestone 1 and 2,
 * required savings velocities, and benchmarks against historical net cashflow margin.
 */
export function auditSavingsPace(params: {
  upfrontCashMilestone1Pln: number;
  upfrontCashMilestone2Pln: number;
  monthsToSigning: number;
  monthsToHandover: number;
  linkedGoalCategoryIds: string[];
  allCategories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  historicalNetCashflowMarginPln: number;
}): GoalSavingsAudit {
  const {
    upfrontCashMilestone1Pln,
    upfrontCashMilestone2Pln,
    monthsToSigning,
    monthsToHandover,
    linkedGoalCategoryIds,
    allCategories,
    currencies,
    historicalNetCashflowMarginPln,
  } = params;

  // Sum balances across all linked goals, converting to PLN
  let accumulatedSavingsPln = 0;
  const linkedSet = new Set(linkedGoalCategoryIds);

  for (const cat of allCategories) {
    if (!cat.deleted && linkedSet.has(cat.id)) {
      const rawBalance = cat.amount ?? cat.currentAmount ?? 0;
      const currencyCode = resolveCategoryCurrency(cat, "PLN");
      const fxRate = toFxRateToTarget(currencyCode, "PLN", currencies);
      accumulatedSavingsPln += rawBalance * fxRate;
    }
  }

  accumulatedSavingsPln = Math.round(accumulatedSavingsPln);

  const milestone1TargetPln = Math.round(upfrontCashMilestone1Pln);
  const milestone1GapPln = Math.max(0, milestone1TargetPln - accumulatedSavingsPln);
  const milestone1ProgressPct =
    milestone1TargetPln > 0
      ? Math.min(100, Math.round((accumulatedSavingsPln / milestone1TargetPln) * 1000) / 10)
      : 100;

  const safeMonthsToSigning = Math.max(1, monthsToSigning);
  const milestone1RequiredMonthlyPacePln = Math.round(milestone1GapPln / safeMonthsToSigning);

  const milestone2TargetPln = Math.round(upfrontCashMilestone2Pln);
  const totalTargetPln = milestone1TargetPln + milestone2TargetPln;
  const totalGapPln = Math.max(0, totalTargetPln - accumulatedSavingsPln);
  const totalProgressPct =
    totalTargetPln > 0 ? Math.min(100, Math.round((accumulatedSavingsPln / totalTargetPln) * 1000) / 10) : 100;

  // Milestone 2 gap is whatever remaining after covering milestone 1
  const milestone2GapPln = Math.max(0, totalGapPln - milestone1GapPln);
  const safeMonthsToHandover = Math.max(1, monthsToHandover);
  const milestone2RequiredMonthlyPacePln = Math.round(totalGapPln / safeMonthsToHandover);
  const milestone2ProgressPct =
    milestone2TargetPln > 0
      ? Math.min(
          100,
          Math.round((Math.max(0, accumulatedSavingsPln - milestone1TargetPln) / milestone2TargetPln) * 1000) / 10,
        )
      : 100;

  const monthlyDeltaPln = Math.round(historicalNetCashflowMarginPln - milestone1RequiredMonthlyPacePln);
  const paceStatus = monthlyDeltaPln >= 0 ? "on_track" : "shortfall";

  let projectedMilestone1DelayMonths = 0;
  if (paceStatus === "shortfall") {
    if (historicalNetCashflowMarginPln > 0) {
      const monthsNeededAtActualPace = milestone1GapPln / historicalNetCashflowMarginPln;
      projectedMilestone1DelayMonths = Math.max(0, Math.ceil(monthsNeededAtActualPace - safeMonthsToSigning));
    } else {
      projectedMilestone1DelayMonths = 99; // Insufficient cashflow
    }
  }

  return {
    accumulatedSavingsPln,
    milestone1TargetPln,
    milestone1GapPln,
    milestone1ProgressPct,
    milestone1RequiredMonthlyPacePln,

    milestone2TargetPln,
    milestone2GapPln,
    milestone2ProgressPct,
    milestone2RequiredMonthlyPacePln,

    totalTargetPln,
    totalGapPln,
    totalProgressPct,

    historicalNetCashflowMarginPln: Math.round(historicalNetCashflowMarginPln),
    paceStatus,
    monthlyDeltaPln,
    projectedMilestone1DelayMonths,
  };
}

/**
 * Calculates pre- vs post-move-in budget impact, DTI ratio, and interest rate stress testing.
 */
export function calculateBudgetImpact(params: {
  amortization: AmortizationSummary;
  overlapConfig: OverlapTimelineConfig;
  financing: MortgageFinancingConfig;
  propertySummary: PropertyAcquisitionSummary;
  householdNetIncomePln: number;
}): BudgetImpactSummary {
  const { amortization, overlapConfig, financing, propertySummary, householdNetIncomePln } = params;

  const currentMonthlyRentPln = overlapConfig.currentMonthlyRentPln;
  const newMortgageInstallmentPln = amortization.firstMonthInstallmentPln;
  const newCommunityAdminFeePln = overlapConfig.newCommunityAdminFeePln;
  const newMonthlyHousingCostPln = newMortgageInstallmentPln + newCommunityAdminFeePln;
  const monthlyCashflowDeltaPln = newMonthlyHousingCostPln - currentMonthlyRentPln;

  const safeIncome = Math.max(1, householdNetIncomePln);
  const currentHousingDtiPct = Math.round((currentMonthlyRentPln / safeIncome) * 1000) / 10;
  const newHousingDtiPct = Math.round((newMonthlyHousingCostPln / safeIncome) * 1000) / 10;

  // Stressed calculation with +2.0% rate hike or custom stress
  const stressedFinancing: MortgageFinancingConfig = {
    ...financing,
    rateStressDeltaPct: (financing.rateStressDeltaPct || 0) + 2.0,
  };
  const stressedAmortization = calculateAmortization(propertySummary.loanPrincipalPln, stressedFinancing);
  const stressedInstallmentPln = stressedAmortization.firstMonthInstallmentPln;
  const stressedTotalHousingCostPln = stressedInstallmentPln + newCommunityAdminFeePln;
  const stressedHousingDtiPct = Math.round((stressedTotalHousingCostPln / safeIncome) * 1000) / 10;

  return {
    currentMonthlyRentPln,
    newMonthlyHousingCostPln,
    newMortgageInstallmentPln,
    newCommunityAdminFeePln,
    monthlyCashflowDeltaPln,
    householdNetIncomePln: Math.round(safeIncome),
    currentHousingDtiPct,
    newHousingDtiPct,
    stressedInstallmentPln,
    stressedHousingDtiPct,
  };
}
