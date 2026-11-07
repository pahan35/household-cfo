import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDefaultTimeValueConfig } from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository";
import type {
  PersonalGoal,
  WeeklyCheckInEntry,
} from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-types";

import {
  checkInEntryToRows,
  domainToGoalRow,
  ensureUuid,
  goalRowToDomain,
  groupRowsToWeeklyEntries,
  InMemoryTimeValueStore,
  rowsToWeeklyCheckInEntry,
  SupabaseRestTimeValueStore,
  type TimeValueGoalRow,
  type TimeValueProfileRow,
  type TimeValueWeeklyLogRow,
} from "../time-value-db";

describe("Time Value Serialization & Mapping", () => {
  it("converts PersonalGoal domain object to TimeValueGoalRow and back", () => {
    const goal: PersonalGoal = {
      id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      title: "Rome Wellness Weekend",
      category: "travel",
      targetAmountPln: 4500,
      currentSavedPln: 1500,
      owner: "wife",
      notes: "Funded via freelancing",
      targetDate: "2026-06-15",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const row = domainToGoalRow(goal);
    expect(row.id).toBe(goal.id);
    expect(row.title).toBe("Rome Wellness Weekend");
    expect(row.owner_scope).toBe("wife");
    expect(row.target_amount_pln).toBe(4500);
    expect(row.saved_amount_pln).toBe(1500);
    expect(row.is_completed).toBe(false);

    const backToDomain = goalRowToDomain(row);
    expect(backToDomain.id).toBe(goal.id);
    expect(backToDomain.title).toBe(goal.title);
    expect(backToDomain.category).toBe("travel");
    expect(backToDomain.targetAmountPln).toBe(4500);
    expect(backToDomain.currentSavedPln).toBe(1500);
    expect(backToDomain.owner).toBe("wife");
  });

  it("ensures valid UUID generation when goal id is a non-UUID slug", () => {
    const validUuid = ensureUuid("goal-wife-spa");
    expect(validUuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const existingUuid = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
    expect(ensureUuid(existingUuid)).toBe(existingUuid);
  });

  it("converts WeeklyCheckInEntry to 2 relational player rows and reconstructs it accurately", () => {
    const entry: WeeklyCheckInEntry = {
      id: "log-2026-11-01",
      weekStartDate: "2026-11-01",
      weekNumber: 44,
      loggedAt: "2026-11-01T20:00:00.000Z",
      me: {
        careHours: 6,
        gamingTotalHours: 8,
        gamingJoyHours: 5,
        socialTotalHours: 3,
        socialJoyHours: 2,
        actualSideHustleHours: 3.5,
        actualLearningHours: 2,
        actualRelaxHours: 1,
        reflectionNotes: "Solid week of coding and rest.",
      },
      wife: {
        careHours: 24,
        gamingTotalHours: 7,
        gamingJoyHours: 5,
        socialTotalHours: 5,
        socialJoyHours: 3,
        actualSideHustleHours: 4,
        actualLearningHours: 2.5,
        actualRelaxHours: 1.5,
        reflectionNotes: "Shipped meal pantry automation milestone.",
      },
      coupleCelebrationNotes: "Celebrated pet project milestone!",
      totalHouseholdDriftReclaimedHours: 7.5,
      totalHouseholdExtraCashflowPln: 2500,
    };

    const rows = checkInEntryToRows(entry);
    expect(rows).toHaveLength(2);

    const meRow = rows.find((r) => r.player === "me");
    const wifeRow = rows.find((r) => r.player === "wife");

    expect(meRow).toBeDefined();
    expect(wifeRow).toBeDefined();

    expect(meRow?.week_start_date).toBe("2026-11-01");
    expect(meRow?.total_screen_hours).toBe(11); // 8 + 3
    expect(meRow?.joyful_hours).toBe(7); // 5 + 2
    expect(meRow?.drift_hours).toBe(4); // 11 - 7
    expect(meRow?.reclaimed_hours).toBe(6.5); // 3.5 + 2 + 1
    expect(meRow?.partner_care_hours).toBe(6);

    const reconstructed = rowsToWeeklyCheckInEntry(rows);
    expect(reconstructed).not.toBeNull();
    expect(reconstructed?.weekStartDate).toBe("2026-11-01");
    expect(reconstructed?.me.gamingJoyHours).toBe(5);
    expect(reconstructed?.wife.gamingJoyHours).toBe(5);
    expect(reconstructed?.coupleCelebrationNotes).toBe("Celebrated pet project milestone!");
    expect(reconstructed?.totalHouseholdExtraCashflowPln).toBe(2500);
  });

  it("groups multiple weekly rows by date and sorts descending", () => {
    const rowWeek1: TimeValueWeeklyLogRow = {
      week_start_date: "2026-10-26",
      player: "me",
      total_screen_hours: 10,
      joyful_hours: 6,
      drift_hours: 4,
      reclaimed_hours: 3,
      side_hustle_hours: 2,
      learning_hours: 1,
      proper_relax_hours: 0,
      partner_care_hours: 5,
      spouse_bounties_earned_pln: 0,
      monetized_value_pln: 0,
      reflections: "Week 1",
      raw_entry_json: {},
    };

    const rowWeek2: TimeValueWeeklyLogRow = {
      week_start_date: "2026-11-02",
      player: "me",
      total_screen_hours: 8,
      joyful_hours: 5,
      drift_hours: 3,
      reclaimed_hours: 2,
      side_hustle_hours: 1,
      learning_hours: 1,
      proper_relax_hours: 0,
      partner_care_hours: 5,
      spouse_bounties_earned_pln: 0,
      monetized_value_pln: 0,
      reflections: "Week 2",
      raw_entry_json: {},
    };

    const grouped = groupRowsToWeeklyEntries([rowWeek1, rowWeek2]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].weekStartDate).toBe("2026-11-02");
    expect(grouped[1].weekStartDate).toBe("2026-10-26");
  });
});

describe("InMemoryTimeValueStore", () => {
  it("returns null on loadConfig when empty", async () => {
    const store = new InMemoryTimeValueStore();
    const config = await store.loadConfig();
    expect(config).toBeNull();
  });

  it("saves and loads full TimeValueMotivatorConfig accurately", async () => {
    const store = new InMemoryTimeValueStore();
    const defaultConfig = getDefaultTimeValueConfig();

    await store.saveConfig(defaultConfig);

    const loaded = await store.loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.me.displayName).toBe("Me");
    expect(loaded?.wife.displayName).toBe("My Wife");
    expect(loaded?.personalGoals.length).toBeGreaterThan(0);
    expect(loaded?.weeklyLogs.length).toBeGreaterThan(0);
  });

  it("upserts, lists, and deletes weekly logs", async () => {
    const store = new InMemoryTimeValueStore();

    const entry: WeeklyCheckInEntry = {
      id: "log-1",
      weekStartDate: "2026-11-01",
      loggedAt: new Date().toISOString(),
      me: {
        careHours: 5,
        gamingTotalHours: 6,
        gamingJoyHours: 4,
        socialTotalHours: 2,
        socialJoyHours: 1,
        actualSideHustleHours: 2,
        actualLearningHours: 1,
        actualRelaxHours: 1,
      },
      wife: {
        careHours: 20,
        gamingTotalHours: 5,
        gamingJoyHours: 3,
        socialTotalHours: 4,
        socialJoyHours: 2,
        actualSideHustleHours: 3,
        actualLearningHours: 2,
        actualRelaxHours: 1,
      },
      totalHouseholdDriftReclaimedHours: 5,
      totalHouseholdExtraCashflowPln: 1500,
    };

    await store.upsertWeeklyLog(entry);

    const list = await store.listWeeklyLogs();
    expect(list).toHaveLength(1);
    expect(list[0].weekStartDate).toBe("2026-11-01");

    // Upsert update
    const updatedEntry: WeeklyCheckInEntry = {
      ...entry,
      coupleCelebrationNotes: "Updated notes",
      totalHouseholdExtraCashflowPln: 2000,
    };
    await store.upsertWeeklyLog(updatedEntry);

    const listUpdated = await store.listWeeklyLogs();
    expect(listUpdated).toHaveLength(1);
    expect(listUpdated[0].coupleCelebrationNotes).toBe("Updated notes");
    expect(listUpdated[0].totalHouseholdExtraCashflowPln).toBe(2000);

    // Delete
    const deleted = await store.deleteWeeklyLog("2026-11-01");
    expect(deleted).toBe(true);
    expect(await store.listWeeklyLogs()).toHaveLength(0);
  });

  it("upserts, lists, and deletes personal goals", async () => {
    const store = new InMemoryTimeValueStore();
    const goal: PersonalGoal = {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Espresso Setup",
      category: "home",
      targetAmountPln: 3500,
      currentSavedPln: 1200,
      owner: "shared",
      createdAt: new Date().toISOString(),
    };

    await store.upsertGoal(goal);

    const goals = await store.listGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0].title).toBe("Espresso Setup");

    // Update saved amount
    await store.upsertGoal({ ...goal, currentSavedPln: 2000 });
    const updatedGoals = await store.listGoals();
    expect(updatedGoals[0].currentSavedPln).toBe(2000);

    // Delete goal
    await store.deleteGoal(goal.id);
    expect(await store.listGoals()).toHaveLength(0);
  });
});

