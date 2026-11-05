import { beforeEach, describe, expect, it } from "vitest";

import { OFFER_STORAGE_KEY } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";

import { DEFAULT_RUNWAY_STORAGE_PAYLOAD, RunwayRepository, type StorageLike } from "../runway-repository";

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

describe("runway-repository", () => {
  let memoryStorage: MemoryStorage;
  let repository: RunwayRepository;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    repository = new RunwayRepository("test-runway-key", memoryStorage);
  });

  it("loads default payload when storage is empty", async () => {
    const payload = await repository.load();
    expect(payload.version).toBe(1);
    expect(payload.lookbackWindow).toBe("3m");
    expect(payload.jdgConfig.posture).toBe("active");
    expect(payload.capitalPoolConfig.safetyFloorPln).toBe(10000);
  });

  it("persists and restores payload across saves", async () => {
    const customPayload = {
      ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
      lookbackWindow: "6m" as const,
      jdgConfig: {
        ...DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig,
        posture: "suspended" as const,
        monthlyAccountingCostPln: 150,
      },
      capitalPoolConfig: {
        ...DEFAULT_RUNWAY_STORAGE_PAYLOAD.capitalPoolConfig,
        safetyFloorPln: 25000,
      },
      categoryWeights: {
        "cat-trips": { enabled: false, retentionPct: 0 },
      },
    };

    await repository.save(customPayload);

    // Create a new repository instance pointing to same storage
    const newRepo = new RunwayRepository("test-runway-key", memoryStorage);
    const restored = await newRepo.load();

    expect(restored.lookbackWindow).toBe("6m");
    expect(restored.jdgConfig.posture).toBe("suspended");
    expect(restored.jdgConfig.monthlyAccountingCostPln).toBe(150);
    expect(restored.capitalPoolConfig.safetyFloorPln).toBe(25000);
    expect(restored.categoryWeights["cat-trips"].enabled).toBe(false);
  });

  it("seeds JDG config and benefit replacement from OfferRepository current track", async () => {
    const mockOfferStorage = {
      version: 1,
      tracks: [
        {
          id: "track-1",
          companyName: "Acme",
          status: "current",
          activeRevisionId: "rev-1",
          revisions: [
            {
              id: "rev-1",
              taxProfile: {
                regime: "b2b_ryczalt",
                zusStage: "duzy_zus",
                voluntarySickness: true,
                monthlyAccountingCostPln: 350,
                pfronRebate: { enabled: true, type: "percentage", percentage: 50, fixedAmountPln: 0 },
              },
              benefits: [
                { id: "b1", name: "Health", monthlyBudgetOffsetPln: 300 },
                { id: "b2", name: "Gym", monthlyBudgetOffsetPln: 150 },
              ],
            },
          ],
        },
      ],
    };

    memoryStorage.setItem(OFFER_STORAGE_KEY, JSON.stringify(mockOfferStorage));

    const seededRepo = new RunwayRepository("seeded-runway-key", memoryStorage);
    const seeded = await seededRepo.seedJdgConfigFromOfferRepository();

    expect(seeded.regime).toBe("b2b_ryczalt");
    expect(seeded.zusStage).toBe("duzy_zus");
    expect(seeded.monthlyAccountingCostPln).toBe(350);
    expect(seeded.pfronRebate?.enabled).toBe(true);
    expect(seeded.benefitLossReplacementPln).toBe(450); // 300 + 150
  });

  it("resets cleanly to defaults", async () => {
    await repository.save({
      ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
      lookbackWindow: "1m",
    });

    const reset = await repository.resetToDefaults();
    expect(reset.lookbackWindow).toBe("3m");
  });
});
