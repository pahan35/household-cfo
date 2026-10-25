import { describe, expect, it } from "vitest";

import type {
  TaxProfileB2bLiniowy,
  TaxProfileB2bRyczalt,
  TaxProfileB2bSkala,
  TaxProfileCustom,
  TaxProfileUop,
} from "../offer-types";
import {
  calculateB2bLiniowyTaxes,
  calculateB2bRyczaltTaxes,
  calculateB2bSkalaTaxes,
  calculateCustomTaxes,
  calculateUopTaxes,
  computeMultiYearTaxProjection,
  getMonthlyZusSpoleczny,
  resolveZusStageForYear,
  STATUTORY_DEFAULTS,
} from "../polish-tax-engine";

describe("Polish Tax & ZUS Engine", () => {
  describe("ZUS Stage & Inflation Helpers", () => {
    it("returns zero ZUS Społeczny for ulga_na_start", () => {
      const zus = getMonthlyZusSpoleczny("ulga_na_start", true);
      expect(zus.totalSpoleczny).toBe(0);
      expect(zus.pensionDisability).toBe(0);
    });

    it("calculates preferential and duzy ZUS amounts", () => {
      const pref = getMonthlyZusSpoleczny("preferencyjny", true);
      expect(pref.totalSpoleczny).toBeGreaterThan(350);
      expect(pref.totalSpoleczny).toBeLessThan(500);

      const duzy = getMonthlyZusSpoleczny("duzy_zus", true);
      expect(duzy.totalSpoleczny).toBeGreaterThan(1500);
      expect(duzy.totalSpoleczny).toBeLessThan(1800);
    });

    it("progresses ZUS stages across years 1, 2, and 3", () => {
      expect(resolveZusStageForYear("ulga_na_start", 1)).toBe("ulga_na_start");
      expect(resolveZusStageForYear("ulga_na_start", 2)).toBe("preferencyjny");
      expect(resolveZusStageForYear("ulga_na_start", 3)).toBe("preferencyjny");

      expect(resolveZusStageForYear("preferencyjny", 1)).toBe("preferencyjny");
      expect(resolveZusStageForYear("preferencyjny", 2)).toBe("duzy_zus");
      expect(resolveZusStageForYear("preferencyjny", 3)).toBe("duzy_zus");
    });
  });

  describe("B2B Ryczałt Calculations", () => {
    const baseRyczaltProfile: TaxProfileB2bRyczalt = {
      regime: "b2b_ryczalt",
      ryczaltRatePct: 12,
      zusStage: "duzy_zus",
      monthlyAccountingCostPln: 250,
      voluntarySickness: true,
      pfronRebate: {
        enabled: false,
        type: "percentage",
        percentage: 60,
        fixedAmountPln: 0,
      },
    };

    it("correctly applies Tier 1, Tier 2, and Tier 3 health contribution thresholds", () => {
      // Tier 1: <= 60k
      const t1 = calculateB2bRyczaltTaxes(50000, baseRyczaltProfile);
      expect(t1.annualHealthInsurancePln).toBeCloseTo(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY * 12, 1);

      // Tier 2: 60k–300k
      const t2 = calculateB2bRyczaltTaxes(200000, baseRyczaltProfile);
      expect(t2.annualHealthInsurancePln).toBeCloseTo(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY * 12, 1);

      // Tier 3: > 300k
      const t3 = calculateB2bRyczaltTaxes(350000, baseRyczaltProfile);
      expect(t3.annualHealthInsurancePln).toBeCloseTo(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY * 12, 1);
    });

    it("deducts 50% of health contribution and full ZUS Spoleczny from ryczalt taxable revenue", () => {
      const revenue = 240000;
      const res = calculateB2bRyczaltTaxes(revenue, baseRyczaltProfile);
      const expectedHealth = STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER2_MONTHLY * 12;
      const expectedZus = res.annualZusSpolecznyPln;
      const expectedTaxable = revenue - expectedZus - 0.5 * expectedHealth;
      const expectedPit = expectedTaxable * 0.12;

      expect(res.annualPitPln).toBeCloseTo(expectedPit, 2);
      expect(res.annualNetCashflowPln).toBeCloseTo(
        revenue - (expectedZus + expectedHealth + expectedPit + 250 * 12),
        2,
      );
    });

    it("applies PFRON ZUS cashback rebate to reduce net ZUS contributions", () => {
      const profileWithPfron: TaxProfileB2bRyczalt = {
        ...baseRyczaltProfile,
        pfronRebate: {
          enabled: true,
          type: "percentage",
          percentage: 60,
          fixedAmountPln: 0,
        },
      };

      const res = calculateB2bRyczaltTaxes(200000, profileWithPfron);
      expect(res.annualPfronRebatePln).toBeGreaterThan(0);
      expect(res.annualNetZusSpolecznyPln).toBe(res.annualZusSpolecznyPln - res.annualPfronRebatePln);
      // Net cashflow should be higher by the PFRON rebate
      const noPfronRes = calculateB2bRyczaltTaxes(200000, baseRyczaltProfile);
      expect(res.annualNetCashflowPln).toBeCloseTo(noPfronRes.annualNetCashflowPln + res.annualPfronRebatePln, 2);
    });

    it("projects 3-year multi-year horizon with ZUS base growth", () => {
      const startingPref: TaxProfileB2bRyczalt = {
        ...baseRyczaltProfile,
        zusStage: "preferencyjny",
        pfronRebate: {
          enabled: true,
          type: "percentage",
          percentage: 60,
          fixedAmountPln: 0,
        },
      };

      const projection = computeMultiYearTaxProjection(250000, startingPref, {
        annualStaticCostGrowthPct: 0.08,
      });

      // Year 1 is preferencyjny ZUS
      expect(projection.year1.annualZusSpolecznyPln).toBeLessThan(6000);
      // Year 2 transitions to duży ZUS with inflation
      expect(projection.year2.annualZusSpolecznyPln).toBeGreaterThan(18000);
      // Year 3 has inflated duży ZUS
      expect(projection.year3.annualZusSpolecznyPln).toBeGreaterThan(projection.year2.annualZusSpolecznyPln);
      // PFRON rebate scales with ZUS increase
      expect(projection.year2.annualPfronRebatePln).toBeGreaterThan(projection.year1.annualPfronRebatePln);
    });
  });

  describe("B2B Podatek Liniowy & Skala", () => {
    it("calculates 19% PIT and 4.9% health insurance on Liniowy with expense deductions", () => {
      const liniowyProfile: TaxProfileB2bLiniowy = {
        regime: "b2b_liniowy",
        pitRatePct: 19,
        healthRatePct: 4.9,
        monthlyDeductibleCostsPln: 2000,
        monthlyAccountingCostPln: 300,
        zusStage: "duzy_zus",
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      };

      const res = calculateB2bLiniowyTaxes(300000, liniowyProfile);
      expect(res.annualGrossPln).toBe(300000);
      expect(res.annualHealthInsurancePln).toBeGreaterThan(10000);
      expect(res.annualPitPln).toBeGreaterThan(40000);
      expect(res.annualNetCashflowPln).toBeLessThan(300000);
    });

    it("calculates progressive 12% and 32% brackets on B2B Skala", () => {
      const skalaProfile: TaxProfileB2bSkala = {
        regime: "b2b_skala",
        monthlyDeductibleCostsPln: 500,
        monthlyAccountingCostPln: 250,
        zusStage: "duzy_zus",
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      };

      const lowIncome = calculateB2bSkalaTaxes(50000, skalaProfile);
      expect(lowIncome.annualPitPln).toBeLessThan(3000);

      const highIncome = calculateB2bSkalaTaxes(250000, skalaProfile);
      // High income crosses 120k bracket into 32%
      expect(highIncome.annualPitPln).toBeGreaterThan(30000);
    });
  });

  describe("UoP (Umowa o Pracę) Cumulative Simulation", () => {
    const baseUopProfile: TaxProfileUop = {
      regime: "uop",
      hasAkup: false,
      creativeWorkPct: 0,
      ppkEmployeePct: 2,
      ppkEmployerPct: 1.5,
      jointTaxFiling: false,
      disabilityRights: {
        enabled: false,
        statutoryHoursPerWeek: 35,
        extraVacationDays: 10,
      },
    };

    it("applies cumulative 30x ZUS cap for high earners", () => {
      // 360k PLN/yr = 30k/mo, which crosses the ~234k cap around month 8
      const res = calculateUopTaxes(360000, baseUopProfile);
      // If uncapped, employee pension+disability would be 360k * 11.26% = 40,536 PLN
      // With cap at ~234,720 PLN, pension+disability is ~234,720 * 11.26% = 26,429 PLN
      // Plus uncapped sickness 360k * 2.45% = 8,820 PLN
      // Total capped ZUS ~ 35,249 PLN vs uncapped 49,356 PLN
      expect(res.annualZusSpolecznyPln).toBeLessThan(40000);
    });

    it("applies 50% AKUP copyright deduction capped at 120,000 PLN/year", () => {
      const uopWithAkup: TaxProfileUop = {
        ...baseUopProfile,
        hasAkup: true,
        creativeWorkPct: 80,
      };

      const normalRes = calculateUopTaxes(240000, baseUopProfile);
      const akupRes = calculateUopTaxes(240000, uopWithAkup);

      // AKUP significantly reduces taxable income and therefore PIT
      expect(akupRes.annualPitPln).toBeLessThan(normalRes.annualPitPln);
      expect(akupRes.annualNetCashflowPln).toBeGreaterThan(normalRes.annualNetCashflowPln);
    });

    it("verifies direct PFRON cash rebate is zero on UoP", () => {
      const res = calculateUopTaxes(180000, baseUopProfile);
      expect(res.annualPfronRebatePln).toBe(0);
    });
  });

  describe("Custom Profile Fallback", () => {
    it("computes flat percentage and static monthly cost", () => {
      const customProfile: TaxProfileCustom = {
        regime: "custom",
        effectiveTaxRatePct: 20,
        staticMonthlyCostPln: 500,
      };

      const res = calculateCustomTaxes(100000, customProfile);
      expect(res.annualPitPln).toBe(20000);
      expect(res.annualAccountingCostPln).toBe(6000);
      expect(res.annualNetCashflowPln).toBe(74000);
      expect(res.monthlyNetCashflowPln).toBeCloseTo(74000 / 12, 2);
    });
  });
});
