import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import { getDefaultTimeValueConfig } from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository";
import type {
  PersonalGoal,
  WeeklyCheckInEntry,
} from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-types";
import * as authConfig from "@/server/auth/config";
import { InMemoryTimeValueStore, setTestTimeValueStore } from "@/server/lifestyle/time-value-db";

import { DELETE, GET, POST } from "../route";

describe("/api/family-budget/time-value", () => {
  let store: InMemoryTimeValueStore;

  beforeEach(() => {
    store = new InMemoryTimeValueStore();
    setTestTimeValueStore(store);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
  });

  afterEach(() => {
    setTestTimeValueStore(null);
    vi.restoreAllMocks();
  });

  it("rejects unauthorized GET requests when auth bypass is inactive", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/family-budget/time-value");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Unauthorized");
  });

  it("handles GET to load full config when unseeded or populated", async () => {
    // Unseeded
    const reqEmpty = new NextRequest("http://localhost:3000/api/family-budget/time-value");
    const resEmpty = await GET(reqEmpty);
    expect(resEmpty.status).toBe(200);
    const dataEmpty = await resEmpty.json();
    expect(dataEmpty.config).toBeNull();

    // Populated
    const defaults = getDefaultTimeValueConfig();
    await store.saveConfig(defaults);

    const reqFull = new NextRequest("http://localhost:3000/api/family-budget/time-value");
    const resFull = await GET(reqFull);
    expect(resFull.status).toBe(200);
    const dataFull = await resFull.json();
    expect(dataFull.config.me.displayName).toBe("Me");
  });

  it("handles POST to save entire config", async () => {
    const defaults = getDefaultTimeValueConfig();
    const req = new NextRequest("http://localhost:3000/api/family-budget/time-value", {
      method: "POST",
      body: JSON.stringify({ action: "save_config", config: defaults }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.config.wife.displayName).toBe("My Wife");
  });

  it("handles POST to upsert a weekly log entry", async () => {
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

    const req = new NextRequest("http://localhost:3000/api/family-budget/time-value", {
      method: "POST",
      body: JSON.stringify({ action: "upsert_log", entry }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entry.weekStartDate).toBe("2026-11-08");

    // Fetch via GET ?action=logs
    const reqLogs = new NextRequest("http://localhost:3000/api/family-budget/time-value?action=logs");
    const resLogs = await GET(reqLogs);
    const dataLogs = await resLogs.json();
    expect(dataLogs.weeklyLogs).toHaveLength(1);
    expect(dataLogs.weeklyLogs[0].weekStartDate).toBe("2026-11-08");
  });

  it("handles POST to upsert personal goals and DELETE to remove", async () => {
    const goal: PersonalGoal = {
      id: "00000000-0000-4000-8000-000000000009",
      title: "Espresso Grinder",
      category: "home",
      targetAmountPln: 2500,
      currentSavedPln: 500,
      owner: "shared",
      createdAt: new Date().toISOString(),
    };

    // Upsert
    const reqPost = new NextRequest("http://localhost:3000/api/family-budget/time-value", {
      method: "POST",
      body: JSON.stringify({ action: "upsert_goal", goal }),
    });
    const resPost = await POST(reqPost);
    expect(resPost.status).toBe(200);

    // List via GET ?action=goals
    const reqGoals = new NextRequest("http://localhost:3000/api/family-budget/time-value?action=goals");
    const resGoals = await GET(reqGoals);
    const dataGoals = await resGoals.json();
    expect(dataGoals.goals).toHaveLength(1);
    expect(dataGoals.goals[0].title).toBe("Espresso Grinder");

    // Delete
    const reqDel = new NextRequest(`http://localhost:3000/api/family-budget/time-value?goalId=${goal.id}`, {
      method: "DELETE",
    });
    const resDel = await DELETE(reqDel);
    expect(resDel.status).toBe(200);

    const resGoalsAfter = await GET(reqGoals);
    const dataAfter = await resGoalsAfter.json();
    expect(dataAfter.goals).toHaveLength(0);
  });
});
