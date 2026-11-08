import "server-only";

import { getDefaultTimeValueConfig } from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-repository";
import type {
  FamilyPetProject,
  GoalOwner,
  PartnerWeeklyReflection,
  PersonalGoal,
  PrimaryPlayerProfile,
  SpousePlayerProfile,
  TimeValueMotivatorConfig,
  WeeklyCheckInEntry,
} from "@/app/(main)/dashboard/family-budget/lifestyle/time-value/_components/time-value-types";
import { resolveSupabaseCredentials } from "@/server/supabase/config";

export interface TimeValueProfileRow {
  player: "me" | "wife";
  target_hourly_rate_pln: number | string;
  daily_drift_target_hours: number | string;
  learning_rate_growth_pct: number | string;
  raw_profile_json: unknown;
  pet_projects_json: unknown;
  updated_at?: string;
}

export interface TimeValueGoalRow {
  id: string;
  title: string;
  category: string;
  target_amount_pln: number | string;
  saved_amount_pln: number | string;
  owner_scope: string;
  is_completed: boolean;
  notes?: string | null;
  target_date?: string | null;
  raw_goal_json: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface TimeValueWeeklyLogRow {
  id?: string;
  week_start_date: string;
  player: "me" | "wife";
  total_screen_hours: number | string;
  joyful_hours: number | string;
  drift_hours: number | string;
  reclaimed_hours: number | string;
  side_hustle_hours: number | string;
  learning_hours: number | string;
  proper_relax_hours: number | string;
  partner_care_hours: number | string;
  spouse_bounties_earned_pln: number | string;
  monetized_value_pln: number | string;
  reflections: string | null;
  raw_entry_json: unknown;
  created_at?: string;
  updated_at?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureUuid(id?: string): string {
  if (id && UUID_REGEX.test(id)) return id;
  return crypto.randomUUID();
}

export function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val as T;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function num(v: number | string | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function goalRowToDomain(row: TimeValueGoalRow): PersonalGoal {
  const raw = parseJsonSafe<Partial<PersonalGoal>>(row.raw_goal_json, {});
  return {
    id: row.id,
    title: row.title ?? raw.title ?? "Personal Goal",
    category: (row.category as PersonalGoal["category"]) ?? raw.category ?? "other",
    targetAmountPln: num(row.target_amount_pln, raw.targetAmountPln ?? 0),
    currentSavedPln: num(row.saved_amount_pln, raw.currentSavedPln ?? 0),
    owner: (row.owner_scope as GoalOwner) ?? raw.owner ?? "shared",
    notes: row.notes ?? raw.notes ?? undefined,
    targetDate: row.target_date ?? raw.targetDate ?? undefined,
    createdAt: row.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export function domainToGoalRow(goal: PersonalGoal): TimeValueGoalRow {
  const validId = ensureUuid(goal.id);
  return {
    id: validId,
    title: goal.title.trim() ? goal.title.trim() : "Personal Goal",
    category: goal.category ? goal.category : "other",
    target_amount_pln: goal.targetAmountPln,
    saved_amount_pln: goal.currentSavedPln,
    owner_scope: goal.owner || "shared",
    is_completed: goal.currentSavedPln >= goal.targetAmountPln,
    notes: goal.notes ?? null,
    target_date: goal.targetDate ?? null,
    raw_goal_json: { ...goal, id: validId },
    created_at: goal.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function checkInEntryToRows(entry: WeeklyCheckInEntry): TimeValueWeeklyLogRow[] {
  const meTotalScreen = (entry.me.gamingTotalHours ?? 0) + (entry.me.socialTotalHours ?? 0);
  const meJoyScreen = (entry.me.gamingJoyHours ?? 0) + (entry.me.socialJoyHours ?? 0);
  const meDrift = Math.max(0, meTotalScreen - meJoyScreen);
  const meReclaimed =
    (entry.me.actualSideHustleHours ?? 0) + (entry.me.actualLearningHours ?? 0) + (entry.me.actualRelaxHours ?? 0);

  const wifeTotalScreen = (entry.wife.gamingTotalHours ?? 0) + (entry.wife.socialTotalHours ?? 0);
  const wifeJoyScreen = (entry.wife.gamingJoyHours ?? 0) + (entry.wife.socialJoyHours ?? 0);
  const wifeDrift = Math.max(0, wifeTotalScreen - wifeJoyScreen);
  const wifeReclaimed =
    (entry.wife.actualSideHustleHours ?? 0) +
    (entry.wife.actualLearningHours ?? 0) +
    (entry.wife.actualRelaxHours ?? 0);

  const meRow: TimeValueWeeklyLogRow = {
    week_start_date: entry.weekStartDate,
    player: "me",
    total_screen_hours: meTotalScreen,
    joyful_hours: meJoyScreen,
    drift_hours: meDrift,
    reclaimed_hours: meReclaimed,
    side_hustle_hours: entry.me.actualSideHustleHours ?? 0,
    learning_hours: entry.me.actualLearningHours ?? 0,
    proper_relax_hours: entry.me.actualRelaxHours ?? 0,
    partner_care_hours: entry.me.careHours ?? 0,
    spouse_bounties_earned_pln: 0,
    monetized_value_pln: 0,
    reflections: entry.me.reflectionNotes ?? null,
    raw_entry_json: {
      reflection: entry.me,
      entryId: entry.id,
      weekNumber: entry.weekNumber,
      loggedAt: entry.loggedAt,
      coupleCelebrationNotes: entry.coupleCelebrationNotes,
      totalHouseholdDriftReclaimedHours: entry.totalHouseholdDriftReclaimedHours,
      totalHouseholdExtraCashflowPln: entry.totalHouseholdExtraCashflowPln,
    },
    updated_at: new Date().toISOString(),
  };

  const wifeRow: TimeValueWeeklyLogRow = {
    week_start_date: entry.weekStartDate,
    player: "wife",
    total_screen_hours: wifeTotalScreen,
    joyful_hours: wifeJoyScreen,
    drift_hours: wifeDrift,
    reclaimed_hours: wifeReclaimed,
    side_hustle_hours: entry.wife.actualSideHustleHours ?? 0,
    learning_hours: entry.wife.actualLearningHours ?? 0,
    proper_relax_hours: entry.wife.actualRelaxHours ?? 0,
    partner_care_hours: entry.wife.careHours ?? 0,
    spouse_bounties_earned_pln: 0,
    monetized_value_pln: 0,
    reflections: entry.wife.reflectionNotes ?? null,
    raw_entry_json: {
      reflection: entry.wife,
      entryId: entry.id,
      weekNumber: entry.weekNumber,
      loggedAt: entry.loggedAt,
      coupleCelebrationNotes: entry.coupleCelebrationNotes,
      totalHouseholdDriftReclaimedHours: entry.totalHouseholdDriftReclaimedHours,
      totalHouseholdExtraCashflowPln: entry.totalHouseholdExtraCashflowPln,
    },
    updated_at: new Date().toISOString(),
  };

  return [meRow, wifeRow];
}

interface RawWeeklyJsonPayload {
  reflection?: PartnerWeeklyReflection;
  entryId?: string;
  weekNumber?: number;
  loggedAt?: string;
  coupleCelebrationNotes?: string;
  totalHouseholdDriftReclaimedHours?: number;
  totalHouseholdExtraCashflowPln?: number;
}

export function rowsToWeeklyCheckInEntry(rows: TimeValueWeeklyLogRow[]): WeeklyCheckInEntry | null {
  if (rows.length === 0) return null;
  const weekStartDate = rows[0].week_start_date;
  const meRow = rows.find((r) => r.player === "me");
  const wifeRow = rows.find((r) => r.player === "wife");

  const mePayload = parseJsonSafe<RawWeeklyJsonPayload>(meRow?.raw_entry_json, {});
  const wifePayload = parseJsonSafe<RawWeeklyJsonPayload>(wifeRow?.raw_entry_json, {});

  const meReflection: PartnerWeeklyReflection = mePayload.reflection ?? {
    careHours: num(meRow?.partner_care_hours, 0),
    gamingTotalHours: num(meRow?.total_screen_hours, 0),
    gamingJoyHours: num(meRow?.joyful_hours, 0),
    socialTotalHours: 0,
    socialJoyHours: 0,
    actualSideHustleHours: num(meRow?.side_hustle_hours, 0),
    actualLearningHours: num(meRow?.learning_hours, 0),
    actualRelaxHours: num(meRow?.proper_relax_hours, 0),
    reflectionNotes: meRow?.reflections ?? undefined,
  };

  const wifeReflection: PartnerWeeklyReflection = wifePayload.reflection ?? {
    careHours: num(wifeRow?.partner_care_hours, 0),
    gamingTotalHours: num(wifeRow?.total_screen_hours, 0),
    gamingJoyHours: num(wifeRow?.joyful_hours, 0),
    socialTotalHours: 0,
    socialJoyHours: 0,
    actualSideHustleHours: num(wifeRow?.side_hustle_hours, 0),
    actualLearningHours: num(wifeRow?.learning_hours, 0),
    actualRelaxHours: num(wifeRow?.proper_relax_hours, 0),
    reflectionNotes: wifeRow?.reflections ?? undefined,
  };

  const id = mePayload.entryId ?? wifePayload.entryId ?? `weekly-log-${weekStartDate}`;
  const loggedAt = mePayload.loggedAt ?? wifePayload.loggedAt ?? meRow?.created_at ?? new Date().toISOString();
  const coupleCelebrationNotes = mePayload.coupleCelebrationNotes ?? wifePayload.coupleCelebrationNotes ?? undefined;
  const weekNumber = mePayload.weekNumber ?? wifePayload.weekNumber;

  const totalHouseholdDriftReclaimedHours =
    mePayload.totalHouseholdDriftReclaimedHours ??
    wifePayload.totalHouseholdDriftReclaimedHours ??
    num(meRow?.reclaimed_hours, 0) + num(wifeRow?.reclaimed_hours, 0);

  const totalHouseholdExtraCashflowPln =
    mePayload.totalHouseholdExtraCashflowPln ?? wifePayload.totalHouseholdExtraCashflowPln ?? 0;

  return {
    id,
    weekStartDate,
    weekNumber,
    loggedAt,
    me: meReflection,
    wife: wifeReflection,
    coupleCelebrationNotes,
    totalHouseholdDriftReclaimedHours,
    totalHouseholdExtraCashflowPln,
  };
}

export function groupRowsToWeeklyEntries(rows: TimeValueWeeklyLogRow[]): WeeklyCheckInEntry[] {
  const byDate = new Map<string, TimeValueWeeklyLogRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.week_start_date) ?? [];
    list.push(row);
    byDate.set(row.week_start_date, list);
  }

  const entries: WeeklyCheckInEntry[] = [];
  for (const dateRows of byDate.values()) {
    const entry = rowsToWeeklyCheckInEntry(dateRows);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
}

export interface TimeValueStore {
  loadConfig(): Promise<TimeValueMotivatorConfig | null>;
  saveConfig(config: TimeValueMotivatorConfig): Promise<TimeValueMotivatorConfig>;
  upsertWeeklyLog(entry: WeeklyCheckInEntry): Promise<WeeklyCheckInEntry>;
  deleteWeeklyLog(weekStartDate: string): Promise<boolean>;
  listWeeklyLogs(): Promise<WeeklyCheckInEntry[]>;
  upsertGoal(goal: PersonalGoal): Promise<PersonalGoal>;
  deleteGoal(id: string): Promise<boolean>;
  listGoals(): Promise<PersonalGoal[]>;
}

export class InMemoryTimeValueStore implements TimeValueStore {
  private profiles = new Map<"me" | "wife", TimeValueProfileRow>();
  private goals = new Map<string, TimeValueGoalRow>();
  private weeklyLogs = new Map<string, TimeValueWeeklyLogRow[]>(); // keyed by week_start_date

  async loadConfig(): Promise<TimeValueMotivatorConfig | null> {
    if (this.profiles.size === 0 && this.goals.size === 0 && this.weeklyLogs.size === 0) {
      return null;
    }

    const defaults = getDefaultTimeValueConfig();
    const meRow = this.profiles.get("me");
    const wifeRow = this.profiles.get("wife");

    const meProfile = meRow ? parseJsonSafe<PrimaryPlayerProfile>(meRow.raw_profile_json, defaults.me) : defaults.me;
    const wifeProfile = wifeRow
      ? parseJsonSafe<SpousePlayerProfile>(wifeRow.raw_profile_json, defaults.wife)
      : defaults.wife;

    const petProjects = wifeRow
      ? parseJsonSafe<FamilyPetProject[]>(wifeRow.pet_projects_json, defaults.petProjects)
      : meRow
        ? parseJsonSafe<FamilyPetProject[]>(meRow.pet_projects_json, defaults.petProjects)
        : defaults.petProjects;

    const learningProjectedRateGrowthPct = meRow
      ? num(meRow.learning_rate_growth_pct, defaults.learningProjectedRateGrowthPct)
      : defaults.learningProjectedRateGrowthPct;

    const goalsList = Array.from(this.goals.values()).map(goalRowToDomain);
    const allWeeklyRows = Array.from(this.weeklyLogs.values()).flat();
    const weeklyEntries = groupRowsToWeeklyEntries(allWeeklyRows);

    return {
      me: { ...defaults.me, ...meProfile },
      wife: { ...defaults.wife, ...wifeProfile },
      petProjects: Array.isArray(petProjects) ? petProjects : defaults.petProjects,
      personalGoals: goalsList.length > 0 ? goalsList : defaults.personalGoals,
      weeklyLogs: weeklyEntries.length > 0 ? weeklyEntries : defaults.weeklyLogs,
      learningProjectedRateGrowthPct,
    };
  }

  async saveConfig(config: TimeValueMotivatorConfig): Promise<TimeValueMotivatorConfig> {
    // Profiles
    const meRow: TimeValueProfileRow = {
      player: "me",
      target_hourly_rate_pln: config.me.monetization.manualRatePln,
      daily_drift_target_hours: 1.0,
      learning_rate_growth_pct: config.learningProjectedRateGrowthPct,
      raw_profile_json: config.me,
      pet_projects_json: config.petProjects,
      updated_at: new Date().toISOString(),
    };
    const wifeRow: TimeValueProfileRow = {
      player: "wife",
      target_hourly_rate_pln: config.wife.opportunity.freelance.hourlyRatePln,
      daily_drift_target_hours: 1.0,
      learning_rate_growth_pct: config.learningProjectedRateGrowthPct,
      raw_profile_json: config.wife,
      pet_projects_json: config.petProjects,
      updated_at: new Date().toISOString(),
    };
    this.profiles.set("me", meRow);
    this.profiles.set("wife", wifeRow);

    // Goals
    for (const goal of config.personalGoals) {
      const row = domainToGoalRow(goal);
      this.goals.set(row.id, row);
    }

    // Weekly Logs
    for (const entry of config.weeklyLogs) {
      const rows = checkInEntryToRows(entry);
      this.weeklyLogs.set(entry.weekStartDate, rows);
    }

    return structuredClone(config);
  }

  async upsertWeeklyLog(entry: WeeklyCheckInEntry): Promise<WeeklyCheckInEntry> {
    const rows = checkInEntryToRows(entry);
    this.weeklyLogs.set(entry.weekStartDate, rows);
    return structuredClone(entry);
  }

  async deleteWeeklyLog(weekStartDate: string): Promise<boolean> {
    return this.weeklyLogs.delete(weekStartDate);
  }

  async listWeeklyLogs(): Promise<WeeklyCheckInEntry[]> {
    const all = Array.from(this.weeklyLogs.values()).flat();
    return groupRowsToWeeklyEntries(all);
  }

  async upsertGoal(goal: PersonalGoal): Promise<PersonalGoal> {
    const row = domainToGoalRow(goal);
    this.goals.set(row.id, row);
    return goalRowToDomain(row);
  }

  async deleteGoal(id: string): Promise<boolean> {
    return this.goals.delete(id);
  }

  async listGoals(): Promise<PersonalGoal[]> {
    return Array.from(this.goals.values()).map(goalRowToDomain);
  }
}

export class SupabaseRestTimeValueStore implements TimeValueStore {
  private url: string;
  private key: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.url = supabaseUrl.replace(/\/+$/, "");
    this.key = serviceRoleKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: this.key,
        ...(!this.key.startsWith("sb_") ? { Authorization: `Bearer ${this.key}` } : {}),
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase REST error (${res.status} ${res.statusText}): ${text}`);
    }

    if (res.status === 204) {
      return null as T;
    }
    return (await res.json()) as T;
  }

  async loadConfig(): Promise<TimeValueMotivatorConfig | null> {
    const [profiles, goals, weeklyLogs] = await Promise.all([
      this.request<TimeValueProfileRow[]>("/time_value_profiles?select=*"),
      this.request<TimeValueGoalRow[]>("/time_value_goals?select=*&order=created_at.asc"),
      this.request<TimeValueWeeklyLogRow[]>("/time_value_weekly_logs?select=*&order=week_start_date.desc"),
    ]);

    if (
      (!profiles || profiles.length === 0) &&
      (!goals || goals.length === 0) &&
      (!weeklyLogs || weeklyLogs.length === 0)
    ) {
      return null;
    }

    const defaults = getDefaultTimeValueConfig();
    const meRow = profiles?.find((p) => p.player === "me");
    const wifeRow = profiles?.find((p) => p.player === "wife");

    const meProfile = meRow ? parseJsonSafe<PrimaryPlayerProfile>(meRow.raw_profile_json, defaults.me) : defaults.me;
    const wifeProfile = wifeRow
      ? parseJsonSafe<SpousePlayerProfile>(wifeRow.raw_profile_json, defaults.wife)
      : defaults.wife;

    const petProjects = wifeRow
      ? parseJsonSafe<FamilyPetProject[]>(wifeRow.pet_projects_json, defaults.petProjects)
      : meRow
        ? parseJsonSafe<FamilyPetProject[]>(meRow.pet_projects_json, defaults.petProjects)
        : defaults.petProjects;

    const learningProjectedRateGrowthPct = meRow
      ? num(meRow.learning_rate_growth_pct, defaults.learningProjectedRateGrowthPct)
      : defaults.learningProjectedRateGrowthPct;

    const personalGoals = goals && goals.length > 0 ? goals.map(goalRowToDomain) : defaults.personalGoals;
    const weeklyEntries =
      weeklyLogs && weeklyLogs.length > 0 ? groupRowsToWeeklyEntries(weeklyLogs) : defaults.weeklyLogs;

    return {
      me: { ...defaults.me, ...meProfile },
      wife: { ...defaults.wife, ...wifeProfile },
      petProjects: Array.isArray(petProjects) ? petProjects : defaults.petProjects,
      personalGoals,
      weeklyLogs: weeklyEntries,
      learningProjectedRateGrowthPct,
    };
  }

  async saveConfig(config: TimeValueMotivatorConfig): Promise<TimeValueMotivatorConfig> {
    const meRow: TimeValueProfileRow = {
      player: "me",
      target_hourly_rate_pln: config.me.monetization.manualRatePln,
      daily_drift_target_hours: 1.0,
      learning_rate_growth_pct: config.learningProjectedRateGrowthPct,
      raw_profile_json: config.me,
      pet_projects_json: config.petProjects,
      updated_at: new Date().toISOString(),
    };

    const wifeRow: TimeValueProfileRow = {
      player: "wife",
      target_hourly_rate_pln: config.wife.opportunity.freelance.hourlyRatePln,
      daily_drift_target_hours: 1.0,
      learning_rate_growth_pct: config.learningProjectedRateGrowthPct,
      raw_profile_json: config.wife,
      pet_projects_json: config.petProjects,
      updated_at: new Date().toISOString(),
    };

    // Upsert profiles
    await this.request("/time_value_profiles?on_conflict=player", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([meRow, wifeRow]),
    });

    // Upsert goals if any
    if (config.personalGoals.length > 0) {
      const goalRows = config.personalGoals.map(domainToGoalRow);
      await this.request("/time_value_goals?on_conflict=id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(goalRows),
      });
    }

    // Upsert weekly logs
    if (config.weeklyLogs.length > 0) {
      const allRows = config.weeklyLogs.flatMap(checkInEntryToRows);
      await this.request("/time_value_weekly_logs?on_conflict=player,week_start_date", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(allRows),
      });
    }

    return structuredClone(config);
  }

  async upsertWeeklyLog(entry: WeeklyCheckInEntry): Promise<WeeklyCheckInEntry> {
    const rows = checkInEntryToRows(entry);
    await this.request("/time_value_weekly_logs?on_conflict=player,week_start_date", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
    return structuredClone(entry);
  }

  async deleteWeeklyLog(weekStartDate: string): Promise<boolean> {
    await this.request(`/time_value_weekly_logs?week_start_date=eq.${encodeURIComponent(weekStartDate)}`, {
      method: "DELETE",
    });
    return true;
  }

  async listWeeklyLogs(): Promise<WeeklyCheckInEntry[]> {
    const rows = await this.request<TimeValueWeeklyLogRow[]>(
      "/time_value_weekly_logs?select=*&order=week_start_date.desc",
    );
    if (!rows || !Array.isArray(rows)) return [];
    return groupRowsToWeeklyEntries(rows);
  }

  async upsertGoal(goal: PersonalGoal): Promise<PersonalGoal> {
    const row = domainToGoalRow(goal);
    await this.request("/time_value_goals?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([row]),
    });
    return goalRowToDomain(row);
  }

  async deleteGoal(id: string): Promise<boolean> {
    await this.request(`/time_value_goals?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return true;
  }

  async listGoals(): Promise<PersonalGoal[]> {
    const rows = await this.request<TimeValueGoalRow[]>("/time_value_goals?select=*&order=created_at.asc");
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(goalRowToDomain);
  }
}

let activeTimeValueStore: TimeValueStore | null = null;
let activeTimeValueStoreKey: string | null = null;

export function getTimeValueStore(): TimeValueStore {
  const creds = resolveSupabaseCredentials();
  const currentKey = creds ? `remote:${creds.url}` : "in-memory";

  if (activeTimeValueStore && (activeTimeValueStoreKey === currentKey || activeTimeValueStoreKey === "test")) {
    return activeTimeValueStore;
  }

  if (creds) {
    activeTimeValueStore = new SupabaseRestTimeValueStore(creds.url, creds.key);
  } else {
    activeTimeValueStore = new InMemoryTimeValueStore();
  }

  activeTimeValueStoreKey = currentKey;
  return activeTimeValueStore;
}

export function setTestTimeValueStore(store: TimeValueStore | null): void {
  activeTimeValueStore = store;
  activeTimeValueStoreKey = store ? "test" : null;
}
