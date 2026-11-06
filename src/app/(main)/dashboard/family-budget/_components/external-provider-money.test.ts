import { describe, expect, it } from "vitest";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "./external-provider-data";
import {
  convertMoney,
  formatMoney,
  resolveCategoryCurrency,
  resolveTransactionMoney,
  toFxRateToTarget,
} from "./external-provider-money";

describe("external-provider-money", () => {
  describe("resolveCategoryCurrency", () => {
    it("prioritizes category.currencyId directly over category name suffix", () => {
      const cat1: ExternalProviderCategory = {
        id: "cat-1",
        name: "Hotels USD",
        currencyId: "EUR",
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat1)).toBe("EUR");

      const cat2: ExternalProviderCategory = {
        id: "cat-sub-uah",
        name: "Subscriptions UAH",
        currencyId: "PLN",
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat2, "PLN")).toBe("PLN");

      const cat3: ExternalProviderCategory = {
        id: "acc-kantor-usd",
        name: "Kantor USD",
        currencyId: "PLN",
        categoryType: CategoryType.Account,
      };
      expect(resolveCategoryCurrency(cat3, "PLN")).toBe("PLN");
    });

    it("resolves from name suffix when currencyId is missing or empty or on string category", () => {
      const cat1: ExternalProviderCategory = {
        id: "cat-sub-uah",
        name: "Subscriptions UAH",
        currencyId: undefined,
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat1, "PLN")).toBe("UAH");

      const cat2: ExternalProviderCategory = {
        id: "acc-kantor-usd",
        name: "Kantor USD",
        currencyId: "",
        categoryType: CategoryType.Account,
      };
      expect(resolveCategoryCurrency(cat2, "PLN")).toBe("USD");

      expect(resolveCategoryCurrency("Subscriptions UAH", "PLN")).toBe("UAH");
    });

    it("extracts 3-letter uppercase currency suffix from category name", () => {
      const cat1: ExternalProviderCategory = {
        id: "cat-1",
        name: "Hotels EUR",
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat1)).toBe("EUR");

      const cat2: ExternalProviderCategory = {
        id: "cat-2",
        name: "Salary USD",
        categoryType: CategoryType.Income,
      };
      expect(resolveCategoryCurrency(cat2)).toBe("USD");

      const cat3: ExternalProviderCategory = {
        id: "cat-3",
        name: "Freelance (USD)",
        categoryType: CategoryType.Income,
      };
      expect(resolveCategoryCurrency(cat3)).toBe("USD");

      const cat4: ExternalProviderCategory = {
        id: "cat-4",
        name: "Alex (USD)",
        categoryType: CategoryType.DebtAccount,
      };
      expect(resolveCategoryCurrency(cat4)).toBe("USD");
    });

    it("does not falsely treat words containing currency code as currency suffix", () => {
      const cat: ExternalProviderCategory = {
        id: "cat-autocad",
        name: "AutoCAD License",
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat, "PLN")).toBe("PLN");
    });

    it("handles Cyrillic legacy names resolving to UAH", () => {
      const cat1: ExternalProviderCategory = {
        id: "cat-uah-1",
        name: "Аптека Грн",
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat1)).toBe("UAH");

      const cat2: ExternalProviderCategory = {
        id: "cat-uah-2",
        name: "Приват 24 Карточка",
        categoryType: CategoryType.Account,
      };
      expect(resolveCategoryCurrency(cat2)).toBe("UAH");

      const cat3: ExternalProviderCategory = {
        id: "cat-uah-3",
        name: "Монобанк Black",
        categoryType: CategoryType.Account,
      };
      expect(resolveCategoryCurrency(cat3)).toBe("UAH");

      const cat4: ExternalProviderCategory = {
        id: "cat-uah-4",
        name: "Зарплата Гривна",
        categoryType: CategoryType.Income,
      };
      expect(resolveCategoryCurrency(cat4)).toBe("UAH");
    });

    it("falls back to defaultCurrency if no currency indicator is found", () => {
      const cat: ExternalProviderCategory = {
        id: "cat-plain",
        name: "Groceries",
        categoryType: CategoryType.Expense,
      };
      expect(resolveCategoryCurrency(cat, "PLN")).toBe("PLN");
      expect(resolveCategoryCurrency(null, "EUR")).toBe("EUR");
      expect(resolveCategoryCurrency(undefined, "USD")).toBe("USD");
    });
  });

  describe("toFxRateToTarget and convertMoney", () => {
    const currencies: ExternalProviderCurrency[] = [
      { id: "USD", rate: 1.0 },
      { id: "EUR", rate: 0.92 },
      { id: "PLN", rate: 4.0 },
      { id: "UAH", rate: 41.2 },
    ];

    it("calculates cross-currency exchange rates relative to USD base rates", () => {
      // 1 EUR = (4.00 / 0.92) PLN ≈ 4.3478
      const eurToPln = toFxRateToTarget("EUR", "PLN", currencies);
      expect(eurToPln).toBeCloseTo(4.0 / 0.92, 4);

      // 1 PLN = (0.92 / 4.00) EUR = 0.23
      const plnToEur = toFxRateToTarget("PLN", "EUR", currencies);
      expect(plnToEur).toBeCloseTo(0.23, 4);

      // Same currency returns 1
      expect(toFxRateToTarget("EUR", "EUR", currencies)).toBe(1);
    });

    it("converts MoneyAmount accurately across currencies", () => {
      const converted = convertMoney({ amount: 100, currency: "EUR" }, "PLN", currencies);
      expect(converted.currency).toBe("PLN");
      expect(converted.amount).toBeCloseTo(434.78, 2);
    });

    it("falls back to 1.0 when currency rate is missing", () => {
      const rate = toFxRateToTarget("GBP", "PLN", currencies);
      expect(rate).toBe(1.0);
    });
  });

  describe("resolveTransactionMoney", () => {
    const categoryMap = new Map<string, ExternalProviderCategory>([
      [
        "acc-usd",
        {
          id: "acc-usd",
          name: "Debit Card USD",
          currencyId: "USD",
          categoryType: CategoryType.Account,
        },
      ],
      [
        "acc-eur",
        {
          id: "acc-eur",
          name: "EUR Card (EUR)",
          categoryType: CategoryType.Account,
        },
      ],
      [
        "cat-hotel",
        {
          id: "cat-hotel",
          name: "Hotels EUR",
          categoryType: CategoryType.Expense,
        },
      ],
      [
        "cat-taxi",
        {
          id: "cat-taxi",
          name: "Taxi",
          categoryType: CategoryType.Expense,
        },
      ],
      [
        "cat-client",
        {
          id: "cat-client",
          name: "Client ACME USD",
          currencyId: "USD",
          categoryType: CategoryType.Income,
        },
      ],
      [
        "acc-pln",
        {
          id: "acc-pln",
          name: "PLN Account",
          currencyId: "PLN",
          categoryType: CategoryType.Account,
        },
      ],
    ]);

    it("resolves cross-currency card payment into foreign expense category", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-1",
        sourceId: "acc-usd",
        destinationId: "cat-hotel",
        sourceAmount: 130,
        destinationAmount: 120,
      };

      const result = resolveTransactionMoney(tx, categoryMap, undefined, "PLN");

      expect(result.source).toEqual({ amount: 130, currency: "USD" });
      expect(result.destination).toEqual({ amount: 120, currency: "EUR" });
      expect(result.primary).toEqual({ amount: 120, currency: "EUR" });
    });

    it("awards foreign source precedence when foreign card pays domestic expense", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-2",
        sourceId: "acc-eur",
        destinationId: "cat-taxi",
        sourceAmount: 25,
        destinationAmount: 100,
      };

      const result = resolveTransactionMoney(tx, categoryMap, undefined, "PLN");

      expect(result.source).toEqual({ amount: 25, currency: "EUR" });
      expect(result.destination).toEqual({ amount: 100, currency: "PLN" });
      expect(result.primary).toEqual({ amount: 25, currency: "EUR" });
    });

    it("resolves income transactions with income category as primary", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-3",
        sourceId: "cat-client",
        destinationId: "acc-pln",
        sourceAmount: 5000,
        destinationAmount: 20250,
      };

      const result = resolveTransactionMoney(tx, categoryMap, undefined, "PLN");

      expect(result.source).toEqual({ amount: 5000, currency: "USD" });
      expect(result.destination).toEqual({ amount: 20250, currency: "PLN" });
      expect(result.primary).toEqual({ amount: 5000, currency: "USD" });
    });

    it("preserves foreign currency side as primary in cross-currency transfers", () => {
      const txToUsd: ExternalProviderTransaction = {
        id: "tx-transfer-to-usd",
        sourceId: "acc-pln",
        destinationId: "acc-usd",
        sourceAmount: 8000,
        destinationAmount: 2000,
      };

      const resultToUsd = resolveTransactionMoney(txToUsd, categoryMap, undefined, "PLN");
      expect(resultToUsd.source).toEqual({ amount: 8000, currency: "PLN" });
      expect(resultToUsd.destination).toEqual({ amount: 2000, currency: "USD" });
      expect(resultToUsd.primary).toEqual({ amount: 2000, currency: "USD" });

      const txFromUsd: ExternalProviderTransaction = {
        id: "tx-transfer-from-usd",
        sourceId: "acc-usd",
        destinationId: "acc-pln",
        sourceAmount: 2000,
        destinationAmount: 8000,
      };

      const resultFromUsd = resolveTransactionMoney(txFromUsd, categoryMap, undefined, "PLN");
      expect(resultFromUsd.source).toEqual({ amount: 2000, currency: "USD" });
      expect(resultFromUsd.destination).toEqual({ amount: 8000, currency: "PLN" });
      expect(resultFromUsd.primary).toEqual({ amount: 2000, currency: "USD" });
    });

    it("falls back across destination/source amounts when one side is missing", () => {
      const txMissingSource: ExternalProviderTransaction = {
        id: "tx-missing-source",
        sourceId: "acc-eur",
        destinationId: "cat-hotel",
        sourceAmount: undefined,
        destinationAmount: 120,
      };

      const result = resolveTransactionMoney(txMissingSource, categoryMap, undefined, "PLN");
      expect(result.source).toEqual({ amount: 120, currency: "EUR" });
      expect(result.destination).toEqual({ amount: 120, currency: "EUR" });
      expect(result.primary).toEqual({ amount: 120, currency: "EUR" });
    });
  });

  describe("formatMoney", () => {
    it("formats amounts with authentic currency symbols", () => {
      expect(formatMoney(120, "EUR")).toMatch(/€\s?120\.00|120\.00\s?€/);
      expect(formatMoney({ amount: 5000, currency: "USD" })).toBe("$5,000.00");
    });
  });
});
