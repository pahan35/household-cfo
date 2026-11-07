import { describe, expect, it, vi } from "vitest";

import { getDefaultTimeValueConfig, TimeValueRepository } from "../time-value-repository";
import type { PersonalGoal, WeeklyCheckInEntry } from "../time-value-types";

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe("TimeValueDashboard Sunday Check-In & Goal Sync across Reload", () => {
  it("persists Sunday weekly check-in log across simulated page reloads", async () => {
    const sharedStorage = new MockLocalStorage();
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, ...body }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ config: getDefaultTimeValueConfig() }),
      };
    });

    // 1. Session A: User opens dashboard and logs a Sunday check-in
    const repoA = new TimeValueRepository("test-time-value", sharedStorage, mockFetch as unknown as typeof fetch);
    const sundayEntry: WeeklyCheckInEntry = {
      id: "log-sunday-nov-8",
      weekStartDate: "2026-11-08",
      weekNumber: 45,
      loggedAt: "2026-11-08T19:30:00.000Z",
      me: {
        careHours: 6,
        gamingTotalHours: 7,
        gamingJoyHours: 5,
        socialTotalHours: 3,
        socialJoyHours: 2,
        actualSideHustleHours: 3.5,
        actualLearningHours: 2,
        actualRelaxHours: 1,
        reflectionNotes: "Recharged and finished Next.js 16 caching module.",
      },
      wife: {
        careHours: 26,
        gamingTotalHours: 6,
        gamingJoyHours: 4,
        socialTotalHours: 5,
        socialJoyHours: 3,
        actualSideHustleHours: 4.5,
        actualLearningHours: 2,
        actualRelaxHours: 1.5,
        reflectionNotes: "Enjoyed co-op gaming and shipped client creative work.",
      },
      coupleCelebrationNotes: "Remarkable teamwork on weekend chores and balance!",
      totalHouseholdDriftReclaimedHours: 8,
      totalHouseholdExtraCashflowPln: 2800,
    };

    const updatedConfigA = await repoA.addRemoteWeeklyCheckIn(sundayEntry);
    expect(updatedConfigA.weeklyLogs.some((l) => l.weekStartDate === "2026-11-08")).toBe(true);

    // 2. Simulated browser reload: instantiate new repo B sharing the same storage
    const repoB = new TimeValueRepository("test-time-value", sharedStorage, mockFetch as unknown as typeof fetch);
    const reloadedConfig = repoB.loadConfig();

    const restoredSundayLog = reloadedConfig.weeklyLogs.find((l) => l.weekStartDate === "2026-11-08");
    expect(restoredSundayLog).toBeDefined();
    expect(restoredSundayLog?.me.gamingJoyHours).toBe(5);
    expect(restoredSundayLog?.wife.actualSideHustleHours).toBe(4.5);
    expect(restoredSundayLog?.coupleCelebrationNotes).toBe("Remarkable teamwork on weekend chores and balance!");
    expect(restoredSundayLog?.totalHouseholdExtraCashflowPln).toBe(2800);
  });

  it("updates personal goals and retains accelerated progress across simulated reloads", async () => {
    const sharedStorage = new MockLocalStorage();
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ config: null }),
      };
    });

    const repoA = new TimeValueRepository("test-time-value", sharedStorage, mockFetch as unknown as typeof fetch);
    const initialConfig = repoA.loadConfig();

    // Accelerate Rome trip goal with spouse bounties
    const romeGoal = initialConfig.personalGoals.find((g) => g.id === "goal-wife-rome-spa");
    expect(romeGoal).toBeDefined();

    const acceleratedGoal: PersonalGoal = {
      ...romeGoal!,
      currentSavedPln: 3500, // saved up from 1500 to 3500 PLN
      notes: "Accelerated by freelance client retainer and meal pantry bounty.",
    };

    await repoA.saveRemoteGoal(acceleratedGoal);

    // Simulated browser reload: new session reads from storage
    const repoB = new TimeValueRepository("test-time-value", sharedStorage, mockFetch as unknown as typeof fetch);
    const reloadedConfig = repoB.loadConfig();

    const reloadedGoal = reloadedConfig.personalGoals.find((g) => g.id === "goal-wife-rome-spa");
    expect(reloadedGoal?.currentSavedPln).toBe(3500);
    expect(reloadedGoal?.notes).toContain("meal pantry bounty");
  });
});
