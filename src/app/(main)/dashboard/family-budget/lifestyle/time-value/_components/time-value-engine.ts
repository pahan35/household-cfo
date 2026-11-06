/**
 * Time & Opportunity Engine
 *
 * Pure, deterministic domain calculations:
 * 1. Joy vs. Drift Screen Time Partitioning
 * 2. 3-Way Drift Reallocation (Extra Income, Learning, Restorative Relax)
 * 3. Primary Partner Marginal Rate & Vacation vs. Day-Off Monetization Dial
 * 4. Spouse Freelancing & Family Pet Project Compound Value
 * 5. Learning Subscription Active ROI & Rate Compounding
 * 6. Multi-Goal Acceleration (1st Mortgage Milestones 1 & 2, m² per year, Dream Trips, Personal Goals)
 */

import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderTransaction,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import {
  computeLearningMetrics,
  detectTravelEpisodes,
} from "@/app/(main)/dashboard/family-budget/_components/lifestyle-transforms";
import { normalizeOfferRevision } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/compensation-engine";
import type { OfferRevision } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";

import type {
  ComputedPlayerCashflow,
  ComputedPlayerReallocation,
  ComputedPlayerScreenTime,
  ComputedTimeValueSummary,
  DriftReallocationSplit,
  FamilyPetProject,
  HistoricalTripBenchmark,
  LearningRoiSummary,
  MortgageGoalAcceleration,
  PersonalGoal,
  PrimaryMonetizationSettings,
  PrimaryPlayerProfile,
  ScreenTimeReflection,
  SpouseOpportunitySettings,
  SpousePlayerProfile,
  TimeValueMotivatorConfig,
} from "./time-value-types";

// ---------------------------------------------------------------------------
// 1. Screen Time Joy vs. Drift Partitioning
// ---------------------------------------------------------------------------

export function computePlayerScreenTime(screenTime: ScreenTimeReflection): ComputedPlayerScreenTime {
  const gamingTotal = Math.max(0, screenTime.gamingTotalHours);
  const gamingJoy = Math.min(gamingTotal, Math.max(0, screenTime.gamingJoyHours));
  const socialTotal = Math.max(0, screenTime.socialTotalHours);
  const socialJoy = Math.min(socialTotal, Math.max(0, screenTime.socialJoyHours));

  const totalHours = Math.round((gamingTotal + socialTotal) * 10) / 10;
  const joyfulHours = Math.round((gamingJoy + socialJoy) * 10) / 10;
  const driftHours = Math.max(0, Math.round((totalHours - joyfulHours) * 10) / 10);

  const joyRatioPct = totalHours > 0 ? Math.round((joyfulHours / totalHours) * 100) : 100;
  const driftRatioPct = totalHours > 0 ? Math.round((driftHours / totalHours) * 100) : 0;
  const isAllJoyCelebration = totalHours > 0 && driftHours === 0;

  return {
    totalHours,
    joyfulHours,
    driftHours,
    joyRatioPct,
    driftRatioPct,
    isAllJoyCelebration,
  };
}

// ---------------------------------------------------------------------------
// 2. 3-Way Drift Reallocation
// ---------------------------------------------------------------------------

export function computePlayerReallocation(
  driftHours: number,
  split: DriftReallocationSplit,
): ComputedPlayerReallocation {
  const sideHustle = Math.max(0, split.sideHustleHours);
  const learning = Math.max(0, split.learningHours);
  const properRelax = Math.max(0, split.properRelaxHours);
  const efficiency = Math.max(0, Math.min(100, split.focusEfficiencyPct)) / 100;

  const sideHustleEffectiveHours = Math.round(sideHustle * efficiency * 10) / 10;

  return {
    reclaimedDriftHours: driftHours,
    sideHustleEffectiveHours,
    learningHours: learning,
    properRelaxHours: properRelax,
  };
}

// ---------------------------------------------------------------------------
// 3. Primary Partner Monetization & Day-Off Dial
// ---------------------------------------------------------------------------

export function resolvePrimaryHourlyRate(
  monetization: PrimaryMonetizationSettings,
  activeRevision?: OfferRevision | null,
): number {
  if (monetization.rateSource === "manual" || !activeRevision) {
    return Math.max(0, monetization.manualRatePln);
  }

  try {
    const summary = normalizeOfferRevision(activeRevision);
    const effectiveRate = summary.effectiveNetHourlyRatePln;
    if (effectiveRate && effectiveRate > 0) {
      return Math.round(effectiveRate);
    }
  } catch {
    // Graceful fallback to manual rate if calculation fails
  }

  return Math.max(0, monetization.manualRatePln);
}

