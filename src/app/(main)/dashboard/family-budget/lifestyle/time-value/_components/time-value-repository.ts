/**
 * Time & Opportunity Motivator LocalStorage & Supabase Repository
 *
 * Persists dual-player profiles, screen time reflections, pet projects,
 * personal goals, and weekly logs under `family-budget:time-value-motivator:v1`,
 * with asynchronous cloud sync and auto-migration to Supabase PostgreSQL.
 */

import {
  type CloudSyncStatus,
  type ConflictRecord,
  type ConflictResolutionChoice,
  reconcileEntities,
  reconcileSingleRecord,
} from "@/lib/cloud-sync-reconciler";

import {
  type PersonalGoal,
  TIME_VALUE_STORAGE_KEY,
  type TimeValueMotivatorConfig,
  type TimeValueStoragePayload,
  type WeeklyCheckInEntry,
} from "./time-value-types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getDefaultTimeValueConfig(): TimeValueMotivatorConfig {
  return {
    me: {
      id: "me",
      displayName: "Me",
      device: {
        primaryPhone: "Pixel 9 Pro",
        gamingPlatform: "PC / Console",
        favoriteApps: ["Steam", "Discord", "YouTube"],
      },
      care: {
        careHoursPerWeek: 5,
        referenceHourlyRatePln: 40,
        celebrationTitle: "Household Support & Tech Operations",
      },
      screenTime: {
        gamingTotalHours: 8,
        gamingJoyHours: 5,
        socialTotalHours: 4,
        socialJoyHours: 2,
      },
      reallocation: {
        sideHustleHours: 3,
        learningHours: 1.5,
        properRelaxHours: 0.5,
        focusEfficiencyPct: 75,
      },
      monetization: {
        rateSource: "offer_sync",
        manualRatePln: 150,
        annualDaysOffPool: 39,
        sacredUnplugDays: 32,
        monetizedDaysOff: 7,
        hoursPerDayOff: 8,
      },
    },
    wife: {
      id: "wife",
      displayName: "My Wife",
      device: {
        primaryPhone: "Galaxy S24",
        gamingPlatform: "Mobile & Gaming",
        favoriteApps: ["Instagram", "Threads", "Mobile Games"],
      },
      care: {
        careHoursPerWeek: 25,
        referenceHourlyRatePln: 40,
        celebrationTitle: "Foundational Household Pillar & Emotional Anchor",
      },
      screenTime: {
        gamingTotalHours: 8,
        gamingJoyHours: 4,
        socialTotalHours: 6,
        socialJoyHours: 3,
      },
      reallocation: {
        sideHustleHours: 4,
        learningHours: 2,
        properRelaxHours: 1,
        focusEfficiencyPct: 75,
      },
      opportunity: {
        freelance: {
          enabled: true,
          hourlyRatePln: 80,
          activeServicesDescription: "Creative, tutoring & freelance client tasks",
        },
        petProjectsEnabled: true,
      },
    },
    petProjects: [
      {
        id: "pet-meal-pantry",
        title: "Meal Planning & Pantry Optimization",
        description: "Standardizes weekly grocery list and reduces takeout spend.",
        status: "active",
        allocatedHoursPerWeek: 3,
        monthlyExpenseSavedPln: 350,
        weeklyHouseholdHoursSaved: 2,
        hoursSavedValuedAtPln: 40,
        projectedLaunchMonthlyIncomePln: 0,
        milestoneBountyPln: 1000,
        milestoneCompleted: false,
        createdAt: "2026-01-15T00:00:00.000Z",
      },
      {
        id: "pet-family-archive",
        title: "Family Digital Archives & Photo Curation",
        description: "Consolidates media across phones and downsizes redundant cloud storage.",
        status: "active",
        allocatedHoursPerWeek: 2,
        monthlyExpenseSavedPln: 80,
        weeklyHouseholdHoursSaved: 1,
        hoursSavedValuedAtPln: 40,
        projectedLaunchMonthlyIncomePln: 0,
        milestoneBountyPln: 800,
        milestoneCompleted: true,
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ],
    personalGoals: [
      {
        id: "goal-wife-rome-spa",
        title: "Rome Weekend & Wellness Spa",
        category: "travel",
        targetAmountPln: 4500,
        currentSavedPln: 1500,
        owner: "wife",
        notes: "Funded via spouse freelancing and completed pet project bounties.",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "goal-shared-espresso",
        title: "Home Espresso Machine & Barista Station",
        category: "home",
        targetAmountPln: 3500,
        currentSavedPln: 1800,
        owner: "shared",
        notes: "Shared coffee enjoyment for both of us.",
        createdAt: "2026-01-10T00:00:00.000Z",
      },
      {
        id: "goal-me-ultrawide",
        title: "Ultra-Wide Workstation Display",
        category: "tech",
        targetAmountPln: 2800,
        currentSavedPln: 1200,
        owner: "me",
        notes: "Work and gaming productivity upgrade.",
        createdAt: "2026-01-12T00:00:00.000Z",
      },
    ],
    weeklyLogs: [
      {
        id: "log-seed-week-1",
        weekStartDate: "2026-10-26",
        weekNumber: 43,
        loggedAt: "2026-11-01T20:00:00.000Z",
        me: {
          careHours: 5,
          gamingTotalHours: 7,
          gamingJoyHours: 5,
          socialTotalHours: 3,
          socialJoyHours: 2,
          actualSideHustleHours: 2.5,
          actualLearningHours: 1.5,
          actualRelaxHours: 1,
          reflectionNotes: "Recharged with console co-op and finished a TypeScript module.",
        },
        wife: {
          careHours: 25,
          gamingTotalHours: 6,
          gamingJoyHours: 4,
          socialTotalHours: 5,
          socialJoyHours: 3,
          actualSideHustleHours: 3,
          actualLearningHours: 2,
          actualRelaxHours: 1.5,
          reflectionNotes: "Enjoyed mobile gaming without guilt, completed pantry inventory.",
        },
        coupleCelebrationNotes: "Great week of shared balance and quality downtime!",
        totalHouseholdDriftReclaimedHours: 6.5,
        totalHouseholdExtraCashflowPln: 2200,
      },
    ],
    learningProjectedRateGrowthPct: 5,
  };
}

