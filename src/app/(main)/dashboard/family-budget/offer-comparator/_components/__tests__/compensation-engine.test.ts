import { describe, expect, it } from "vitest";

import {
  calculateAnnualGrossRevenuePln,
  calculateBenefitValuation,
  calculateEquityValuation,
  computeRestructureRevisionDiff,
  computeTimeOffMetrics,
  DEFAULT_COMPARATOR_CONFIG,
  normalizeOfferRevision,
  resolveEffectiveFxRate,
  simulateSideGigImpact,
} from "../compensation-engine";
import type { BenefitItem, EquityGrant, OfferRevision, SideGigAddon, TimeOffPolicy } from "../offer-types";

describe("Compensation, Time-Off & Benefit Normalization Engine", () => {
  describe("FX & Pessimistic Buffer", () => {
    it("applies pessimistic buffer to USD rate", () => {
      const config = {
        ...DEFAULT_COMPARATOR_CONFIG,
        manualFxOverrides: { USD: 4.0 },
        fxPessimisticBufferPct: { USD: 0.05 },
      };

      const fx = resolveEffectiveFxRate("USD", config);
      expect(fx.baseRate).toBe(4.0);
      expect(fx.bufferPct).toBe(0.05);
      expect(fx.effectiveRate).toBeCloseTo(3.8, 4);
    });

    it("leaves PLN unchanged without buffer", () => {
      const fx = resolveEffectiveFxRate("PLN", DEFAULT_COMPARATOR_CONFIG);
      expect(fx.baseRate).toBe(1.0);
      expect(fx.effectiveRate).toBe(1.0);
    });
  });

  describe("Time-Off Models", () => {
    it("normalizes Model A (Separate Pools) with sick pay coverage", () => {
      const modelA: TimeOffPolicy = {
        model: "model_a_separate",
        paidVacationDays: 26,
        paidSickDays: 10,
        sickPayPct: 80,
        paidStateHolidays: 13,
      };

      const metrics = computeTimeOffMetrics(modelA, 8, 252, 13);
      expect(metrics.timeOffDaysTaken).toBe(26 + 10 + 13);
      expect(metrics.effectiveWorkingDays).toBe(252 - (26 + 10 + 13));
      // 252 - 10 + 10*0.8 = 250 paid days
      expect(metrics.annualPaidDays).toBe(250);
      expect(metrics.annualBillableHours).toBe(250 * 8);
    });

    it("normalizes Model B (Combined PTO Pool) with state holidays deducted", () => {
      const modelB: TimeOffPolicy = {
        model: "model_b_combined",
        combinedPtoDays: 30,
        stateHolidaysDeductedFromPool: true,
        paidStateHolidaysCount: 13,
      };

      const metrics = computeTimeOffMetrics(modelB, 8, 252, 13);
      expect(metrics.timeOffDaysTaken).toBe(30);
      expect(metrics.effectiveWorkingDays).toBe(252 - 30);
      expect(metrics.annualPaidDays).toBe(252);
    });

    it("normalizes Model C (Unpaid / Pure Hourly B2B) reducing billable hours", () => {
      const modelC: TimeOffPolicy = {
        model: "model_c_unpaid",
        plannedVacationDays: 24,
        estimatedSickDays: 5,
        stateHolidaysTaken: 13,
      };

      const metrics = computeTimeOffMetrics(modelC, 8, 252, 13);
      // 24 + 5 + 13 = 42 unpaid days off
      expect(metrics.timeOffDaysTaken).toBe(42);
      // 252 - 42 = 210 billable days = 1680 hours
      expect(metrics.effectiveWorkingDays).toBe(210);
      expect(metrics.annualBillableHours).toBe(1680);
    });

    it("calculates unpaid USD hourly gross under Model C with pessimistic buffer", () => {
      const config = {
        ...DEFAULT_COMPARATOR_CONFIG,
        manualFxOverrides: { USD: 4.0 },
        fxPessimisticBufferPct: { USD: 0.05 }, // 3.80 PLN/USD
      };

      const modelC: TimeOffPolicy = {
        model: "model_c_unpaid",
        plannedVacationDays: 24,
        estimatedSickDays: 5,
        stateHolidaysTaken: 13,
      };

      const res = calculateAnnualGrossRevenuePln({ period: "hourly", amount: 50, currency: "USD" }, modelC, config);

      // 1680 billable hours * 50 USD/hr = 84,000 USD
      // 84,000 * 3.80 PLN = 319,200 PLN annual gross
      expect(res.annualGrossPln).toBeCloseTo(319200, 1);
      expect(res.monthlyGrossPln).toBeCloseTo(26600, 1);
    });
  });

  describe("Two-Layer Benefit Valuation", () => {
    it("separates hard budget offsets from subjective utility weights", () => {
      const benefits: BenefitItem[] = [
        {
          id: "med",
          name: "Health Package",
          category: "health",
          nominalValuePln: 350,
          monthlyBudgetOffsetPln: 250, // Replaces 250 PLN real medical spend
          subjectiveUtilityWeightPct: 50, // Perceived 50% for the remaining 100 PLN
        },
        {
          id: "sport",
          name: "MultiSport",
          category: "sport",
          nominalValuePln: 180,
          monthlyBudgetOffsetPln: 0, // Doesn't replace anything
          subjectiveUtilityWeightPct: 30, // 30% of 180 = 54 PLN
        },
      ];

      const val = calculateBenefitValuation(benefits);
      expect(val.monthlyHardBudgetOffsetPln).toBe(250);
      expect(val.monthlySubjectiveUtilityPln).toBeCloseTo(100 * 0.5 + 180 * 0.3, 1);
      expect(val.totalMonthlyPerceivedBenefitPln).toBeCloseTo(250 + (100 * 0.5 + 180 * 0.3), 1);
    });

    it("deducts spouse copay when individual tier requires family upgrade", () => {
      const benefits: BenefitItem[] = [
        {
          id: "med-indiv",
          name: "Individual Health",
          category: "health",
          tier: "individual",
          nominalValuePln: 200,
          monthlyBudgetOffsetPln: 300,
          spouseCopayMonthlyPln: 150, // 150 PLN copay
          subjectiveUtilityWeightPct: 0,
        },
      ];

      const val = calculateBenefitValuation(benefits);
      expect(val.monthlyHardBudgetOffsetPln).toBe(150); // 300 - 150 = 150
    });
  });

  describe("Equity Valuation (RSU vs. ESOP)", () => {
    it("amortizes liquid RSUs after volatility discount and Belka tax", () => {
      const grants: EquityGrant[] = [
        {
          id: "rsu-1",
          type: "rsu",
          isLiquid: true,
          totalGrantValue: 40000, // 40k USD
          currency: "USD",
          vestingYears: 4,
          cliffMonths: 12,
          volatilityDiscountPct: 15,
          belkaTaxPct: 19,
        },
      ];

      const config = {
        ...DEFAULT_COMPARATOR_CONFIG,
        manualFxOverrides: { USD: 4.0 },
        fxPessimisticBufferPct: { USD: 0 },
      };

      const val = calculateEquityValuation(grants, config);
      // 40,000 USD * 4.0 = 160,000 PLN over 4 years = 40,000 PLN/yr pre-tax
      // 40,000 * 0.85 (15% discount) = 34,000 PLN/yr
      // 34,000 * 0.81 (19% Belka tax) = 27,540 PLN/yr net liquid equity
      // Monthly = 27,540 / 12 = 2,295 PLN/mo
      expect(val.monthlyLiquidEquityPln).toBeCloseTo(2295, 1);
      expect(val.hasIlliquidEquity).toBe(false);
    });

    it("excludes illiquid ESOP startup stock options from monthly cashflow", () => {
      const grants: EquityGrant[] = [
        {
          id: "esop-1",
          type: "esop",
          isLiquid: false,
          totalGrantValue: 50000,
          currency: "USD",
          vestingYears: 4,
          cliffMonths: 12,
          volatilityDiscountPct: 0,
          belkaTaxPct: 19,
        },
      ];

      const val = calculateEquityValuation(grants, DEFAULT_COMPARATOR_CONFIG);
      expect(val.monthlyLiquidEquityPln).toBe(0);
      expect(val.hasIlliquidEquity).toBe(true);
      expect(val.totalIlliquidEquityNominalPln).toBeGreaterThan(0);
    });
  });

  describe("Side-Gig Shared ZUS & Threshold Spillover", () => {
    it("simulates fractional B2B side gig without duplicating ZUS Społeczny", () => {
      const sideGig: SideGigAddon = {
        enabled: true,
        roleTitle: "Consulting",
        rateSpec: { period: "hourly", amount: 150, currency: "PLN" },
        hoursPerWeek: 10,
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 0,
          voluntarySickness: false,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
      };

      const sim = simulateSideGigImpact(
        240000, // Primary 240k PLN
        {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 250,
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        sideGig,
        DEFAULT_COMPARATOR_CONFIG,
      );

      expect(sim).toBeDefined();
      if (!sim) return;

      // 10h/wk * 52 wks * 150 PLN = 78,000 PLN/yr
      // 240,000 + 78,000 = 318,000 PLN -> crosses the 300,000 PLN Ryczałt health tier!
      expect(sim.crossesHealthTier).toBe(true);
      expect(sim.marginalNetMonthlyPln).toBeGreaterThan(3000);
      expect(sim.marginalNetHourlyRatePln).toBeGreaterThan(80);
    });
  });

  describe("Restructure Revision Diff", () => {
    it("computes diff between PLN baseline with family health and USD raise with individual health", () => {
      const rev1: OfferRevision = {
        id: "rev-1",
        trackId: "track-acme",
        title: "Rev 1: Baseline PLN",
        effectiveDate: "2024-01",
        rateSpec: { period: "monthly", amount: 20000, currency: "PLN" },
        timeOff: {
          model: "model_b_combined",
          combinedPtoDays: 26,
          stateHolidaysDeductedFromPool: false,
          paidStateHolidaysCount: 13,
        },
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 250,
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        benefits: [
          {
            id: "b1",
            name: "Family Health",
            category: "health",
            tier: "family",
            nominalValuePln: 500,
            monthlyBudgetOffsetPln: 400,
            subjectiveUtilityWeightPct: 0,
          },
        ],
        equityGrants: [],
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      const rev2: OfferRevision = {
        ...rev1,
        id: "rev-2",
        title: "Rev 2: USD Restructure",
        effectiveDate: "2024-06",
        rateSpec: { period: "monthly", amount: 6500, currency: "USD" }, // ~26k PLN
        benefits: [
          {
            id: "b1",
            name: "Individual Health",
            category: "health",
            tier: "individual",
            nominalValuePln: 250,
            monthlyBudgetOffsetPln: 200,
            spouseCopayMonthlyPln: 200,
            subjectiveUtilityWeightPct: 0,
          },
        ],
      };

      const diff = computeRestructureRevisionDiff(rev1, rev2, DEFAULT_COMPARATOR_CONFIG);
      expect(diff.monthlyGrossDeltaPln).toBeGreaterThan(4000);
      expect(diff.fxBufferDragPln).toBeGreaterThan(0);
      expect(diff.spouseDowngradeCostPln).toBe(200);
      expect(diff.netMonthlyGainPln).toBeGreaterThan(0);
    });
  });
});