export function computePrimaryCashflow(
  reallocation: ComputedPlayerReallocation,
  monetization: PrimaryMonetizationSettings,
  effectiveHourlyRatePln: number,
): ComputedPlayerCashflow {
  // Weekly hours -> Monthly cashflow (52 weeks / 12 months)
  const monthlySideHustleCashflowPln = Math.round(
    reallocation.sideHustleEffectiveHours * (52 / 12) * effectiveHourlyRatePln,
  );
  const annualSideHustleCashflowPln = monthlySideHustleCashflowPln * 12;

  // Day-off monetization
  const monetizedDays = Math.max(0, Math.min(monetization.annualDaysOffPool, monetization.monetizedDaysOff));
  const dayOffAnnualHours = monetizedDays * Math.max(0, monetization.hoursPerDayOff);
  const dayOffMonetizationAnnualPln = Math.round(dayOffAnnualHours * effectiveHourlyRatePln);
  const dayOffMonetizationMonthlyPln = Math.round(dayOffMonetizationAnnualPln / 12);

  const totalMonthlyValuePln = monthlySideHustleCashflowPln + dayOffMonetizationMonthlyPln;

  return {
    monthlySideHustleCashflowPln,
    annualSideHustleCashflowPln,
    dayOffMonetizationAnnualPln,
    dayOffMonetizationMonthlyPln,
    spouseMonthlySavingsPln: 0,
    spouseHoursSavedPerWeek: 0,
    spouseProjectedMonthlyRevenuePln: 0,
    spouseEarnedBountiesPln: 0,
    totalMonthlyValuePln,
    effectiveHourlyRatePln,
  };
}

// ---------------------------------------------------------------------------
// 4. Spouse Opportunity Engine (Freelancing & Pet Projects)
// ---------------------------------------------------------------------------

export function computeSpouseCashflow(
  reallocation: ComputedPlayerReallocation,
  opportunity: SpouseOpportunitySettings,
  petProjects: FamilyPetProject[],
): ComputedPlayerCashflow {
  let monthlySideHustleCashflowPln = 0;
  const effectiveRate = opportunity.freelance.hourlyRatePln;

  if (opportunity.freelance.enabled) {
    monthlySideHustleCashflowPln = Math.round(
      reallocation.sideHustleEffectiveHours * (52 / 12) * Math.max(0, effectiveRate),
    );
  }

  let spouseMonthlySavingsPln = 0;
  let spouseHoursSavedPerWeek = 0;
  let spouseHoursSavedValueMonthlyPln = 0;
  let spouseProjectedMonthlyRevenuePln = 0;
  let spouseEarnedBountiesPln = 0;

  if (opportunity.petProjectsEnabled) {
    for (const project of petProjects) {
      if (project.status === "active" || project.status === "completed") {
        spouseMonthlySavingsPln += Math.max(0, project.monthlyExpenseSavedPln);
        const hoursSaved = Math.max(0, project.weeklyHouseholdHoursSaved);
        spouseHoursSavedPerWeek += hoursSaved;
        spouseHoursSavedValueMonthlyPln += Math.round(
          hoursSaved * (52 / 12) * Math.max(0, project.hoursSavedValuedAtPln),
        );
        spouseProjectedMonthlyRevenuePln += Math.max(0, project.projectedLaunchMonthlyIncomePln);
      }
      if (project.milestoneCompleted) {
        spouseEarnedBountiesPln += Math.max(0, project.milestoneBountyPln);
      }
    }
  }

  const totalMonthlyValuePln =
    monthlySideHustleCashflowPln +
    spouseMonthlySavingsPln +
    spouseHoursSavedValueMonthlyPln +
    spouseProjectedMonthlyRevenuePln;

  return {
    monthlySideHustleCashflowPln,
    annualSideHustleCashflowPln: monthlySideHustleCashflowPln * 12,
    dayOffMonetizationAnnualPln: 0,
    dayOffMonetizationMonthlyPln: 0,
    spouseMonthlySavingsPln,
    spouseHoursSavedPerWeek,
    spouseProjectedMonthlyRevenuePln,
    spouseEarnedBountiesPln,
    totalMonthlyValuePln,
    effectiveHourlyRatePln: effectiveRate,
  };
}

