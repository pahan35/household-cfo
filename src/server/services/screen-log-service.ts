import "server-only";

import type {
  PartnerWeeklyReflection,
  WeeklyCheckInEntry,
} from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-types";
import type { ScreenLogDto } from "@/lib/schemas/screen-log";
import { getTimeValueStore } from "@/server/lifestyle/time-value-db";

import { type AuthContext, guard } from "./types";

function emptyReflection(): PartnerWeeklyReflection {
  return {
    careHours: 0,
    gamingTotalHours: 0,
    gamingJoyHours: 0,
    socialTotalHours: 0,
    socialJoyHours: 0,
    actualSideHustleHours: 0,
    actualLearningHours: 0,
    actualRelaxHours: 0,
  };
}

/**
 * Merges one screen-time report into a weekly check-in entry without clobbering
 * any manually logged reflection data. Joyful hours are clamped to the reported totals.
 */
export function applyScreenLog(existing: WeeklyCheckInEntry | undefined, log: ScreenLogDto): WeeklyCheckInEntry {
  const base: WeeklyCheckInEntry = existing ?? {
    id: crypto.randomUUID(),
    weekStartDate: log.weekStartDate,
    loggedAt: new Date().toISOString(),
    me: emptyReflection(),
    wife: emptyReflection(),
    totalHouseholdDriftReclaimedHours: 0,
    totalHouseholdExtraCashflowPln: 0,
  };

  const current = base[log.player];
  const gamingTotalHours = log.gamingTotalHours ?? current.gamingTotalHours;
  const socialTotalHours = log.socialTotalHours ?? current.socialTotalHours;

  return {
    ...base,
    [log.player]: {
      ...current,
      gamingTotalHours,
      socialTotalHours,
      gamingJoyHours: Math.min(current.gamingJoyHours, gamingTotalHours),
      socialJoyHours: Math.min(current.socialJoyHours, socialTotalHours),
    },
  };
}

export async function listWeeklyLogs(_ctx: AuthContext): Promise<WeeklyCheckInEntry[]> {
  return guard("internal", "Failed to load weekly logs", () => getTimeValueStore().listWeeklyLogs());
}

export async function upsertWeeklyLog(_ctx: AuthContext, entry: WeeklyCheckInEntry): Promise<WeeklyCheckInEntry> {
  return guard("internal", "Failed to save weekly log", () => getTimeValueStore().upsertWeeklyLog(entry));
}

export async function deleteWeeklyLog(_ctx: AuthContext, weekStartDate: string): Promise<boolean> {
  return guard("internal", "Failed to delete weekly log", () => getTimeValueStore().deleteWeeklyLog(weekStartDate));
}

/** Ingests a batch of screen-time reports (mobile export, automation, or manual import). */
export async function ingestScreenLogs(
  ctx: AuthContext,
  logs: ScreenLogDto[],
): Promise<{ entries: WeeklyCheckInEntry[] }> {
  const store = getTimeValueStore();
  const existing = await listWeeklyLogs(ctx);
  const byWeek = new Map(existing.map((entry) => [entry.weekStartDate, entry]));

  const entries: WeeklyCheckInEntry[] = [];
  for (const log of logs) {
    const merged = applyScreenLog(byWeek.get(log.weekStartDate), log);
    const saved = await guard("internal", "Failed to save screen log", () => store.upsertWeeklyLog(merged));
    byWeek.set(saved.weekStartDate, saved);
    entries.push(saved);
  }
  return { entries };
}
