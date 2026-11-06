import { describe, expect, it } from "vitest";

import {
  computeMortgageAcceleration,
  computePlayerReallocation,
  computePlayerScreenTime,
  computePrimaryCashflow,
  computeSpouseCashflow,
  evaluatePersonalGoals,
} from "../time-value-engine";
import type {
  DriftReallocationSplit,
  FamilyPetProject,
  PersonalGoal,
  PrimaryMonetizationSettings,
  ScreenTimeReflection,
  SpouseOpportunitySettings,
} from "../time-value-types";

describe("time-value-engine", () => {
  describe("computePlayerScreenTime", () => {
    it("handles 100% joyful recharge week with zero drift and celebration badge", () => {
      const input: ScreenTimeReflection = {
        gamingTotalHours: 8,
        gamingJoyHours: 8,
        socialTotalHours: 4,
        socialJoyHours: 4,
      };

      const result = computePlayerScreenTime(input);
      expect(result.totalHours).toBe(12);
      expect(result.joyfulHours).toBe(12);
      expect(result.driftHours).toBe(0);
      expect(result.joyRatioPct).toBe(100);
      expect(result.driftRatioPct).toBe(0);
      expect(result.isAllJoyCelebration).toBe(true);
    });

    it("partitions mixed Joy vs. Drift screen time accurately", () => {
      const input: ScreenTimeReflection = {
        gamingTotalHours: 10,
        gamingJoyHours: 4, // 6h drift
        socialTotalHours: 6,
        socialJoyHours: 3, // 3h drift
      };

      const result = computePlayerScreenTime(input);
      expect(result.totalHours).toBe(16);
      expect(result.joyfulHours).toBe(7);
      expect(result.driftHours).toBe(9);
      expect(result.joyRatioPct).toBe(44);
      expect(result.driftRatioPct).toBe(56);
      expect(result.isAllJoyCelebration).toBe(false);
    });
  });

  describe("computePlayerReallocation", () => {
    it("calculates effective side-hustle hours with focus efficiency percentage", () => {
      const split: DriftReallocationSplit = {
        sideHustleHours: 6,
        learningHours: 2,
        properRelaxHours: 1,
        focusEfficiencyPct: 75,
      };

      const result = computePlayerReallocation(9, split);
      expect(result.sideHustleEffectiveHours).toBe(4.5); // 6 * 0.75
      expect(result.learningHours).toBe(2);
      expect(result.properRelaxHours).toBe(1);
    });
  });

  describe("computePrimaryCashflow & Day-Off Monetization", () => {
    it("computes monthly cashflow and monetized days off accurately", () => {
      const monetization: PrimaryMonetizationSettings = {
        rateSource: "manual",
        manualRatePln: 150,
        annualDaysOffPool: 39,
        sacredUnplugDays: 32,
        monetizedDaysOff: 7,
        hoursPerDayOff: 8,
      };

      const reallocation = {
        reclaimedDriftHours: 9,
        sideHustleEffectiveHours: 4.5,
        learningHours: 2,
        properRelaxHours: 1,
      };

      const result = computePrimaryCashflow(reallocation, monetization, 150);
      // 4.5 hrs/week * 52/12 = 19.5 hrs/mo * 150 = 2925 PLN/mo
      expect(result.monthlySideHustleCashflowPln).toBe(2925);
      // 7 days * 8h = 56h * 150 = 8400 PLN/year -> 700 PLN/mo
      expect(result.dayOffMonetizationAnnualPln).toBe(8400);
      expect(result.dayOffMonetizationMonthlyPln).toBe(700);
      expect(result.totalMonthlyValuePln).toBe(3625);
    });
  });

  describe("computeSpouseCashflow with Freelancing & Pet Projects", () => {
    it("aggregates freelancing and pet-project compound savings, hours saved, and future income", () => {
      const opportunity: SpouseOpportunitySettings = {
        freelance: {
          enabled: true,
          hourlyRatePln: 80,
          activeServicesDescription: "Creative & Admin Ops",
        },
        petProjectsEnabled: true,
      };

      const petProjects: FamilyPetProject[] = [
        {
          id: "p1",
          title: "Meal Prep & Smart Pantry Automation",
          description: "Reduces food waste and take-out",
          status: "active",
          allocatedHoursPerWeek: 4,
          monthlyExpenseSavedPln: 300,
          weeklyHouseholdHoursSaved: 2,
          hoursSavedValuedAtPln: 50, // 2h * 52/12 * 50 = ~433 PLN/mo
          projectedLaunchMonthlyIncomePln: 0,
          milestoneBountyPln: 1000,
          milestoneCompleted: true,
          createdAt: "2026-01-01",
        },
        {
          id: "p2",
          title: "Digital Printable Store",
          description: "Etsy templates",
          status: "active",
          allocatedHoursPerWeek: 3,
          monthlyExpenseSavedPln: 0,
          weeklyHouseholdHoursSaved: 0,
          hoursSavedValuedAtPln: 50,
          projectedLaunchMonthlyIncomePln: 500,
          milestoneBountyPln: 1500,
          milestoneCompleted: false,
          createdAt: "2026-02-01",
        },
      ];

      const reallocation = {
        reclaimedDriftHours: 5,
        sideHustleEffectiveHours: 3.5,
        learningHours: 1,
        properRelaxHours: 0.5,
      };

      const result = computeSpouseCashflow(reallocation, opportunity, petProjects);
      // Freelance: 3.5 * 52/12 = ~15.166h * 80 = 1213 PLN
      expect(result.monthlySideHustleCashflowPln).toBe(1213);
      expect(result.spouseMonthlySavingsPln).toBe(300);
      expect(result.spouseHoursSavedPerWeek).toBe(2);
      expect(result.spouseProjectedMonthlyRevenuePln).toBe(500);
      expect(result.spouseEarnedBountiesPln).toBe(1000);
      expect(result.totalMonthlyValuePln).toBe(2446); // 1213 + 300 + 433 + 500
    });
  });

  describe("computeMortgageAcceleration", () => {
    it("shaves months off Milestone 1 and calculates unlocked apartment sqm per year", () => {
      const result = computeMortgageAcceleration({
        baselineMonthlySavingsPln: 6000,
        monthlyExtraCashflowPln: 3000,
        milestone1GapPln: 90000,
        totalGapPln: 180000,
        pricePerSqmPln: 14000,
      });

      // Baseline M1: 90000 / 6000 = 15.0 mos
      expect(result.baselineMonthsMilestone1).toBe(15);
      // Accelerated M1: 90000 / 9000 = 10.0 mos
      expect(result.acceleratedMonthsMilestone1).toBe(10);
      expect(result.monthsSavedMilestone1).toBe(5);

      // Annual extra income: 3000 * 12 = 36,000 PLN
      // Sqm unlocked: 36000 / 14000 = ~2.6 sqm/yr
      expect(result.unlockedSqmPerYear).toBe(2.6);
    });
  });

  describe("evaluatePersonalGoals", () => {
    it("calculates months to fund personal goals based on partner pace", () => {
      const goals: PersonalGoal[] = [
        {
          id: "g1",
          title: "Rome Weekend & Spa",
          category: "travel",
          targetAmountPln: 4500,
          currentSavedPln: 0,
          owner: "wife",
          createdAt: "2026-01-01",
        },
      ];

      const evaluated = evaluatePersonalGoals(goals, 1125, 3000);
      expect(evaluated[0].gapPln).toBe(4500);
      expect(evaluated[0].monthsToFund).toBe(4);
      expect(evaluated[0].isFunded).toBe(false);
    });
  });
});
