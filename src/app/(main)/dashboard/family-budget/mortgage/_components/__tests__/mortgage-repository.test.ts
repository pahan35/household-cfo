import { describe, expect, it } from "vitest";

import { DEFAULT_MORTGAGE_SIMULATOR_CONFIG, DEFAULT_PROPERTY_ACQUISITION_CONFIG } from "../mortgage-engine";
import { MortgageRepository, type StorageLike } from "../mortgage-repository";
import type { MortgageSimulatorConfig } from "../mortgage-types";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe("MortgageRepository", () => {
  it("returns default config when storage is empty", () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);
    const config = repo.loadConfig();

    expect(config.property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
    expect(config.financing.downPaymentPct).toBe(20);
    expect(config.goalTracking.linkedGoalCategoryIds).toEqual([]);
  });

  it("saves and reloads modified config cleanly", () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);

    const customConfig: MortgageSimulatorConfig = {
      ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      property: {
        ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
        areaSqm: 82,
        pricePerSqmPln: 17500,
      },
      goalTracking: {
        ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG.goalTracking,
        linkedGoalCategoryIds: ["goal-123"],
      },
    };

    repo.saveConfig(customConfig);
    const loaded = repo.loadConfig();

    expect(loaded.property.areaSqm).toBe(82);
    expect(loaded.property.pricePerSqmPln).toBe(17500);
    expect(loaded.goalTracking.linkedGoalCategoryIds).toEqual(["goal-123"]);
  });

  it("handles corrupted storage gracefully", () => {
    const storage = new MemoryStorage();
    storage.setItem("test-key", "{ broken json ---");
    const repo = new MortgageRepository("test-key", storage);
    const loaded = repo.loadConfig();

    expect(loaded).toEqual(DEFAULT_MORTGAGE_SIMULATOR_CONFIG);
  });

  it("resets to defaults cleanly", () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);

    repo.saveConfig({
      ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 120 },
    });

    const resetConfig = repo.resetToDefaults();
    expect(resetConfig.property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
    expect(repo.loadConfig().property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
  });
});