// ---------------------------------------------------------------------------
// 5. Learning ROI & Rate Compounding
// ---------------------------------------------------------------------------

export function computeLearningRoi(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  weeklyStudyHours: number;
  projectedRateGrowthPct: number;
  currentHourlyRatePln: number;
}): LearningRoiSummary {
  const { transactions, categories, currencies, weeklyStudyHours, projectedRateGrowthPct, currentHourlyRatePln } =
    input;

  let monthlyLearningSpendPln = 0;
  try {
    const metrics = computeLearningMetrics({
      transactions,
      categories,
      currencies,
      defaultCurrency: "PLN",
    });

    // Approximate monthly learning spend from trailing 90 days or annual
    if (metrics.monthlyRunRate > 0) {
      monthlyLearningSpendPln = Math.round(metrics.monthlyRunRate);
    } else if (metrics.totalSpend > 0) {
      monthlyLearningSpendPln = Math.round(metrics.totalSpend / 12);
    }
  } catch {
    // Safe fallback if transactions empty
  }

  const monthlyStudyHours = Math.round(Math.max(0, weeklyStudyHours) * (52 / 12) * 10) / 10;
  const activeCostPerStudyHourPln =
    monthlyStudyHours > 0 && monthlyLearningSpendPln > 0
      ? Math.round((monthlyLearningSpendPln / monthlyStudyHours) * 10) / 10
      : 0;

  const projectedCareerRateLiftPln = Math.round(
    Math.max(0, currentHourlyRatePln) * (Math.max(0, projectedRateGrowthPct) / 100),
  );

  return {
    monthlyExternalProviderLearningSpendPln: monthlyLearningSpendPln,
    weeklyStudyHours,
    monthlyStudyHours,
    activeCostPerStudyHourPln,
    projectedCareerRateLiftPln,
  };
}

// ---------------------------------------------------------------------------
// 6. Mortgage Goal Acceleration
// ---------------------------------------------------------------------------

export function computeMortgageAcceleration(input: {
  baselineMonthlySavingsPln: number;
  monthlyExtraCashflowPln: number;
  milestone1GapPln: number;
  totalGapPln: number;
  pricePerSqmPln: number;
}): MortgageGoalAcceleration {
  const { baselineMonthlySavingsPln, monthlyExtraCashflowPln, milestone1GapPln, totalGapPln, pricePerSqmPln } = input;

  const baselinePace = Math.max(0, baselineMonthlySavingsPln);
  const extraPace = Math.max(0, monthlyExtraCashflowPln);
  const acceleratedPace = baselinePace + extraPace;

  const calcMonths = (gap: number, pace: number): number => {
    if (gap <= 0) return 0;
    if (pace <= 0) return 999;
    return Math.round((gap / pace) * 10) / 10;
  };

  const baselineMonthsM1 = calcMonths(milestone1GapPln, baselinePace);
  const acceleratedMonthsM1 = calcMonths(milestone1GapPln, acceleratedPace);
  const monthsSavedM1 =
    baselineMonthsM1 < 999 ? Math.max(0, Math.round((baselineMonthsM1 - acceleratedMonthsM1) * 10) / 10) : 0;

  const baselineMonthsM2 = calcMonths(totalGapPln, baselinePace);
  const acceleratedMonthsM2 = calcMonths(totalGapPln, acceleratedPace);
  const monthsSavedM2 =
    baselineMonthsM2 < 999 ? Math.max(0, Math.round((baselineMonthsM2 - acceleratedMonthsM2) * 10) / 10) : 0;

  const annualExtraIncomePln = extraPace * 12;
  const unlockedSqmPerYear = pricePerSqmPln > 0 ? Math.round((annualExtraIncomePln / pricePerSqmPln) * 10) / 10 : 0;

  return {
    baselineMonthsMilestone1: baselineMonthsM1,
    acceleratedMonthsMilestone1: acceleratedMonthsM1,
    monthsSavedMilestone1: monthsSavedM1,
    milestone1GapPln: Math.max(0, milestone1GapPln),
    baselineMonthsMilestone2: baselineMonthsM2,
    acceleratedMonthsMilestone2: acceleratedMonthsM2,
    monthsSavedMilestone2: monthsSavedM2,
    totalGapPln: Math.max(0, totalGapPln),
    monthlyExtraIncomePln: extraPace,
    annualExtraIncomePln,
    pricePerSqmPln: Math.max(0, pricePerSqmPln),
    unlockedSqmPerYear,
  };
}

