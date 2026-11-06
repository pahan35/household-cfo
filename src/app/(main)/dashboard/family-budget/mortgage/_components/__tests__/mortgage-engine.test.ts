import { describe, expect, it } from "vitest";

import { CategoryType } from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";

import {
  auditSavingsPace,
  calculateAmortization,
  calculateBudgetImpact,
  calculateCourtFees,
  calculateNotaryFees,
  calculateOverlapTimeline,
  calculatePropertyAcquisition,
  DEFAULT_MORTGAGE_FINANCING_CONFIG,
  DEFAULT_OVERLAP_TIMELINE_CONFIG,
  DEFAULT_PROPERTY_ACQUISITION_CONFIG,
} from "../mortgage-engine";
import type { MortgageFinancingConfig, OverlapTimelineConfig, PropertyAcquisitionConfig } from "../mortgage-types";

describe("mortgage-engine", () => {
  describe("calculateNotaryFees and calculateCourtFees", () => {
    it("computes court and land register fees according to statutory amounts", () => {
      const court = calculateCourtFees();
      expect(court.ownershipRegisterEntryPln).toBe(200);
      expect(court.mortgageRegisterEntryPln).toBe(200);
      expect(court.pcc3MortgageTaxPln).toBe(19);
      expect(court.totalCourtFeesPln).toBe(419);
    });

    it("computes notary fees with 23% VAT and splits 50/50 for developer agreement", () => {
      const notary = calculateNotaryFees(1000000);
      expect(notary.baseFeePln).toBeGreaterThan(1000);
      expect(notary.vatPln).toBeCloseTo(notary.baseFeePln * 0.23, 1);
      expect(notary.totalNotaryWithVatPln).toBeCloseTo(notary.baseFeePln + notary.vatPln, 1);
      expect(notary.buyerSharePln).toBeCloseTo(notary.totalNotaryWithVatPln / 2, 1);
    });
  });

  describe("calculatePropertyAcquisition", () => {
    it("computes property acquisition with 0% PCC, parking, storage, and 20% down payment", () => {
      const config: PropertyAcquisitionConfig = {
        ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
        pricingMode: "area_and_price_per_sqm",
        areaSqm: 65,
        pricePerSqmPln: 15000, // 975,000 PLN
        includeParking: true,
        parkingPricePln: 45000,
        includeStorage: true,
        storagePricePln: 15000,
        renovationBudgetPln: 200000,
        renovationContingencyPct: 0,
        renovationFundingMode: "cash",
      };

      const summary = calculatePropertyAcquisition(config, 20);

      expect(summary.apartmentPricePln).toBe(975000);
      expect(summary.parkingPricePln).toBe(45000);
      expect(summary.storagePricePln).toBe(15000);
      expect(summary.propertyTotalPln).toBe(1035000);
      expect(summary.pccTaxPln).toBe(0);
      expect(summary.pccTaxRatePct).toBe(0);
      expect(summary.downPaymentPln).toBe(207000); // 20% of 1,035,000
      expect(summary.loanPrincipalPln).toBe(828000); // 80% of 1,035,000
      expect(summary.upfrontCashMilestone1Pln).toBe(207000 + summary.totalClosingFeesPln);
      expect(summary.upfrontCashMilestone2Pln).toBe(200000);
      expect(summary.totalCashRequiredPln).toBe(summary.upfrontCashMilestone1Pln + 200000);
    });

    it("bundles renovation into mortgage when renovationFundingMode is mortgage", () => {
      const config: PropertyAcquisitionConfig = {
        ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
        pricingMode: "area_and_price_per_sqm",
        areaSqm: 65,
        pricePerSqmPln: 15000, // 975k
        includeParking: true,
        parkingPricePln: 45000,
        includeStorage: true,
        storagePricePln: 15000,
        renovationBudgetPln: 200000,
        renovationContingencyPct: 0,
        renovationFundingMode: "mortgage",
      };

      const summary = calculatePropertyAcquisition(config, 20);

      // Property = 1,035,000; Renovation = 200,000 -> Project Total = 1,235,000
      expect(summary.projectTotalPln).toBe(1235000);
      expect(summary.downPaymentPln).toBe(247000); // 20% of 1,235,000 = 207k + 40k
      expect(summary.loanPrincipalPln).toBe(988000); // 828k + 160k
      expect(summary.upfrontCashMilestone2Pln).toBe(0); // Renovation covered by loan
      expect(summary.totalCashRequiredPln).toBe(summary.upfrontCashMilestone1Pln);
    });
  });

  describe("calculateAmortization", () => {
    it("computes equal annuity installments with interest decay", () => {
      const financing: MortgageFinancingConfig = {
        downPaymentPct: 20,
        loanTermYears: 25,
        referenceRatePct: 5.0,
        bankMarginPct: 1.85,
        rateStressDeltaPct: 0,
        installmentType: "equal",
      };

      const summary = calculateAmortization(800000, financing);

      expect(summary.effectiveRatePct).toBeCloseTo(6.85, 2);
      expect(summary.totalMonths).toBe(300);
      expect(summary.firstMonthInstallmentPln).toBeGreaterThan(5000);
      expect(summary.firstMonthInstallmentPln).toBe(summary.lastMonthInstallmentPln);
      expect(summary.schedule.length).toBe(300);
      expect(summary.totalInterestPln).toBeGreaterThan(500000);

      // Principal part increases, interest part decreases
      const firstMonth = summary.schedule[0];
      const lastMonth = summary.schedule[299];
      expect(lastMonth.principalPartPln).toBeGreaterThan(firstMonth.principalPartPln);
      expect(firstMonth.interestPartPln).toBeGreaterThan(lastMonth.interestPartPln);
      expect(lastMonth.remainingPrincipalPln).toBe(0);
    });

    it("computes decreasing installments with fixed principal amortization", () => {
      const financing: MortgageFinancingConfig = {
        downPaymentPct: 20,
        loanTermYears: 25,
        referenceRatePct: 5.0,
        bankMarginPct: 1.85,
        rateStressDeltaPct: 0,
        installmentType: "decreasing",
      };

      const summary = calculateAmortization(800000, financing);

      expect(summary.totalMonths).toBe(300);
      expect(summary.firstMonthInstallmentPln).toBeGreaterThan(summary.lastMonthInstallmentPln);
      expect(summary.schedule[0].principalPartPln).toBeCloseTo(800000 / 300, 0);

      // Total interest for decreasing installments is strictly lower than equal installments
      const equalSummary = calculateAmortization(800000, { ...financing, installmentType: "equal" });
      expect(summary.totalInterestPln).toBeLessThan(equalSummary.totalInterestPln);
    });

    it("handles zero loan principal safely", () => {
      const summary = calculateAmortization(0, DEFAULT_MORTGAGE_FINANCING_CONFIG);
      expect(summary.firstMonthInstallmentPln).toBe(0);
      expect(summary.schedule.length).toBe(0);
    });
  });

  describe("calculateOverlapTimeline", () => {
    it("models multi-phase timeline and identifies peak overlap housing cost in finishing window", () => {
      const propertySummary = calculatePropertyAcquisition(DEFAULT_PROPERTY_ACQUISITION_CONFIG, 20);
      const amortization = calculateAmortization(propertySummary.loanPrincipalPln, DEFAULT_MORTGAGE_FINANCING_CONFIG);
      const overlapConfig: OverlapTimelineConfig = {
        monthsToSigning: 6,
        constructionWaitMonths: 18,
        finishingOverlapMonths: 3,
        currentMonthlyRentPln: 3500,
        newCommunityAdminFeePln: 900,
        averageTrancheDrawnPctDuringConstruction: 50,
      };

      const timeline = calculateOverlapTimeline({
        propertySummary,
        amortization,
        overlapConfig,
      });

      expect(timeline.phases.length).toBe(4);
      expect(timeline.peakPhaseKey).toBe("finishing");
      // Peak = rent (3500) + full mortgage (~5500) + admin fee (900)
      expect(timeline.peakMonthlyHousingCostPln).toBe(3500 + amortization.firstMonthInstallmentPln + 900);

      // Construction wait has grace period interest + rent
      const constructionPhase = timeline.phases.find((p) => p.phaseKey === "construction");
      expect(constructionPhase?.monthlyMortgagePln).toBeGreaterThan(0);
      expect(constructionPhase?.monthlyRentPln).toBe(3500);

      // Steady state has 0 rent
      const steadyPhase = timeline.phases.find((p) => p.phaseKey === "steady_state");
      expect(steadyPhase?.monthlyRentPln).toBe(0);
      expect(steadyPhase?.monthlyTotalHousingCostPln).toBe(amortization.firstMonthInstallmentPln + 900);
    });
  });

  describe("auditSavingsPace", () => {
    const mockCategories = [
      {
        id: "goal-1",
        name: "Apartment Down Payment (PLN)",
        categoryType: CategoryType.Goal,
        currencyId: "PLN",
        amount: 100000,
      },
      {
        id: "goal-2",
        name: "Emergency Reserve (USD)",
        categoryType: CategoryType.Goal,
        currencyId: "USD",
        amount: 5000,
      },
    ];

    const mockCurrencies = [
      { id: "PLN", rate: 4.0 },
      { id: "USD", rate: 1.0 },
    ];

    it("evaluates on_track pace when historical net margin exceeds required monthly pace", () => {
      const audit = auditSavingsPace({
        upfrontCashMilestone1Pln: 220000,
        upfrontCashMilestone2Pln: 100000,
        monthsToSigning: 10,
        monthsToHandover: 24,
        linkedGoalCategoryIds: ["goal-1", "goal-2"], // 100k PLN + 5k USD * 4.0 = 120k PLN
        allCategories: mockCategories,
        currencies: mockCurrencies,
        historicalNetCashflowMarginPln: 12000, // Surplus above 10k/month
      });

      expect(audit.accumulatedSavingsPln).toBe(120000);
      expect(audit.milestone1TargetPln).toBe(220000);
      expect(audit.milestone1GapPln).toBe(100000);
      expect(audit.milestone1ProgressPct).toBeCloseTo(54.5, 1);
      expect(audit.milestone1RequiredMonthlyPacePln).toBe(10000); // 100k / 10m
      expect(audit.paceStatus).toBe("on_track");
      expect(audit.monthlyDeltaPln).toBe(2000); // 12,000 - 10,000
      expect(audit.projectedMilestone1DelayMonths).toBe(0);
    });

    it("evaluates shortfall warning and computes projected delay when net margin is deficient", () => {
      const audit = auditSavingsPace({
        upfrontCashMilestone1Pln: 220000,
        upfrontCashMilestone2Pln: 100000,
        monthsToSigning: 10,
        monthsToHandover: 24,
        linkedGoalCategoryIds: ["goal-1"], // 100k PLN accumulated
        allCategories: mockCategories,
        currencies: mockCurrencies,
        historicalNetCashflowMarginPln: 6000, // Deficit vs 12,000 pace
      });

      expect(audit.accumulatedSavingsPln).toBe(100000);
      expect(audit.milestone1GapPln).toBe(120000);
      expect(audit.milestone1RequiredMonthlyPacePln).toBe(12000);
      expect(audit.paceStatus).toBe("shortfall");
      expect(audit.monthlyDeltaPln).toBe(-6000);
      // 120k gap / 6k/month = 20 months needed. Target was 10 months -> 10 months delay
      expect(audit.projectedMilestone1DelayMonths).toBe(10);
    });
  });

  describe("calculateBudgetImpact", () => {
    it("computes pre vs post move-in cashflow delta and stress DTI", () => {
      const propertySummary = calculatePropertyAcquisition(DEFAULT_PROPERTY_ACQUISITION_CONFIG, 20);
      const amortization = calculateAmortization(propertySummary.loanPrincipalPln, DEFAULT_MORTGAGE_FINANCING_CONFIG);

      const impact = calculateBudgetImpact({
        amortization,
        overlapConfig: DEFAULT_OVERLAP_TIMELINE_CONFIG,
        financing: DEFAULT_MORTGAGE_FINANCING_CONFIG,
        propertySummary,
        householdNetIncomePln: 20000,
      });

      expect(impact.currentMonthlyRentPln).toBe(3500);
      expect(impact.newMonthlyHousingCostPln).toBe(amortization.firstMonthInstallmentPln + 900);
      expect(impact.monthlyCashflowDeltaPln).toBe(impact.newMonthlyHousingCostPln - 3500);
      expect(impact.currentHousingDtiPct).toBeCloseTo((3500 / 20000) * 100, 1);
      expect(impact.newHousingDtiPct).toBeCloseTo((impact.newMonthlyHousingCostPln / 20000) * 100, 1);
      expect(impact.stressedInstallmentPln).toBeGreaterThan(amortization.firstMonthInstallmentPln);
      expect(impact.stressedHousingDtiPct).toBeGreaterThan(impact.newHousingDtiPct);
    });
  });
});
