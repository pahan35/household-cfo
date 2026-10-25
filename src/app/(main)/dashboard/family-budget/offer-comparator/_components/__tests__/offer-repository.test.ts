import { describe, expect, it } from "vitest";

import { DEFAULT_COMPARATOR_CONFIG } from "../compensation-engine";
import { getDefaultStarterTracks, LocalStorageOfferRepository } from "../offer-repository";

describe("Offer Comparator Repository & Starter Tracks", () => {
  it("provides 3 starter tracks: Current Employer, Past Employer, and Negotiating Offer", () => {
    const tracks = getDefaultStarterTracks();
    expect(tracks).toHaveLength(3);

    const current = tracks.find((t) => t.status === "current");
    expect(current).toBeDefined();
    expect(current?.revisions).toHaveLength(2); // Baseline PLN + USD Restructure

    const past = tracks.find((t) => t.status === "past_accepted");
    expect(past).toBeDefined();
    expect(past?.revisions).toHaveLength(2); // Year 1 + Year 2 raise

    const neg = tracks.find((t) => t.status === "negotiating");
    expect(neg).toBeDefined();
    expect(neg?.revisions[0].taxProfile.regime).toBe("uop");
  });

  it("loads starter tracks on initial load when storage is empty", async () => {
    const repo = new LocalStorageOfferRepository("test-storage-key-1");
    const { tracks, globalConfig } = await repo.load();

    expect(tracks.length).toBe(3);
    expect(globalConfig.defaultWorkingDaysPerYear).toBe(252);
  });

  it("saves and reloads modified tracks and global config", async () => {
    const repo = new LocalStorageOfferRepository("test-storage-key-2");
    const { tracks, globalConfig } = await repo.load();

    const modifiedTracks = [
      ...tracks,
      {
        id: "custom-track",
        companyName: "Google",
        roleTitle: "Staff SWE",
        status: "negotiating" as const,
        activeRevisionId: "rev-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revisions: [],
      },
    ];

    const modifiedConfig = {
      ...globalConfig,
      targetMonthlyExpensePln: 18000,
    };

    await repo.save(modifiedTracks, modifiedConfig);

    const reloaded = await repo.load();
    expect(reloaded.tracks).toHaveLength(4);
    expect(reloaded.globalConfig.targetMonthlyExpensePln).toBe(18000);
  });

  it("exports and imports valid JSON backup", () => {
    const repo = new LocalStorageOfferRepository("test-storage-key-3");
    const tracks = getDefaultStarterTracks();
    const config = { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlySavingsPln: 8500 };

    const exported = repo.exportJson(tracks, config);
    expect(typeof exported).toBe("string");
    expect(exported).toContain('"version": 1');
    expect(exported).toContain('"targetMonthlySavingsPln": 8500');

    const imported = repo.importJson(exported);
    expect(imported.tracks).toHaveLength(3);
    expect(imported.globalConfig.targetMonthlySavingsPln).toBe(8500);
  });

  it("throws informative error when importing malformed JSON or invalid schema", () => {
    const repo = new LocalStorageOfferRepository("test-storage-key-4");

    expect(() => repo.importJson("not-a-json")).toThrow("Invalid JSON format");
    expect(() => repo.importJson(JSON.stringify({ version: 2 }))).toThrow("Unsupported schema version");
    expect(() => repo.importJson(JSON.stringify({ version: 1, tracks: "invalid" }))).toThrow(
      "'tracks' must be an array",
    );
  });

  it("resets to defaults cleanly", async () => {
    const repo = new LocalStorageOfferRepository("test-storage-key-5");
    await repo.save([], { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlyExpensePln: 99999 });

    const reset = await repo.resetToDefaults();
    expect(reset.tracks).toHaveLength(3);
    expect(reset.globalConfig.targetMonthlyExpensePln).toBe(DEFAULT_COMPARATOR_CONFIG.targetMonthlyExpensePln);
  });
});