// ---------------------------------------------------------------------------
// 7. Dream Trip Benchmarks
// ---------------------------------------------------------------------------

export function computeTripBenchmarks(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  annualCashflowPln: number;
  monthlyCashflowPln: number;
}): HistoricalTripBenchmark[] {
  const { transactions, categories, currencies, annualCashflowPln, monthlyCashflowPln } = input;
  const benchmarks: HistoricalTripBenchmark[] = [];

  try {
    const episodes = detectTravelEpisodes({
      transactions,
      categories,
      currencies,
      defaultCurrency: "PLN",
    });

    // Select top notable travel episodes with cost > 2,000 PLN
    const validEpisodes = episodes
      .filter((ep) => ep.totalCost >= 2000)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 4);

    for (const ep of validEpisodes) {
      const cost = Math.round(ep.totalCost);
      const multiplierPerYear = cost > 0 ? Math.round((annualCashflowPln / cost) * 10) / 10 : 0;
      const monthsToFund = monthlyCashflowPln > 0 ? Math.round((cost / monthlyCashflowPln) * 10) / 10 : 0;

      benchmarks.push({
        id: ep.id,
        destinationTag: ep.destinationTag,
        name: ep.name,
        totalCostPln: cost,
        multiplierPerYear,
        monthsToFund,
      });
    }
  } catch {
    // Safe fallback if travel episodes cannot be parsed
  }

  // If no historical episodes found, provide representative reference benchmarks
  if (benchmarks.length === 0) {
    const defaults = [
      { id: "trip-madeira", destinationTag: "madeira", name: "Madeira Active Holiday", cost: 8500 },
      { id: "trip-austria", destinationTag: "austria", name: "Austria Alps Ski & Spa", cost: 6200 },
      { id: "trip-rome", destinationTag: "rome", name: "Rome Weekend & Wellness", cost: 4500 },
    ];
    for (const d of defaults) {
      benchmarks.push({
        id: d.id,
        destinationTag: d.destinationTag,
        name: d.name,
        totalCostPln: d.cost,
        multiplierPerYear: d.cost > 0 ? Math.round((annualCashflowPln / d.cost) * 10) / 10 : 0,
        monthsToFund: monthlyCashflowPln > 0 ? Math.round((d.cost / monthlyCashflowPln) * 10) / 10 : 0,
      });
    }
  }

  return benchmarks;
}

// ---------------------------------------------------------------------------
// 8. Personal Goals Acceleration Evaluator
// ---------------------------------------------------------------------------

export function evaluatePersonalGoals(
  goals: PersonalGoal[],
  monthlyCashflowWifePln: number,
  monthlyCashflowHouseholdPln: number,
): Array<PersonalGoal & { monthsToFund: number; isFunded: boolean; gapPln: number }> {
  return goals.map((goal) => {
    const gapPln = Math.max(0, goal.targetAmountPln - goal.currentSavedPln);
    const applicablePace =
      goal.owner === "wife" ? Math.max(500, monthlyCashflowWifePln) : Math.max(500, monthlyCashflowHouseholdPln);
    const monthsToFund = gapPln > 0 ? Math.round((gapPln / applicablePace) * 10) / 10 : 0;
    const isFunded = gapPln === 0;

    return {
      ...goal,
      gapPln,
      monthsToFund,
      isFunded,
    };
  });
}

// ---------------------------------------------------------------------------
// 9. Comprehensive Summary Aggregator
// ---------------------------------------------------------------------------