export class TimeValueRepository {
  private readonly storageKey: string;
  private readonly storage: StorageLike | null = null;
  private readonly fetchFn: typeof fetch;
  private memoryConfig: TimeValueMotivatorConfig | null = null;
  private pendingConflict: ConflictRecord<TimeValueMotivatorConfig> | null = null;

  constructor(storageKey = TIME_VALUE_STORAGE_KEY, customStorage?: StorageLike, customFetch?: typeof fetch) {
    this.storageKey = storageKey;
    if (customStorage) {
      this.storage = customStorage;
    } else if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
    this.fetchFn = customFetch ?? ((...args) => fetch(...args));
  }

  public loadConfig(): TimeValueMotivatorConfig {
    if (this.storage) {
      try {
        const raw = this.storage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as TimeValueStoragePayload | null;
          if (parsed?.version === 1 && parsed.config) {
            const defaults = getDefaultTimeValueConfig();
            return {
              ...defaults,
              ...parsed.config,
              me: {
                ...defaults.me,
                ...parsed.config.me,
                device: { ...defaults.me.device, ...parsed.config.me?.device },
                care: { ...defaults.me.care, ...parsed.config.me?.care },
                screenTime: { ...defaults.me.screenTime, ...parsed.config.me?.screenTime },
                reallocation: { ...defaults.me.reallocation, ...parsed.config.me?.reallocation },
                monetization: { ...defaults.me.monetization, ...parsed.config.me?.monetization },
              },
              wife: {
                ...defaults.wife,
                ...parsed.config.wife,
                device: { ...defaults.wife.device, ...parsed.config.wife?.device },
                care: { ...defaults.wife.care, ...parsed.config.wife?.care },
                screenTime: { ...defaults.wife.screenTime, ...parsed.config.wife?.screenTime },
                reallocation: { ...defaults.wife.reallocation, ...parsed.config.wife?.reallocation },
                opportunity: {
                  ...defaults.wife.opportunity,
                  ...parsed.config.wife.opportunity,
                  freelance: {
                    ...defaults.wife.opportunity.freelance,
                    ...parsed.config.wife.opportunity?.freelance,
                  },
                },
              },
              petProjects: Array.isArray(parsed.config.petProjects) ? parsed.config.petProjects : defaults.petProjects,
              personalGoals: Array.isArray(parsed.config.personalGoals)
                ? parsed.config.personalGoals
                : defaults.personalGoals,
              weeklyLogs: Array.isArray(parsed.config.weeklyLogs) ? parsed.config.weeklyLogs : defaults.weeklyLogs,
            };
          }
        }
      } catch (err) {
        console.warn("Failed to load time value config from storage, using defaults:", err);
      }
    }