describe("SupabaseRestTimeValueStore", () => {
  const mockUrl = "https://mock.supabase.co";
  const mockKey = "mock-service-key";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when database tables are empty", async () => {
    const store = new SupabaseRestTimeValueStore(mockUrl, mockKey);

    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] }) // profiles
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] }) // goals
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] }); // weekly logs

    const config = await store.loadConfig();
    expect(config).toBeNull();
  });

  it("loads config from Supabase REST rows", async () => {
    const store = new SupabaseRestTimeValueStore(mockUrl, mockKey);

    const mockProfiles: TimeValueProfileRow[] = [
      {
        player: "me",
        target_hourly_rate_pln: 175,
        daily_drift_target_hours: 1,
        learning_rate_growth_pct: 6,
        raw_profile_json: { id: "me", displayName: "Primary Me" },
        pet_projects_json: [],
      },
      {
        player: "wife",
        target_hourly_rate_pln: 90,
        daily_drift_target_hours: 1,
        learning_rate_growth_pct: 6,
        raw_profile_json: { id: "wife", displayName: "Partner Wife" },
        pet_projects_json: [],
      },
    ];

    const mockGoals: TimeValueGoalRow[] = [
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "Rome Trip",
        category: "travel",
        target_amount_pln: 5000,
        saved_amount_pln: 2000,
        owner_scope: "wife",
        is_completed: false,
        raw_goal_json: {},
      },
    ];

    const mockWeeklyLogs: TimeValueWeeklyLogRow[] = [
      {
        week_start_date: "2026-11-01",
        player: "me",
        total_screen_hours: 10,
        joyful_hours: 6,
        drift_hours: 4,
        reclaimed_hours: 3,
        side_hustle_hours: 2,
        learning_hours: 1,
        proper_relax_hours: 0,
        partner_care_hours: 5,
        spouse_bounties_earned_pln: 0,
        monetized_value_pln: 0,
        reflections: "Great week",
        raw_entry_json: {},
      },
    ];

    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockProfiles })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockGoals })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockWeeklyLogs });

    const config = await store.loadConfig();
    expect(config).not.toBeNull();
    expect(config?.me.displayName).toBe("Primary Me");
    expect(config?.wife.displayName).toBe("Partner Wife");
    expect(config?.personalGoals[0].title).toBe("Rome Trip");
    expect(config?.weeklyLogs[0].weekStartDate).toBe("2026-11-01");
  });

  it("saves config by upserting to all tables with merge-duplicates header", async () => {
    const store = new SupabaseRestTimeValueStore(mockUrl, mockKey);
    const defaults = getDefaultTimeValueConfig();

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await store.saveConfig(defaults);

    expect(fetch).toHaveBeenCalledWith(
      "https://mock.supabase.co/rest/v1/time_value_profiles?on_conflict=player",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Prefer: "resolution=merge-duplicates",
        }),
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://mock.supabase.co/rest/v1/time_value_goals?on_conflict=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Prefer: "resolution=merge-duplicates",
        }),
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://mock.supabase.co/rest/v1/time_value_weekly_logs?on_conflict=player,week_start_date",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Prefer: "resolution=merge-duplicates",
        }),
      }),
    );
  });
});
