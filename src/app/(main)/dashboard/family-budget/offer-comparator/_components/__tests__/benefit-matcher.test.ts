import { describe, expect, it } from "vitest";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "../../../_components/external-provider-data";
import {
  computeBenefitSpendCeilings,
  generateStarterBenefitsFromCeilings,
  suggestBudgetOffset,
} from "../benefit-matcher";

describe("Benefit Matcher & ExternalProvider Spend Ceilings Engine", () => {
  const mockCurrencies: ExternalProviderCurrency[] = [
    { id: "PLN", rate: 4.0 },
    { id: "USD", rate: 1.0 },
    { id: "EUR", rate: 0.92 },
  ];

  const mockCategories: ExternalProviderCategory[] = [
    { id: "cat-med-pln", name: "Medicine PLN", categoryType: CategoryType.Expense },
    { id: "cat-sport-pln", name: "Sport PLN", categoryType: CategoryType.Expense },
    { id: "cat-mh-pln", name: "Mental Health PLN", categoryType: CategoryType.Expense },
    { id: "cat-massage-pln", name: "Massage PLN", categoryType: CategoryType.Expense },
    { id: "cat-learn-pln", name: "Learning PLN", categoryType: CategoryType.Expense },
  ];

  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;

  it("splits medical spend into covered primary, covered spouse (#wife), and out-of-pocket (#dentist/#pharmacy)", () => {
    const transactions: ExternalProviderTransaction[] = [
      // Primary consultation (covered)
      {
        id: "tx-med-1",
        destinationId: "cat-med-pln",
        destinationAmount: 300,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["consult"],
        dateTimestamp: now - 30 * dayMs,
      },
      // Spouse blood tests (covered for family)
      {
        id: "tx-med-2",
        destinationId: "cat-med-pln",
        destinationAmount: 200,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["exams", "wife"],
        dateTimestamp: now - 45 * dayMs,
      },
      // Dentist (out-of-pocket)
      {
        id: "tx-med-3",
        destinationId: "cat-med-pln",
        destinationAmount: 500,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["dentist"],
        dateTimestamp: now - 60 * dayMs,
      },
    ];

    const ceilings = computeBenefitSpendCeilings({
      transactions,
      categories: mockCategories,
      currencies: mockCurrencies,
      defaultCurrency: "PLN",
      monthsWindow: 3,
    });

    const health = ceilings.breakdowns.health;
    expect(health).toBeDefined();
    expect(health.totalSpendPln).toBe(1000);
    expect(health.coveredPrimaryMonthlyPln).toBeGreaterThan(0);
    expect(health.coveredSpouseMonthlyPln).toBeGreaterThan(0);
    expect(health.outOfPocketMonthlyPln).toBeGreaterThan(0);
  });

  it("splits sport spend into covered gym and out-of-pocket pilates", () => {
    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-sport-gym",
        destinationId: "cat-sport-pln",
        destinationAmount: 180,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["gym"],
        dateTimestamp: now - 20 * dayMs,
      },
      {
        id: "tx-sport-pilates",
        destinationId: "cat-sport-pln",
        destinationAmount: 600,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["pilates", "10x"],
        dateTimestamp: now - 40 * dayMs,
      },
    ];

    const ceilings = computeBenefitSpendCeilings({
      transactions,
      categories: mockCategories,
      currencies: mockCurrencies,
      defaultCurrency: "PLN",
      monthsWindow: 3,
    });

    const sport = ceilings.breakdowns.sport;
    expect(sport.coveredPrimaryMonthlyPln).toBeGreaterThan(0);
    expect(sport.outOfPocketMonthlyPln).toBeGreaterThan(0);
  });

  it("suggests budget offset for Family vs. Individual tiers and highlights spouse downgrade loss", () => {
    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-med-p",
        destinationId: "cat-med-pln",
        destinationAmount: 600,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["consult"],
        dateTimestamp: now - 30 * dayMs,
      },
      {
        id: "tx-med-w",
        destinationId: "cat-med-pln",
        destinationAmount: 300,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["exams", "wife"],
        dateTimestamp: now - 35 * dayMs,
      },
    ];

    const ceilings = computeBenefitSpendCeilings({
      transactions,
      categories: mockCategories,
      currencies: mockCurrencies,
      defaultCurrency: "PLN",
      monthsWindow: 3,
    });

    const familySuggestion = suggestBudgetOffset("health", "family", ceilings);
    const indivSuggestion = suggestBudgetOffset("health", "individual", ceilings);

    expect(familySuggestion.suggestedOffsetPln).toBeGreaterThan(indivSuggestion.suggestedOffsetPln);
    expect(indivSuggestion.spouseDowngradeDeltaPln).toBeGreaterThan(0);
  });

  it("generates populated starter benefits from ceilings", () => {
    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-med",
        destinationId: "cat-med-pln",
        destinationAmount: 300,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["consult", "wife"],
        dateTimestamp: now - 30 * dayMs,
      },
      {
        id: "tx-sport",
        destinationId: "cat-sport-pln",
        destinationAmount: 200,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["multisport"],
        dateTimestamp: now - 20 * dayMs,
      },
    ];

    const ceilings = computeBenefitSpendCeilings({
      transactions,
      categories: mockCategories,
      currencies: mockCurrencies,
      defaultCurrency: "PLN",
      monthsWindow: 3,
    });

    const benefits = generateStarterBenefitsFromCeilings(ceilings);
    expect(benefits.length).toBeGreaterThanOrEqual(2);
    expect(benefits.some((b) => b.category === "health")).toBe(true);
    expect(benefits.some((b) => b.category === "sport")).toBe(true);
  });

  it("converts foreign currency transactions (USD/EUR) into PLN using ExternalProvider cross-rates", () => {
    const foreignCategories: ExternalProviderCategory[] = [
      ...mockCategories,
      { id: "cat-learn-usd", name: "Learning [USD]", categoryType: CategoryType.Expense, currencyId: "USD" },
    ];

    // USD rate: 1.0, PLN rate: 4.0 -> 100 USD = 400 PLN
    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-learn-usd",
        destinationId: "cat-learn-usd",
        destinationAmount: 100,
        destinationCurrencyId: "USD",
        destinationType: CategoryType.Expense,
        tags: ["course"],
        dateTimestamp: now - 15 * dayMs,
      },
    ];

    const ceilings = computeBenefitSpendCeilings({
      transactions,
      categories: foreignCategories,
      currencies: mockCurrencies,
      defaultCurrency: "PLN",
      monthsWindow: 3,
    });

    const learning = ceilings.breakdowns.learning;
    expect(learning).toBeDefined();
    expect(learning.totalSpendPln).toBeCloseTo(400, 1);
  });
});
