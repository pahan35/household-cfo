import { describe, expect, it, vi } from "vitest";

import { getDefaultTimeValueConfig, TimeValueRepository } from "../time-value-repository";
import type { PersonalGoal, WeeklyCheckInEntry } from "../time-value-types";

class MockStorage {
  private data: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.data[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.data[key] = value;
  }

  removeItem(key: string): void {
    delete this.data[key];
  }
}

describe("TimeValueRepository", () => {
  it("loads default config on empty storage", () => {
    const storage = new MockStorage();
    const repo = new TimeValueRepository("test-key", storage);
    const config = repo.loadConfig();

    expect(config.me.displayName).toBe("Me");
    expect(config.wife.displayName).toBe("My Wife");
    expect(config.wife.care.careHoursPerWeek).toBe(25);
    expect(config.petProjects.length).toBeGreaterThan(0);
    expect(config.personalGoals.length).toBeGreaterThan(0);
  });

  it("persists and restores updated configuration", () => {
    const storage = new MockStorage();
    const repo = new TimeValueRepository("test-key", storage);
    const config = repo.loadConfig();

    config.wife.care.careHoursPerWeek = 28;
    config.me.monetization.monetizedDaysOff = 10;
    repo.saveConfig(config);

    const reloadedRepo = new TimeValueRepository("test-key", storage);
    const reloaded = reloadedRepo.loadConfig();
    expect(reloaded.wife.care.careHoursPerWeek).toBe(28);
    expect(reloaded.me.monetization.monetizedDaysOff).toBe(10);
  });

  it("exports and imports valid JSON configuration", () => {
    const storage = new MockStorage();
    const repo = new TimeValueRepository("test-key", storage);
    const config = repo.loadConfig();
    config.personalGoals.push({
      id: "goal-test",
      title: "Test Goal",
      category: "tech",
      targetAmountPln: 2000,
      currentSavedPln: 500,
      owner: "me",
      createdAt: "2026-03-01T00:00:00.000Z",
    });

    const exported = repo.exportJson(config);
    expect(typeof exported).toBe("string");

    const newStorage = new MockStorage();
    const newRepo = new TimeValueRepository("test-key-2", newStorage);
    const imported = newRepo.importJson(exported);

    expect(imported.personalGoals.some((g) => g.id === "goal-test")).toBe(true);
  });

  it("auto-migrates local config to Supabase when remote is unseeded/null", async () => {
    const storage = new MockStorage();
    const customFetch = vi.fn();

    // 1. GET returns { config: null }
    customFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ config: null }),
    });

    // 2. POST save_config succeeds
    customFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ config: getDefaultTimeValueConfig() }),
    });

    const repo = new TimeValueRepository("test-key", storage, customFetch as unknown as typeof fetch);
    const result = await repo.fetchRemoteConfig();

    expect(result.wasAutoMigrated).toBe(true);
    expect(customFetch).toHaveBeenCalledTimes(2);
    expect(customFetch).toHaveBeenNthCalledWith(
      1,
      "/api/family-budget/time-value",
      expect.objectContaining({ method: "GET" }),
    );
    expect(customFetch).toHaveBeenNthCalledWith(
      2,
      "/api/family-budget/time-value",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("save_config"),
      }),
    );
  });

  it("synchronizes remote config and caches in localStorage", async () => {
    const storage = new MockStorage();
    const customFetch = vi.fn();

    const remoteConfig = getDefaultTimeValueConfig();
    remoteConfig.me.displayName = "Remote Me";

    customFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ config: remoteConfig }),
    });

    const repo = new TimeValueRepository("test-key", storage, customFetch as unknown as typeof fetch);
    const result = await repo.fetchRemoteConfig();

    expect(result.isOfflineFallback).toBe(false);
    expect(result.config.me.displayName).toBe("Remote Me");

    // LocalStorage must now have cached remote data
    const local = repo.loadConfig();
    expect(local.me.displayName).toBe("Remote Me");
  });

  it("gracefully falls back to localStorage when network or remote call fails", async () => {
    const storage = new MockStorage();
    const customFetch = vi.fn().mockRejectedValue(new Error("Network offline"));

    const repo = new TimeValueRepository("test-key", storage, customFetch as unknown as typeof fetch);
    const seeded = repo.loadConfig();
    seeded.wife.displayName = "Cached Wife";
    repo.saveConfig(seeded);

    const result = await repo.fetchRemoteConfig();
    expect(result.isOfflineFallback).toBe(true);
    expect(result.config.wife.displayName).toBe("Cached Wife");
  });

  it("adds weekly check-in logs remotely and updates local storage", async () => {
    const storage = new MockStorage();
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const repo = new TimeValueRepository("test-key", storage, customFetch as unknown as typeof fetch);

    const entry: WeeklyCheckInEntry = {
      id: "log-2026-11-08",
      weekStartDate: "2026-11-08",
      loggedAt: new Date().toISOString(),
      me: {
        careHours: 6,
        gamingTotalHours: 7,
        gamingJoyHours: 5,
        socialTotalHours: 2,
        socialJoyHours: 1,
        actualSideHustleHours: 3,
        actualLearningHours: 1,
        actualRelaxHours: 1,
      },
      wife: {
        careHours: 25,
        gamingTotalHours: 6,
        gamingJoyHours: 4,
        socialTotalHours: 5,
        socialJoyHours: 3,
        actualSideHustleHours: 4,
        actualLearningHours: 2,
        actualRelaxHours: 1,
      },
      totalHouseholdDriftReclaimedHours: 7,
      totalHouseholdExtraCashflowPln: 2100,
    };

    const updated = await repo.addRemoteWeeklyCheckIn(entry);
    expect(updated.weeklyLogs.some((l) => l.weekStartDate === "2026-11-08")).toBe(true);
    expect(repo.loadConfig().weeklyLogs.some((l) => l.weekStartDate === "2026-11-08")).toBe(true);
  });

  it("saves and deletes goals remotely and updates local storage", async () => {
    const storage = new MockStorage();
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const repo = new TimeValueRepository("test-key", storage, customFetch as unknown as typeof fetch);
    const goal: PersonalGoal = {
      id: "g-remote-1",
      title: "Noise-Cancelling Headphones",
      category: "tech",
      targetAmountPln: 1600,
      currentSavedPln: 600,
      owner: "me",
      createdAt: new Date().toISOString(),
    };

    // Save
    const afterSave = await repo.saveRemoteGoal(goal);
    expect(afterSave.personalGoals.some((g) => g.id === "g-remote-1")).toBe(true);

    // Delete
    const afterDel = await repo.deleteRemoteGoal("g-remote-1");
    expect(afterDel.personalGoals.some((g) => g.id === "g-remote-1")).toBe(false);
  });
});
