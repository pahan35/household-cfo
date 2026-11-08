import { describe, expect, it } from "vitest";

import {
  createTransactionsSchema,
  normalizeCategoriesInput,
  normalizeTransactionsInput,
  snapshotQuerySchema,
  triggerSyncSchema,
  updateTransactionSchema,
  upsertCategoriesSchema,
} from "../external-provider";
import { deletePresetSchema, upsertPresetSchema } from "../presets";
import { createMortgageScenarioSchema, scenarioKindSchema, updateRunwayScenarioSchema } from "../scenarios";
import { screenLogBatchSchema, screenLogSchema } from "../screen-log";

describe("shared DTO schemas", () => {
  it("validates ExternalProvider transaction and category schemas and normalization", () => {
    // Single transaction normalization
    const singleTx = { sourceAmount: 100, destinationAmount: 100 };
    expect(createTransactionsSchema.safeParse(singleTx).success).toBe(true);
    expect(normalizeTransactionsInput(singleTx)).toEqual([{ ...singleTx, tags: [] }]);

    // Array of transactions normalization
    const multiTx = [
      { id: "tx-1", sourceAmount: 50 },
      { id: "tx-2", destinationAmount: 50 },
    ];
    expect(createTransactionsSchema.safeParse(multiTx).success).toBe(true);
    expect(normalizeTransactionsInput(multiTx)).toHaveLength(2);

    // Object wrapping array normalization
    expect(normalizeTransactionsInput({ transactions: multiTx })).toHaveLength(2);

    // Update requires non-empty id
    expect(updateTransactionSchema.safeParse({ id: "tx-1", sourceAmount: 20 }).success).toBe(true);
    expect(updateTransactionSchema.safeParse({ sourceAmount: 20 }).success).toBe(false);
    expect(updateTransactionSchema.safeParse({ id: "" }).success).toBe(false);

    // Categories normalization
    const cat = { id: "cat-1", name: "Food", categoryType: 3 };
    expect(upsertCategoriesSchema.safeParse(cat).success).toBe(true);
    expect(normalizeCategoriesInput(cat)).toEqual([cat]);
    expect(normalizeCategoriesInput([cat])).toEqual([cat]);
    expect(normalizeCategoriesInput({ categories: [cat] })).toEqual([cat]);

    // Sync options
    expect(triggerSyncSchema.safeParse({ tier: "cold", force: true }).success).toBe(true);
    expect(triggerSyncSchema.safeParse({ tier: "invalid" }).success).toBe(false);

    // Snapshot query coercion
    expect(snapshotQuerySchema.parse({ sinceVersion: "5" })).toEqual({ sinceVersion: 5 });
    expect(snapshotQuerySchema.safeParse({ sinceVersion: -1 }).success).toBe(false);
  });
  it("accepts a valid screen log and rejects malformed dates and negative hours", () => {
    expect(
      screenLogSchema.safeParse({ weekStartDate: "2026-11-02", player: "me", gamingTotalHours: 4.5 }).success,
    ).toBe(true);
    expect(screenLogSchema.safeParse({ weekStartDate: "02-11-2026", player: "me" }).success).toBe(false);
    expect(screenLogSchema.safeParse({ weekStartDate: "2026-11-02", player: "me", socialTotalHours: -1 }).success).toBe(
      false,
    );
    expect(screenLogSchema.safeParse({ weekStartDate: "2026-11-02", player: "kid" }).success).toBe(false);
  });

  it("requires at least one log in a batch", () => {
    expect(screenLogBatchSchema.safeParse({ logs: [] }).success).toBe(false);
  });

  it("validates scenario payloads", () => {
    expect(createMortgageScenarioSchema.safeParse({ name: "Plan", config: { property: {} } }).success).toBe(true);
    expect(createMortgageScenarioSchema.safeParse({ config: "nope" }).success).toBe(false);
    expect(updateRunwayScenarioSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(scenarioKindSchema.safeParse("offers").success).toBe(false);
  });

  it("validates preset payloads and applies array defaults", () => {
    const parsed = upsertPresetSchema.parse({ preset: { id: "p1", name: "Preset" } });
    expect(parsed.preset.incomeDeductions).toEqual([]);
    expect(parsed.preset.expenseExclusions).toEqual([]);
    expect(deletePresetSchema.safeParse({ presetId: "" }).success).toBe(false);
  });
});
