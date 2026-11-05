import { describe, expect, it } from "vitest";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import { STATUTORY_DEFAULTS } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/polish-tax-engine";

import {
  calculateCapitalPool,
  computeHistoricalCategoryBurn,
  DEFAULT_JDG_RUNWAY_CONFIG,
  projectRunwayScenario,
} from "../runway-engine";
import type { CapitalPoolItem, JdgRunwayConfig } from "../runway-types";

describe("runway-engine", () => {
  describe("calculateCapitalPool", () => {
    const sampleItems: CapitalPoolItem[] = [
      {
        id: "acc-pln",
        name: "Main PLN Checking",
        categoryType: CategoryType.BankAccount,
        nativeBalance: 100000,
        currencyCode: "PLN",
        convertedPln: 100000,
        included: true,
      },
      {
        id: "acc-usd",
        name: "USD Savings",
        categoryType: CategoryType.BankAccount,
        nativeBalance: 10000,
        currencyCode: "USD",
        convertedPln: 40000, // 4.00 PLN/USD
        included: true,
      },
      {
        id: "acc-off-balance",
        name: "Off-balance Emergency Fund",
        categoryType: CategoryType.BankAccount,
        nativeBalance: 20000,
        currencyCode: "PLN",
        convertedPln: 20000,
        included: true,
        isOffBalance: true,
      },
      {
        id: "goal-car",
        name: "Car Goal",
        categoryType: CategoryType.Goal,
        nativeBalance: 15000,
        currencyCode: "PLN",
        convertedPln: 15000,
        included: true,
        isGoal: true,
      },
    ];

    it("calculates total usable capital with safety floor and FX haircut", () => {
      // 100k PLN + 40k USD with -5% haircut (38k) = 138k PLN gross
      // Safety floor = 15,000 PLN => 123,000 PLN usable
      const result = calculateCapitalPool(sampleItems, {
        excludedItemIds: ["acc-off-balance"],
        includeOffBalanceAccounts: false,
        includeGoals: false,
        safetyFloorPln: 15000,
        fxHaircutPct: -5,
      });

      expect(result.totalGrossPln).toBe(140000);
      expect(result.fxAdjustmentPln).toBe(-2000); // -5% of 40k
      expect(result.safetyFloorPln).toBe(15000);
      expect(result.usableCapitalPln).toBe(123000);
    });

    it("includes off-balance accounts and goals when toggled on", () => {
      const result = calculateCapitalPool(sampleItems, {
        excludedItemIds: [],
        includeOffBalanceAccounts: true,
        includeGoals: true,
        safetyFloorPln: 10000,
        fxHaircutPct: 0,
      });

      // 100k + 40k + 20k + 15k = 175k gross - 10k safety floor = 165k usable
      expect(result.totalGrossPln).toBe(175000);
      expect(result.usableCapitalPln).toBe(165000);
    });
  });

  describe("computeHistoricalCategoryBurn", () => {
    const mockCategories: ExternalProviderCategory[] = [
      { id: "cat-groceries", name: "Groceries", categoryType: CategoryType.Expense },
      { id: "cat-rent", name: "Rent Apartment", categoryType: CategoryType.Expense },
      { id: "cat-tax-pln", name: "Tax PLN", categoryType: CategoryType.Expense },
      { id: "cat-income", name: "B2B Invoicing", categoryType: CategoryType.Income },
    ];

    const mockCurrencies: ExternalProviderCurrency[] = [];

    const mockStatPoints: StatPoint[] = [
      {
        id: "2024-05",
        categories: [
          { id: "cat-groceries", amount: 2000 },
          { id: "cat-rent", amount: 5000 },
          { id: "cat-tax-pln", amount: 8000 }, // Must be stripped!
          { id: "cat-income", amount: 25000 },
        ],
      },
      {
        id: "2024-06",
        categories: [
          { id: "cat-groceries", amount: 2400 },
          { id: "cat-rent", amount: 5000 },
          { id: "cat-tax-pln", amount: 9000 }, // Must be stripped!
        ],
      },
    ];

    it("excludes tax and income categories and tags fixed expenses", () => {
      const burnItems = computeHistoricalCategoryBurn({
        statPoints: mockStatPoints,
        categories: mockCategories,
        currencies: mockCurrencies,
        lookbackWindow: "3m",
        activePreset: {
          id: "default",
          name: "Default",
          incomeDeductions: ["cat-tax-pln"],
          expenseExclusions: ["cat-rent"],
        },
      });

      // Should only contain Groceries and Rent (Tax and Income stripped)
      const ids = burnItems.map((b) => b.id);
      expect(ids).toContain("cat-groceries");
      expect(ids).toContain("cat-rent");
      expect(ids).not.toContain("cat-tax-pln");
      expect(ids).not.toContain("cat-income");

      const rentItem = burnItems.find((b) => b.id === "cat-rent");
      expect(rentItem?.isFixed).toBe(true);

      const groceriesItem = burnItems.find((b) => b.id === "cat-groceries");
      expect(groceriesItem?.isFixed).toBe(false);
      // Average groceries over 2 available months: (2000 + 2400) / 2 = 2200
      expect(groceriesItem?.baselineMonthlyBurnPln).toBe(2200);
    });
  });

  describe("projectRunwayScenario", () => {
    it("handles Month-1 tax tail and calendar-year Ryczałt health step-down in January", () => {
      const config: JdgRunwayConfig = {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        posture: "active",
        regime: "b2b_ryczalt",
        zusStage: "duzy_zus",
        voluntarySickness: false,
        ryczaltYtdHealthTier: "tier3", // 1258.39 PLN
        includeMonth1TaxTail: true,
        month1Vat7Pln: 8000,
        month1PpePln: 4500,
        monthlyAccountingCostPln: 300,
        pfronRebate: {
          enabled: true,
          type: "percentage",
          percentage: 60,
          fixedAmountPln: 0,
        },
      };

      // Starting in October 2024:
      // M1 (Oct 2024): includes 12,500 PLN tax tail, Tier 3 health
      // M2 (Nov 2024): 0 tax tail, Tier 3 health
      // M3 (Dec 2024): 0 tax tail, Tier 3 health
      // M4 (Jan 2025): 0 tax tail, STEPS DOWN to Tier 1 health (419.46 PLN)!
      const result = projectRunwayScenario({
        startingCapitalPln: 200000,
        jdgConfig: config,
        monthlyLivingBurnPln: 10000,
        startYearMonth: "2024-10",
        maxMonths: 6,
      });

      expect(result.rows).toHaveLength(6);

      // Month 1
      const m1 = result.rows[0];
      expect(m1.yearMonth).toBe("2024-10");
      expect(m1.month1TaxTailPln).toBe(12500);
      expect(m1.healthPln).toBe(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY);
      expect(m1.isRyczaltTier1Reset).toBe(false);
      expect(m1.netZusPln).toBeLessThan(m1.grossZusPln); // 60% PFRON rebate credited

      // Month 2
      const m2 = result.rows[1];
      expect(m2.yearMonth).toBe("2024-11");
      expect(m2.month1TaxTailPln).toBe(0);
      expect(m2.healthPln).toBe(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER3_MONTHLY);

      // Month 4 (January 2025)
      const m4 = result.rows[3];
      expect(m4.yearMonth).toBe("2025-01");
      expect(m4.isRyczaltTier1Reset).toBe(true);
      expect(m4.healthPln).toBe(STATUTORY_DEFAULTS.RYCZALT_HEALTH_TIER1_MONTHLY);
    });

    it("applies Wakacje Składkowe in the designated month", () => {
      const config: JdgRunwayConfig = {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        posture: "wakacje_skladkowe",
        zusStage: "duzy_zus",
        wakacjeMonthIndex: 12, // December
      };

      const result = projectRunwayScenario({
        startingCapitalPln: 50000,
        jdgConfig: config,
        monthlyLivingBurnPln: 5000,
        startYearMonth: "2024-11", // M1=Nov, M2=Dec
        maxMonths: 3,
      });

      const novRow = result.rows[0];
      expect(novRow.isWakacjeSkladkoweMonth).toBe(false);
      expect(novRow.netZusPln).toBeGreaterThan(0);

      const decRow = result.rows[1];
      expect(decRow.isWakacjeSkladkoweMonth).toBe(true);
      expect(decRow.grossZusPln).toBe(0);
      expect(decRow.netZusPln).toBe(0);
      expect(decRow.healthPln).toBeGreaterThan(0); // Health insurance remains active!
    });

    it("suspends JDG with 0 ZUS and 0 mandatory health insurance", () => {
      const config: JdgRunwayConfig = {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        posture: "suspended",
        voluntaryNfzWhenSuspended: false,
        suspendedAccountingCostPln: 50,
      };

      const result = projectRunwayScenario({
        startingCapitalPln: 50000,
        jdgConfig: config,
        monthlyLivingBurnPln: 5000,
        startYearMonth: "2024-06",
        maxMonths: 3,
      });

      for (const row of result.rows) {
        expect(row.grossZusPln).toBe(0);
        expect(row.netZusPln).toBe(0);
        expect(row.healthPln).toBe(0);
        expect(row.accountingPln).toBe(50);
      }
    });

    it("calculates runway depletion date accurately", () => {
      const config: JdgRunwayConfig = {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        posture: "suspended",
        voluntaryNfzWhenSuspended: false,
        suspendedAccountingCostPln: 0,
        includeMonth1TaxTail: false,
      };

      // Starting capital 25,000 PLN, burn 10,000 PLN/mo
      // Depletes after 2.5 months in Month 3
      const result = projectRunwayScenario({
        startingCapitalPln: 25000,
        jdgConfig: config,
        monthlyLivingBurnPln: 10000,
        startYearMonth: "2024-01",
        maxMonths: 6,
      });

      expect(result.runwayMonths).toBe(2.5);
      expect(result.exhaustionYearMonth).toBe("2024-03");
      expect(result.exhaustionDate).toBe("March 2024");
    });
  });
});
