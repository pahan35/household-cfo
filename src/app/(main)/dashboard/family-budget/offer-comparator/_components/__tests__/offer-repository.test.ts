import { describe, expect, it, vi } from "vitest";

import { DEFAULT_COMPARATOR_CONFIG } from "../compensation-engine";
import { getDefaultStarterTracks, LocalStorageOfferRepository, type StorageLike } from "../offer-repository";
import type { ComparatorGlobalConfig, OfferTrack } from "../offer-types";

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
    const storage = new MemoryStorage();
    const repo = new LocalStorageOfferRepository("test-storage-key-1", storage);
    const { tracks, globalConfig } = await repo.load();

    expect(tracks.length).toBe(3);
    expect(globalConfig.defaultWorkingDaysPerYear).toBe(252);
  });

  it("saves and reloads modified tracks and global config locally", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageOfferRepository("test-storage-key-2", storage);
    const { tracks, globalConfig } = await repo.load();

    const modifiedTracks: OfferTrack[] = [
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

    const modifiedConfig: ComparatorGlobalConfig = {
      ...globalConfig,
      targetMonthlyExpensePln: 18000,
    };

    await repo.save(modifiedTracks, modifiedConfig);

    const reloaded = await repo.load();
    expect(reloaded.tracks).toHaveLength(4);
    expect(reloaded.globalConfig.targetMonthlyExpensePln).toBe(18000);
  });

  it("exports and imports valid JSON backup", () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageOfferRepository("test-storage-key-3", storage);
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
    const storage = new MemoryStorage();
    const repo = new LocalStorageOfferRepository("test-storage-key-4", storage);

    expect(() => repo.importJson("not-a-json")).toThrow("Invalid JSON format");
    expect(() => repo.importJson(JSON.stringify({ version: 2 }))).toThrow("Unsupported schema version");
    expect(() => repo.importJson(JSON.stringify({ version: 1, tracks: "invalid" }))).toThrow(
      "'tracks' must be an array",
    );
  });

  it("resets to defaults cleanly", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageOfferRepository("test-storage-key-5", storage);
    await repo.save([], { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlyExpensePln: 99999 });

    const reset = await repo.resetToDefaults();
    expect(reset.tracks).toHaveLength(3);
    expect(reset.globalConfig.targetMonthlyExpensePln).toBe(DEFAULT_COMPARATOR_CONFIG.targetMonthlyExpensePln);
  });
});

describe("Offer Comparator Remote Synchronization & Auto-Migration", () => {
  it("syncs with remote database when remote tracks exist", async () => {
    const storage = new MemoryStorage();
    const remoteTracks: OfferTrack[] = [
      {
        id: "remote-track-1",
        companyName: "Remote Co",
        roleTitle: "Lead Architect",
        status: "current",
        activeRevisionId: "rev-r1",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        revisions: [],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        tracks: remoteTracks,
        globalConfig: { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlySavingsPln: 11000 },
      }),
    });

    const repo = new LocalStorageOfferRepository("test-cloud-key-1", storage, mockFetch as unknown as typeof fetch);
    const result = await repo.load();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].companyName).toBe("Remote Co");
    expect(result.globalConfig.targetMonthlySavingsPln).toBe(11000);
    expect(result.isOfflineFallback).toBe(false);

    // Verify it updated local storage cache
    const local = repo.loadLocal();
    expect(local.tracks).toHaveLength(1);
    expect(local.tracks[0].id).toBe("remote-track-1");
  });

  it("auto-migrates existing local tracks to remote when remote database is empty", async () => {
    const storage = new MemoryStorage();
    const localTracks: OfferTrack[] = [
      {
        id: "local-track-custom",
        companyName: "Custom Local Corp",
        roleTitle: "Staff Engineer",
        status: "negotiating",
        activeRevisionId: "rev-1",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        revisions: [],
      },
    ];

    // Pre-save to local storage
    const preRepo = new LocalStorageOfferRepository("test-cloud-key-2", storage);
    preRepo.saveLocal(localTracks, { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlyExpensePln: 15500 });

    const mockFetch = vi.fn();
    // 1st call: GET /api/family-budget/offers returns empty tracks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tracks: [], globalConfig: DEFAULT_COMPARATOR_CONFIG }),
    });

    // 2nd call: POST /api/family-budget/offers seeds the remote
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const repo = new LocalStorageOfferRepository("test-cloud-key-2", storage, mockFetch as unknown as typeof fetch);
    const result = await repo.load();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/family-budget/offers",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("local-track-custom"),
      }),
    );
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].companyName).toBe("Custom Local Corp");
    expect(result.globalConfig.targetMonthlyExpensePln).toBe(15500);
    expect(result.isOfflineFallback).toBe(false);
  });

  it("gracefully falls back to local storage when remote endpoint fails or user is offline", async () => {
    const storage = new MemoryStorage();
    const localTracks = getDefaultStarterTracks();
    const preRepo = new LocalStorageOfferRepository("test-cloud-key-3", storage);
    preRepo.saveLocal(localTracks, { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlySavingsPln: 6500 });

    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network connection offline"));

    const repo = new LocalStorageOfferRepository("test-cloud-key-3", storage, mockFetch as unknown as typeof fetch);
    const result = await repo.load();

    expect(result.tracks).toHaveLength(3);
    expect(result.globalConfig.targetMonthlySavingsPln).toBe(6500);
    expect(result.isOfflineFallback).toBe(true);
  });
});
