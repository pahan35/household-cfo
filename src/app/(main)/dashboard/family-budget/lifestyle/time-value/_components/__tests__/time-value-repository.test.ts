import { describe, expect, it } from "vitest";

import { TimeValueRepository } from "../time-value-repository";

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
});
