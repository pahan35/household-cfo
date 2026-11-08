import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InMemoryTimeValueStore, setTestTimeValueStore } from "@/server/lifestyle/time-value-db";

import { applyScreenLog, ingestScreenLogs, listWeeklyLogs } from "../screen-log-service";
import type { AuthContext } from "../types";

const ctx: AuthContext = { subject: "mobile", source: "bearer" };

describe("screen-log-service", () => {
  beforeEach(() => setTestTimeValueStore(new InMemoryTimeValueStore()));
  afterEach(() => setTestTimeValueStore(null));

  it("creates a weekly entry from a screen log", () => {
    const entry = applyScreenLog(undefined, {
      weekStartDate: "2026-11-02",
      player: "wife",
      gamingTotalHours: 3,
      socialTotalHours: 5,
    });
    expect(entry.weekStartDate).toBe("2026-11-02");
    expect(entry.wife.gamingTotalHours).toBe(3);
    expect(entry.wife.socialTotalHours).toBe(5);
    expect(entry.me.gamingTotalHours).toBe(0);
  });

  it("preserves manual reflection data and clamps joyful hours", () => {
    const existing = applyScreenLog(undefined, { weekStartDate: "2026-11-02", player: "me", gamingTotalHours: 10 });
    existing.me.gamingJoyHours = 8;
    existing.me.actualLearningHours = 2;

    const merged = applyScreenLog(existing, { weekStartDate: "2026-11-02", player: "me", gamingTotalHours: 4 });
    expect(merged.me.gamingTotalHours).toBe(4);
    expect(merged.me.gamingJoyHours).toBe(4);
    expect(merged.me.actualLearningHours).toBe(2);
    expect(merged.id).toBe(existing.id);
  });

  it("ingests batches idempotently per week", async () => {
    await ingestScreenLogs(ctx, [
      { weekStartDate: "2026-11-02", player: "me", gamingTotalHours: 2 },
      { weekStartDate: "2026-11-02", player: "wife", socialTotalHours: 6 },
    ]);
    await ingestScreenLogs(ctx, [{ weekStartDate: "2026-11-02", player: "me", gamingTotalHours: 3 }]);

    const logs = await listWeeklyLogs(ctx);
    expect(logs).toHaveLength(1);
    expect(logs[0].me.gamingTotalHours).toBe(3);
    expect(logs[0].wife.socialTotalHours).toBe(6);
  });
});