    if (this.memoryConfig) {
      return this.memoryConfig;
    }

    const initial = getDefaultTimeValueConfig();
    this.memoryConfig = initial;
    return initial;
  }

  public saveConfig(config: TimeValueMotivatorConfig): void {
    const preparedConfig: TimeValueMotivatorConfig = {
      ...config,
      updatedAt: config.updatedAt ?? new Date().toISOString(),
    };
    this.memoryConfig = preparedConfig;
    if (this.storage) {
      try {
        const payload: TimeValueStoragePayload = {
          version: 1,
          config: preparedConfig,
          exportedAt: new Date().toISOString(),
          updatedAt: preparedConfig.updatedAt,
        };
        this.storage.setItem(this.storageKey, JSON.stringify(payload));
      } catch (err) {
        console.error("Failed to save time value config to storage:", err);
      }
    }
  }

  public hasLocalData(): boolean {
    if (!this.storage) return false;
    try {
      return this.storage.getItem(this.storageKey) !== null;
    } catch {
      return false;
    }
  }

  public getLastSyncedAt(): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(`${this.storageKey}:lastSyncedAt`);
    } catch {
      return null;
    }
  }

  public setLastSyncedAt(timestamp: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(`${this.storageKey}:lastSyncedAt`, timestamp);
    } catch {
      // Ignore
    }
  }

  public getPendingConflict(): ConflictRecord<TimeValueMotivatorConfig> | null {
    return this.pendingConflict;
  }

  public addWeeklyCheckIn(entry: WeeklyCheckInEntry): TimeValueMotivatorConfig {
    const current = this.loadConfig();
    const updatedLogs = [
      entry,
      ...current.weeklyLogs.filter((log) => log.id !== entry.id && log.weekStartDate !== entry.weekStartDate),
    ];
    const updated = { ...current, weeklyLogs: updatedLogs, updatedAt: new Date().toISOString() };
    this.saveConfig(updated);
    return updated;
  }

  public exportJson(config: TimeValueMotivatorConfig): string {
    const payload: TimeValueStoragePayload = {
      version: 1,
      config,
      exportedAt: new Date().toISOString(),
      updatedAt: config.updatedAt ?? new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  }

  public importJson(jsonString: string): TimeValueMotivatorConfig {
    const parsed = JSON.parse(jsonString) as TimeValueStoragePayload | null;
    if (parsed?.version !== 1 || !parsed.config) {
      throw new Error("Invalid Time & Opportunity export file format. Expected version 1 payload.");
    }
    const defaults = getDefaultTimeValueConfig();
    const merged: TimeValueMotivatorConfig = {
      ...defaults,
      ...parsed.config,
      me: {
        ...defaults.me,
        ...parsed.config.me,
      },
      wife: {
        ...defaults.wife,
        ...parsed.config.wife,
      },
      petProjects: Array.isArray(parsed.config.petProjects) ? parsed.config.petProjects : defaults.petProjects,
      personalGoals: Array.isArray(parsed.config.personalGoals) ? parsed.config.personalGoals : defaults.personalGoals,
      weeklyLogs: Array.isArray(parsed.config.weeklyLogs) ? parsed.config.weeklyLogs : defaults.weeklyLogs,
      updatedAt: new Date().toISOString(),
    };
    this.saveConfig(merged);
    return merged;
  }

  public resetToDefaults(): TimeValueMotivatorConfig {
    const defaults = getDefaultTimeValueConfig();
    this.saveConfig(defaults);
    return defaults;
  }

  // =========================================================================
  // Asynchronous Cloud Synchronization & Auto-Migration (Supabase)
  // =========================================================================

  /**
   * Fetches configuration from Supabase and applies reconciliation:
   * - Auto-replays offline check-in logs and personal goals.
   * - Detects concurrent conflicting edits and halts silent local overwrites.
   * - Gracefully falls back to local cache if offline or on network error.
   */
  public async fetchRemoteConfig(signal?: AbortSignal): Promise<{
    config: TimeValueMotivatorConfig;
    isOfflineFallback?: boolean;
    wasAutoMigrated?: boolean;
    conflicts?: ConflictRecord<any>[];
    status?: CloudSyncStatus;
  }> {
    try {
      const res = await this.fetchFn("/api/family-budget/time-value", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch time value config: HTTP ${res.status}`);
      }

      const data = await res.json();
      const remoteConfig: TimeValueMotivatorConfig | null = data.config ?? null;

      // Auto-migration: if remote database is empty, seed it with the current local config
      if (!remoteConfig) {
        const localConfig = this.loadConfig();
        await this.saveRemoteConfig(localConfig);
        this.setLastSyncedAt(new Date().toISOString());
        return {
          config: localConfig,
          wasAutoMigrated: true,
          conflicts: [],
          status: "synced",
        };
      }

      // If local storage has no existing data (first load on this device), adopt remote
      if (!this.hasLocalData()) {
        this.saveConfig(remoteConfig);
        this.setLastSyncedAt(new Date().toISOString());
        return {
          config: remoteConfig,
          isOfflineFallback: false,
          conflicts: [],
          status: "synced",
        };
      }

      const localConfig = this.loadConfig();

      // 1. Reconcile weekly check-in logs with auto-replay for offline-* entries
      const logsReconcile = await reconcileEntities<WeeklyCheckInEntry>({
        localEntities: localConfig.weeklyLogs,
        remoteEntities: remoteConfig.weeklyLogs,
        lastSyncedAt: this.getLastSyncedAt(),
        uploadOfflineEntity: async (entry) => {
          const serverId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const prepared = { ...entry, id: serverId };
          await this.fetchFn("/api/family-budget/time-value", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "upsert_log", entry: prepared }),
          });
          return prepared;
        },
        getEntityName: (entry) => `Week ${entry.weekNumber ?? ""} (${entry.weekStartDate})`,
      });

      // 2. Reconcile personal goals with auto-replay for offline-* entries
      const goalsReconcile = await reconcileEntities<PersonalGoal>({
        localEntities: localConfig.personalGoals,
        remoteEntities: remoteConfig.personalGoals,
        lastSyncedAt: this.getLastSyncedAt(),
        uploadOfflineEntity: async (goal) => {
          const serverId = `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const prepared = { ...goal, id: serverId };
          await this.fetchFn("/api/family-budget/time-value", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "upsert_goal", goal: prepared }),
          });
          return prepared;
        },
        getEntityName: (goal) => goal.title,
      });

      // 3. Reconcile profile & monetization configuration
      const configReconcile = await reconcileSingleRecord<TimeValueMotivatorConfig>({
        entityId: "time-value-config",
        entityName: "Time & Opportunity Motivator Configuration",
        localRecord: localConfig,
        remoteRecord: remoteConfig,
        localUpdatedAt: localConfig.updatedAt,
        remoteUpdatedAt: remoteConfig.updatedAt,
        lastSyncedAt: this.getLastSyncedAt(),
        ignoreEqualityKeys: ["weeklyLogs", "personalGoals", "updatedAt", "exportedAt"],
      });

      const allConflicts = [
        ...logsReconcile.conflicts,
        ...goalsReconcile.conflicts,
        ...(configReconcile.conflict ? [configReconcile.conflict] : []),
      ];

      if (allConflicts.length > 0) {
        this.pendingConflict =
          configReconcile.conflict ?? (allConflicts[0] as unknown as ConflictRecord<TimeValueMotivatorConfig>);
        return {
          config: localConfig,
          isOfflineFallback: false,
          conflicts: allConflicts,
          status: "conflict",
        };
      }

      const mergedConfig: TimeValueMotivatorConfig = {
        ...configReconcile.resolvedRecord,
        weeklyLogs: logsReconcile.mergedEntities,
        personalGoals: goalsReconcile.mergedEntities,
        updatedAt: new Date().toISOString(),
      };

      this.saveConfig(mergedConfig);
      this.setLastSyncedAt(new Date().toISOString());
      this.pendingConflict = null;

      // If offline items were replayed, push updated complete config to remote
      if (Object.keys(logsReconcile.replayedIds).length > 0 || Object.keys(goalsReconcile.replayedIds).length > 0) {
        try {
          await this.fetchFn("/api/family-budget/time-value", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save_config", config: mergedConfig }),
          });
        } catch {
          // Non-fatal
        }
      }

      return {
        config: mergedConfig,
        isOfflineFallback: false,
        conflicts: [],
        status: "synced",
      };
    } catch (_err) {
      // Offline fallback: load from localStorage
      const local = this.loadConfig();
      return {
        config: local,
        isOfflineFallback: true,
        conflicts: [],
        status: "offline",
      };
    }
  }

  /**
   * Saves configuration remotely to Supabase, updating local storage cache.
   */
  public async saveRemoteConfig(config: TimeValueMotivatorConfig): Promise<TimeValueMotivatorConfig> {
    const preparedConfig: TimeValueMotivatorConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    this.saveConfig(preparedConfig);
    try {
      const res = await this.fetchFn("/api/family-budget/time-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", config: preparedConfig }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save config remotely: HTTP ${res.status}`);
      }

      const data = await res.json();
      const saved: TimeValueMotivatorConfig = data.config ?? preparedConfig;
      this.saveConfig(saved);
      this.setLastSyncedAt(new Date().toISOString());
      this.pendingConflict = null;
      return saved;
    } catch (err) {
      console.warn("Could not sync time value config remotely, cached locally:", err);
      return preparedConfig;
    }
  }

  /**
   * Resolves a conflict between local and remote versions.
   */
  public async resolveConflict(
    conflict: ConflictRecord<any>,
    choice: ConflictResolutionChoice,
  ): Promise<TimeValueMotivatorConfig> {
    const current = this.loadConfig();
    let resolved: TimeValueMotivatorConfig;

    if (conflict.entityId === "time-value-config") {
      resolved = choice === "keep_local" ? conflict.localVersion : conflict.remoteVersion;
    } else if (current.weeklyLogs.some((l) => l.id === conflict.entityId)) {
      const chosenLog = choice === "keep_local" ? conflict.localVersion : conflict.remoteVersion;
      resolved = {
        ...current,
        weeklyLogs: current.weeklyLogs.map((l) => (l.id === conflict.entityId ? chosenLog : l)),
      };
    } else if (current.personalGoals.some((g) => g.id === conflict.entityId)) {
      const chosenGoal = choice === "keep_local" ? conflict.localVersion : conflict.remoteVersion;
      resolved = {
        ...current,
        personalGoals: current.personalGoals.map((g) => (g.id === conflict.entityId ? chosenGoal : g)),
      };
    } else {
      resolved = choice === "keep_local" ? conflict.localVersion : conflict.remoteVersion;
    }

    resolved.updatedAt = new Date().toISOString();
    if (choice === "keep_local") {
      await this.saveRemoteConfig(resolved);
    } else {
      this.saveConfig(resolved);
    }
    this.setLastSyncedAt(new Date().toISOString());
    this.pendingConflict = null;
    return resolved;
  }

  /**
   * Adds or updates a weekly check-in entry remotely and locally.
   */
  public async addRemoteWeeklyCheckIn(entry: WeeklyCheckInEntry): Promise<TimeValueMotivatorConfig> {
    const updatedLocal = this.addWeeklyCheckIn(entry);
    try {
      const res = await this.fetchFn("/api/family-budget/time-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_log", entry }),
      });

      if (!res.ok) {
        throw new Error(`Failed to upsert weekly log remotely: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("Could not sync weekly log remotely, cached locally:", err);
    }
    return updatedLocal;
  }

  /**
   * Upserts a personal goal remotely and locally.
   */
  public async saveRemoteGoal(goal: PersonalGoal): Promise<TimeValueMotivatorConfig> {
    const current = this.loadConfig();
    const existingIndex = current.personalGoals.findIndex((g) => g.id === goal.id);
    const updatedGoals =
      existingIndex >= 0
        ? current.personalGoals.map((g) => (g.id === goal.id ? goal : g))
        : [...current.personalGoals, goal];

    const updatedConfig = { ...current, personalGoals: updatedGoals };
    this.saveConfig(updatedConfig);

    try {
      const res = await this.fetchFn("/api/family-budget/time-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_goal", goal }),
      });

      if (!res.ok) {
        throw new Error(`Failed to upsert goal remotely: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("Could not sync goal remotely, cached locally:", err);
    }

    return updatedConfig;
  }

  /**
   * Deletes a personal goal remotely and locally.
   */
  public async deleteRemoteGoal(goalId: string): Promise<TimeValueMotivatorConfig> {
    const current = this.loadConfig();
    const updatedGoals = current.personalGoals.filter((g) => g.id !== goalId);
    const updatedConfig = { ...current, personalGoals: updatedGoals };
    this.saveConfig(updatedConfig);

    try {
      const res = await this.fetchFn(`/api/family-budget/time-value?goalId=${encodeURIComponent(goalId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete goal remotely: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("Could not delete goal remotely, removed locally:", err);
    }

    return updatedConfig;
  }
}