export function computeComprehensiveTimeValueSummary(input: {
  config: TimeValueMotivatorConfig;
  activeOfferRevision?: OfferRevision | null;
  baselineMonthlySavingsPln: number;
  milestone1GapPln: number;
  totalMortgageGapPln: number;
  pricePerSqmPln: number;
  transactions?: ExternalProviderTransaction[];
  categories?: ExternalProviderCategory[];
  currencies?: ExternalProviderCurrency[];
}): ComputedTimeValueSummary {
  const {
    config,
    activeOfferRevision,
    baselineMonthlySavingsPln,
    milestone1GapPln,
    totalMortgageGapPln,
    pricePerSqmPln,
    transactions = [],
    categories = [],
    currencies = [],
  } = input;

  // Me
  const meScreen = computePlayerScreenTime(config.me.screenTime);
  const meRealloc = computePlayerReallocation(meScreen.driftHours, config.me.reallocation);
  const meRate = resolvePrimaryHourlyRate(config.me.monetization, activeOfferRevision);
  const meCashflow = computePrimaryCashflow(meRealloc, config.me.monetization, meRate);
  const meCareAppreciation = Math.round(
    config.me.care.careHoursPerWeek * (52 / 12) * config.me.care.referenceHourlyRatePln,
  );

  // Wife
  const wifeScreen = computePlayerScreenTime(config.wife.screenTime);
  const wifeRealloc = computePlayerReallocation(wifeScreen.driftHours, config.wife.reallocation);
  const wifeCashflow = computeSpouseCashflow(wifeRealloc, config.wife.opportunity, config.petProjects);
  const wifeCareAppreciation = Math.round(
    config.wife.care.careHoursPerWeek * (52 / 12) * config.wife.care.referenceHourlyRatePln,
  );

  // Household aggregates
  const totalWeeklyJoyHours = Math.round((meScreen.joyfulHours + wifeScreen.joyfulHours) * 10) / 10;
  const totalWeeklyDriftHours = Math.round((meScreen.driftHours + wifeScreen.driftHours) * 10) / 10;
  const totalWeeklyReclaimedHours =
    Math.round(
      (meRealloc.sideHustleEffectiveHours +
        meRealloc.learningHours +
        meRealloc.properRelaxHours +
        wifeRealloc.sideHustleEffectiveHours +
        wifeRealloc.learningHours +
        wifeRealloc.properRelaxHours) *
        10,
    ) / 10;
  const totalWeeklyCareHours = config.me.care.careHoursPerWeek + config.wife.care.careHoursPerWeek;
  const totalWeeklyRelaxHours = meRealloc.properRelaxHours + wifeRealloc.properRelaxHours;
  const totalWeeklyLearningHours = meRealloc.learningHours + wifeRealloc.learningHours;

  const totalMonthlyCashflowBoostPln = meCashflow.totalMonthlyValuePln + wifeCashflow.monthlySideHustleCashflowPln;
  const totalAnnualCashflowBoostPln = totalMonthlyCashflowBoostPln * 12;
  const totalSpouseMonthlyValuePln = wifeCashflow.totalMonthlyValuePln;

  const sacredVacationDays = Math.max(
    0,
    config.me.monetization.annualDaysOffPool - config.me.monetization.monetizedDaysOff,
  );
  const monetizedDaysOff = config.me.monetization.monetizedDaysOff;

  // Learning ROI
  const learningRoi = computeLearningRoi({
    transactions,
    categories,
    currencies,
    weeklyStudyHours: totalWeeklyLearningHours,
    projectedRateGrowthPct: config.learningProjectedRateGrowthPct,
    currentHourlyRatePln: meRate,
  });

  // Mortgage Acceleration
  const mortgageAcceleration = computeMortgageAcceleration({
    baselineMonthlySavingsPln,
    monthlyExtraCashflowPln: totalMonthlyCashflowBoostPln,
    milestone1GapPln,
    totalGapPln: totalMortgageGapPln,
    pricePerSqmPln,
  });

  // Trip Benchmarks
  const tripBenchmarks = computeTripBenchmarks({
    transactions,
    categories,
    currencies,
    annualCashflowPln: totalAnnualCashflowBoostPln,
    monthlyCashflowPln: totalMonthlyCashflowBoostPln,
  });

  return {
    me: {
      screenTime: meScreen,
      reallocation: meRealloc,
      cashflow: meCashflow,
      careAppreciationPln: meCareAppreciation,
    },
    wife: {
      screenTime: wifeScreen,
      reallocation: wifeRealloc,
      cashflow: wifeCashflow,
      careAppreciationPln: wifeCareAppreciation,
    },
    household: {
      totalWeeklyJoyHours,
      totalWeeklyDriftHours,
      totalWeeklyReclaimedHours,
      totalWeeklyCareHours,
      totalWeeklyRelaxHours,
      totalWeeklyLearningHours,
      totalMonthlyCashflowBoostPln,
      totalAnnualCashflowBoostPln,
      totalSpouseMonthlyValuePln,
      sacredVacationDays,
      monetizedDaysOff,
    },
    learningRoi,
    mortgageAcceleration,
    tripBenchmarks,
  };
}
