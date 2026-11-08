import { describe, expect, it } from "vitest";

import { deletePresetSchema, upsertPresetSchema } from "../presets";
import { createMortgageScenarioSchema, scenarioKindSchema, updateRunwayScenarioSchema } from "../scenarios";
import { screenLogBatchSchema, screenLogSchema } from "../screen-log";

describe("shared DTO schemas", () => {
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
