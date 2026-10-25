import { describe, expect, it } from "vitest";

import type { ExternalProviderCategory, ExternalProviderTransaction } from "../../../_components/external-provider-data";
import { applyBookendTags, filterTransactionsByDateRange, scoreBoundaryCandidate } from "../travel-bookend-assistant";

describe("TravelBookendAssistant helpers", () => {
  const categoryMap = new Map<string, ExternalProviderCategory>([
    [
      "cat-flight",
      { id: "cat-flight", name: "Flights & Airlines", currencyId: "PLN", categoryType: 0 } as ExternalProviderCategory,
    ],
    [
      "cat-hotel",
      { id: "cat-hotel", name: "Hotels & Lodging", currencyId: "PLN", categoryType: 0 } as ExternalProviderCategory,
    ],
    [
      "cat-transit",
      { id: "cat-transit", name: "Uber & Taxi", currencyId: "PLN", categoryType: 0 } as ExternalProviderCategory,
    ],
    [
      "cat-groceries",
      { id: "cat-groceries", name: "Groceries", currencyId: "PLN", categoryType: 0 } as ExternalProviderCategory,
    ],
  ]);

  describe("scoreBoundaryCandidate", () => {
    it("scores foreign currency transactions with +40", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-1",
        destinationId: "cat-groceries",
        destinationCurrencyId: "EUR",
      };
      const result = scoreBoundaryCandidate(tx, "PLN", categoryMap);
      expect(result.score).toBe(40);
      expect(result.reasons).toContain("Foreign Currency (EUR)");
    });

    it("scores flights and airlines with +50", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-2",
        destinationId: "cat-flight",
        destinationCurrencyId: "PLN",
      };
      const result = scoreBoundaryCandidate(tx, "PLN", categoryMap);
      expect(result.score).toBe(50);
      expect(result.reasons).toContain("Flights / Airline");
    });

    it("scores lodging and hotels with +45", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-3",
        destinationId: "cat-hotel",
        destinationCurrencyId: "PLN",
      };
      const result = scoreBoundaryCandidate(tx, "PLN", categoryMap);
      expect(result.score).toBe(45);
      expect(result.reasons).toContain("Lodging / Hotel");
    });

    it("scores transit and transport with +35", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-4",
        destinationId: "cat-transit",
        destinationCurrencyId: "PLN",
      };
      const result = scoreBoundaryCandidate(tx, "PLN", categoryMap);
      expect(result.score).toBe(35);
      expect(result.reasons).toContain("Transit / Transport");
    });

    it("accumulates score for multiple factors (e.g. foreign hotel + travel tag)", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-5",
        destinationId: "cat-hotel",
        destinationCurrencyId: "EUR",
        tags: ["#trip"],
      };
      const result = scoreBoundaryCandidate(tx, "PLN", categoryMap);
      // Foreign currency (40) + Lodging (45) + Travel Tag (30) = 115
      expect(result.score).toBe(115);
      expect(result.reasons).toEqual(["Foreign Currency (EUR)", "Lodging / Hotel", "Existing Travel Tag"]);
    });

    it("returns 0 score and empty reasons for plain domestic groceries", () => {
      const tx: ExternalProviderTransaction = {
        id: "tx-6",
        destinationId: "cat-groceries",
        destinationCurrencyId: "PLN",
      };
      const result = scoreBoundaryCandidate(tx, "PLN", categoryMap);
      expect(result.score).toBe(0);
      expect(result.reasons).toEqual([]);
    });
  });

  describe("applyBookendTags", () => {
    it("adds #travel and destination tag for trip start", () => {
      const tags = applyBookendTags([], "start", "austria");
      expect(tags).toContain("#travel");
      expect(tags).toContain("#austria");
    });

    it("adds #end-travel and destination tag for trip end", () => {
      const tags = applyBookendTags([], "end", "#austria");
      expect(tags).toContain("#end-travel");
      expect(tags).toContain("#austria");
    });

    it("replaces existing conflicting bookend", () => {
      const initial = ["#travel", "#vienna", "#dinner"];
      const updated = applyBookendTags(initial, "end", "vienna");
      expect(updated).not.toContain("#travel");
      expect(updated).toContain("#end-travel");
      expect(updated).toContain("#vienna");
      expect(updated).toContain("#dinner");
    });

    it("preserves other tags and avoids duplicates", () => {
      const initial = ["#travel", "#austria", "#flight"];
      const updated = applyBookendTags(initial, "start", "austria");
      expect(updated).toEqual(["#travel", "#austria", "#flight"]);
    });
  });

  describe("filterTransactionsByDateRange", () => {
    const tx1: ExternalProviderTransaction = { id: "1", dateTimestampISO: "2024-07-05T10:00:00Z" };
    const tx2: ExternalProviderTransaction = { id: "2", dateTimestampISO: "2024-07-20T10:00:00Z" };
    const tx3: ExternalProviderTransaction = { id: "3", dateTimestampISO: "2024-08-01T10:00:00Z" };
    const txDeleted: ExternalProviderTransaction = {
      id: "4",
      dateTimestampISO: "2024-07-15T10:00:00Z",
      deleted: true,
    };

    it("filters transactions within date range and excludes deleted ones", () => {
      const from = new Date("2024-07-01T00:00:00Z");
      const to = new Date("2024-07-31T23:59:59Z");
      const result = filterTransactionsByDateRange([tx1, tx2, tx3, txDeleted], from, to);

      expect(result.map((t) => t.id)).toEqual(["1", "2"]);
    });
  });
});
