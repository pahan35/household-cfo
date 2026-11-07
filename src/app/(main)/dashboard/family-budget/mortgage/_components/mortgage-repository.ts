import {
  type CloudSyncStatus,
  type ConflictRecord,
  type ConflictResolutionChoice,
  reconcileEntities,
} from "@/lib/cloud-sync-reconciler";

import {
  DEFAULT_HOME_GOAL_TRACKING_CONFIG,
  DEFAULT_MORTGAGE_FINANCING_CONFIG,
  DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
  DEFAULT_OVERLAP_TIMELINE_CONFIG,
  DEFAULT_PROPERTY_ACQUISITION_CONFIG,
} from "./mortgage-engine";
import type { MortgageScenario, MortgageSimulatorConfig, MortgageSimulatorStoragePayload } from "./mortgage-types";

export const MORTGAGE_STORAGE_KEY = "family-budget:mortgage-simulator:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function sanitizeConfig(raw?: Partial<MortgageSimulatorConfig> | null): MortgageSimulatorConfig {
  if (!raw) return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;

  return {
    property: {
      ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
      ...raw.property,
    },
    financing: {
      ...DEFAULT_MORTGAGE_FINANCING_CONFIG,
      ...raw.financing,
    },
    overlap: {
      ...DEFAULT_OVERLAP_TIMELINE_CONFIG,
      ...raw.overlap,
    },
    goalTracking: {
      ...DEFAULT_HOME_GOAL_TRACKING_CONFIG,
      ...raw.goalTracking,
      linkedGoalCategoryIds: Array.isArray(raw.goalTracking?.linkedGoalCategoryIds)
        ? [...raw.goalTracking.linkedGoalCategoryIds]
        : [],
    },
  };
}

export function createDefaultScenario(id = "default-plan", name = "Primary Plan"): MortgageScenario {
  return {
    id,
    name,
    isPrimary: true,
    config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export class MortgageRepository {
  private readonly storageKey: string;
  private readonly storage: StorageLike | null = null;
  private readonly fetchFn: typeof fetch;

  constructor(storageKey = MORTGAGE_STORAGE_KEY, customStorage?: StorageLike, customFetch?: typeof fetch) {
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

  /**
   * Fast synchronous read of the active scenario's configuration.
   * Maintains backwards-compatibility with existing synchronous callers.
   */
  public loadConfig(): MortgageSimulatorConfig {
    const { scenarios, activeScenarioId } = this.loadLocalScenarios();
    const active =
      scenarios.find((s) => s.id === activeScenarioId) ?? scenarios.find((s) => s.isPrimary) ?? scenarios[0];
    return active ? active.config : DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
  }

  /**
   * Synchronously saves configuration for the active (or primary) scenario.
   */
  public saveConfig(config: MortgageSimulatorConfig): void {
    const { scenarios, activeScenarioId } = this.loadLocalScenarios();
    const targetId = activeScenarioId ?? scenarios.find((s) => s.isPrimary)?.id ?? scenarios[0]?.id;

    if (!targetId || scenarios.length === 0) {
      const initial: MortgageScenario = {
        id: "local-primary",
        name: "Primary Plan",
        isPrimary: true,
        config: sanitizeConfig(config),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.saveLocalScenarios([initial], initial.id);
      return;
    }

    const updated = scenarios.map((s) =>
      s.id === targetId
        ? {
            ...s,
            config: sanitizeConfig(config),
            updatedAt: new Date().toISOString(),
          }
        : s,
    );

    this.saveLocalScenarios(updated, targetId);
  }

  /**
   * Loads scenarios stored locally in browser localStorage.
   * Gracefully migrates v1 single-scenario payload to multi-scenario v2 format.
   */
  public loadLocalScenarios(): { scenarios: MortgageScenario[]; activeScenarioId: string | null } {
    if (!this.storage) {
      return { scenarios: [], activeScenarioId: null };
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return { scenarios: [], activeScenarioId: null };
      }

      const parsed = JSON.parse(raw) as MortgageSimulatorStoragePayload | null;
      if (!parsed) {
        return { scenarios: [], activeScenarioId: null };
      }

      // If already v2 format with scenarios array
      if (Array.isArray(parsed.scenarios)) {
        if (parsed.scenarios.length === 0) {
          return { scenarios: [], activeScenarioId: null };
        }
        const scenarios: MortgageScenario[] = parsed.scenarios.map((s) => ({
          id: s.id || `local-${Math.random().toString(36).slice(2, 9)}`,
          name: s.name || "Saved Plan",
          isPrimary: Boolean(s.isPrimary),
          config: sanitizeConfig(s.config),
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
        }));

        let activeId = parsed.activeScenarioId ?? null;
        if (!activeId || !scenarios.some((s) => s.id === activeId)) {
          const primary = scenarios.find((s) => s.isPrimary);
          activeId = primary ? primary.id : scenarios[0].id;
        }

        return { scenarios, activeScenarioId: activeId };
      }

      // Legacy v1 single-config format migration
      if (parsed.config) {
        const migrated: MortgageScenario = {
          id: "local-migrated",
          name: "Primary Plan",
          isPrimary: true,
          config: sanitizeConfig(parsed.config),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { scenarios: [migrated], activeScenarioId: migrated.id };
      }

      return { scenarios: [], activeScenarioId: null };
    } catch {
      return { scenarios: [], activeScenarioId: null };
    }
  }

  /**
   * Persists scenarios array and active scenario ID to localStorage.
   */
  public saveLocalScenarios(scenarios: MortgageScenario[], activeScenarioId?: string): void {
    if (!this.storage) return;

    try {
      const primary = scenarios.find((s) => s.isPrimary) ?? scenarios[0];
      const active = scenarios.find((s) => s.id === activeScenarioId) ?? primary;

      const payload: MortgageSimulatorStoragePayload = {
        version: 2,
        scenarios,
        activeScenarioId: active ? active.id : undefined,
        config: active ? active.config : DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      };

      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota errors in constrained environments
    }
  }

  /**
   * Resets local storage and returns default configuration.
   */
  public resetToDefaults(): MortgageSimulatorConfig {
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore removal error
      }
    }
    return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
  }

  // =========================================================================
  // Asynchronous Cloud Synchronization & Auto-Migration (Supabase)
  // =========================================================================

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
      // Ignore storage write error
    }
  }

  /**
   * Fetches scenarios from Supabase and applies reconciliation:
   * - Auto-replays offline-created scenarios (`offline-*` IDs).
   * - Detects concurrent conflicting edits and halts silent local overwrites.
   * - Cleanly updates local cache and persists synchronized state.
   */
  public async fetchRemoteScenarios(signal?: AbortSignal): Promise<{
    scenarios: MortgageScenario[];
    activeScenarioId: string;
    isOfflineFallback?: boolean;
    conflicts?: ConflictRecord<MortgageScenario>[];
    status?: CloudSyncStatus;
  }> {
    try {
      const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch scenarios: HTTP ${res.status}`);
      }

      const data = await res.json();
      const remoteScenarios: MortgageScenario[] = data.scenarios ?? [];
      const local = this.loadLocalScenarios();

      // Auto-migration: if remote database is empty, seed it with current local scenario
      if (remoteScenarios.length === 0) {
        const localConfig = this.loadConfig();
        const seeded = await this.createRemoteScenario({
          name: "Primary Plan",
          isPrimary: true,
          config: localConfig,
        });

        this.saveLocalScenarios([seeded], seeded.id);
        this.setLastSyncedAt(new Date().toISOString());
        return {
          scenarios: [seeded],
          activeScenarioId: seeded.id,
          isOfflineFallback: false,
          conflicts: [],
          status: "synced",
        };
      }

      // Reconcile local scenarios with remote scenarios
      const reconcileResult = await reconcileEntities<MortgageScenario>({
        localEntities: local.scenarios,
        remoteEntities: remoteScenarios,
        lastSyncedAt: this.getLastSyncedAt(),
        uploadOfflineEntity: async (item) => {
          return await this.createRemoteScenarioWithoutCacheUpdate({
            name: item.name,
            isPrimary: item.isPrimary,
            config: item.config,
          });
        },
        uploadModifiedEntity: async (item) => {
          return await this.updateRemoteScenarioWithoutCacheUpdate(item.id, {
            name: item.name,
            isPrimary: item.isPrimary,
            config: item.config,
          });
        },
        getEntityName: (item) => item.name,
      });

      // Map replayed offline ID to server ID for active scenario selection
      let activeId = local.activeScenarioId;
      if (activeId && reconcileResult.replayedIds[activeId]) {
        activeId = reconcileResult.replayedIds[activeId];
      }

      if (!activeId || !reconcileResult.mergedEntities.some((s) => s.id === activeId)) {
        activeId =
          reconcileResult.mergedEntities.find((s) => s.id === activeId)?.id ??
          reconcileResult.mergedEntities.find((s) => s.isPrimary)?.id ??
          reconcileResult.mergedEntities[0]?.id ??
          "";
      }

      this.saveLocalScenarios(reconcileResult.mergedEntities, activeId);

      if (reconcileResult.conflicts.length === 0) {
        this.setLastSyncedAt(new Date().toISOString());
      }

      return {
        scenarios: reconcileResult.mergedEntities,
        activeScenarioId: activeId,
        isOfflineFallback: false,
        conflicts: reconcileResult.conflicts,
        status: reconcileResult.status,
      };
    } catch (_err) {
      // Offline fallback: load from localStorage
      const local = this.loadLocalScenarios();
      const scenarios = local.scenarios.length > 0 ? local.scenarios : [createDefaultScenario()];
      return {
        scenarios,
        activeScenarioId: local.activeScenarioId ?? scenarios[0].id,
        isOfflineFallback: true,
        conflicts: [],
        status: "offline",
      };
    }
  }

  /**
   * Resolves a synchronization conflict by either pushing local draft to remote or accepting cloud version.
   */
  public async resolveConflict(
    conflict: ConflictRecord<MortgageScenario>,
    choice: ConflictResolutionChoice,
  ): Promise<MortgageScenario[]> {
    const { scenarios, activeScenarioId } = this.loadLocalScenarios();

    if (choice === "keep_local") {
      await this.updateRemoteScenario(conflict.entityId, {
        name: conflict.localVersion.name,
        isPrimary: conflict.localVersion.isPrimary,
        config: conflict.localVersion.config,
      });
      this.setLastSyncedAt(new Date().toISOString());
      return this.loadLocalScenarios().scenarios;
    }

    const updated = scenarios.map((s) => (s.id === conflict.entityId ? conflict.remoteVersion : s));
    this.saveLocalScenarios(updated, activeScenarioId ?? undefined);
    this.setLastSyncedAt(new Date().toISOString());
    return updated;
  }

  public async createRemoteScenarioWithoutCacheUpdate(input: {
    name: string;
    isPrimary?: boolean;
    config?: Partial<MortgageSimulatorConfig>;
  }): Promise<MortgageScenario> {
    const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`Failed to create scenario remotely: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.scenario;
  }

  public async updateRemoteScenarioWithoutCacheUpdate(
    id: string,
    updates: {
      name?: string;
      isPrimary?: boolean;
      config?: Partial<MortgageSimulatorConfig>;
    },
  ): Promise<MortgageScenario> {
    const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    if (!res.ok) {
      throw new Error(`Failed to update scenario remotely: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.scenario;
  }

  /**
   * Creates a new scenario remotely, falling back to local storage if offline.
   */
  public async createRemoteScenario(input: {
    name: string;
    isPrimary?: boolean;
    config?: Partial<MortgageSimulatorConfig>;
  }): Promise<MortgageScenario> {
    try {
      const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        throw new Error(`Failed to create scenario remotely: HTTP ${res.status}`);
      }

      const data = await res.json();
      const created: MortgageScenario = data.scenario;

      // Update local storage
      const { scenarios } = this.loadLocalScenarios();
      const updatedList = created.isPrimary
        ? scenarios.map((s) => ({ ...s, isPrimary: false })).concat(created)
        : [...scenarios, created];

      this.saveLocalScenarios(updatedList, created.id);
      return created;
    } catch {
      // Offline fallback
      const { scenarios } = this.loadLocalScenarios();
      const isFirst = scenarios.length === 0;
      const isPrimary = input.isPrimary ?? isFirst;

      const fallback: MortgageScenario = {
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name.trim() || "New Scenario",
        isPrimary,
        config: sanitizeConfig(input.config),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedList = isPrimary
        ? scenarios.map((s) => ({ ...s, isPrimary: false })).concat(fallback)
        : [...scenarios, fallback];

      this.saveLocalScenarios(updatedList, fallback.id);
      return fallback;
    }
  }

  /**
   * Updates an existing scenario remotely, falling back to local storage if offline.
   */
  public async updateRemoteScenario(
    id: string,
    updates: {
      name?: string;
      isPrimary?: boolean;
      config?: Partial<MortgageSimulatorConfig>;
    },
  ): Promise<MortgageScenario> {
    try {
      const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update scenario remotely: HTTP ${res.status}`);
      }

      const data = await res.json();
      const updated: MortgageScenario = data.scenario;

      const { scenarios } = this.loadLocalScenarios();
      const nextList = scenarios.map((s) => {
        if (s.id === id) return updated;
        if (updates.isPrimary && s.isPrimary) return { ...s, isPrimary: false };
        return s;
      });

      this.saveLocalScenarios(nextList, id);
      return updated;
    } catch {
      // Offline fallback
      const { scenarios } = this.loadLocalScenarios();
      const target = scenarios.find((s) => s.id === id);
      if (!target) {
        throw new Error(`Scenario not found locally: ${id}`);
      }

      const updated: MortgageScenario = {
        ...target,
        name: updates.name !== undefined ? updates.name.trim() : target.name,
        isPrimary: updates.isPrimary ?? target.isPrimary,
        config: sanitizeConfig({
          property: { ...target.config.property, ...updates.config?.property },
          financing: { ...target.config.financing, ...updates.config?.financing },
          overlap: { ...target.config.overlap, ...updates.config?.overlap },
          goalTracking: { ...target.config.goalTracking, ...updates.config?.goalTracking },
        }),
        updatedAt: new Date().toISOString(),
      };

      const nextList = scenarios.map((s) => {
        if (s.id === id) return updated;
        if (updates.isPrimary && s.isPrimary) return { ...s, isPrimary: false };
        return s;
      });

      this.saveLocalScenarios(nextList, id);
      return updated;
    }
  }

  /**
   * Deletes a scenario remotely and removes it from local cache.
   */
  public async deleteRemoteScenario(id: string): Promise<boolean> {
    try {
      const res = await this.fetchFn(`/api/family-budget/mortgage/scenarios?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete scenario remotely: HTTP ${res.status}`);
      }
    } catch {
      // Proceed to update local storage anyway for offline resiliency
    }

    const { scenarios, activeScenarioId } = this.loadLocalScenarios();
    const remaining = scenarios.filter((s) => s.id !== id);

    if (remaining.length > 0 && !remaining.some((s) => s.isPrimary)) {
      remaining[0].isPrimary = true;
    }

    const newActiveId =
      activeScenarioId === id ? (remaining.find((s) => s.isPrimary)?.id ?? remaining[0]?.id ?? null) : activeScenarioId;

    this.saveLocalScenarios(remaining, newActiveId ?? undefined);
    return true;
  }

  /**
   * Sets a scenario as primary remotely.
   */
  public async setRemotePrimary(id: string): Promise<MortgageScenario> {
    try {
      const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_primary", id }),
      });

      if (!res.ok) {
        throw new Error(`Failed to set primary scenario remotely: HTTP ${res.status}`);
      }

      const data = await res.json();
      const updated: MortgageScenario = data.scenario;

      const { scenarios } = this.loadLocalScenarios();
      const nextList = scenarios.map((s) => (s.id === id ? updated : { ...s, isPrimary: false }));
      this.saveLocalScenarios(nextList, id);
      return updated;
    } catch {
      // Offline fallback
      const { scenarios } = this.loadLocalScenarios();
      let updated: MortgageScenario | null = null;
      const nextList = scenarios.map((s) => {
        if (s.id === id) {
          updated = { ...s, isPrimary: true, updatedAt: new Date().toISOString() };
          return updated;
        }
        return { ...s, isPrimary: false };
      });

      if (!updated) {
        throw new Error(`Scenario not found: ${id}`);
      }

      this.saveLocalScenarios(nextList, id);
      return updated;
    }
  }

  /**
   * Duplicates an existing scenario remotely.
   */
  public async duplicateRemoteScenario(id: string, newName?: string): Promise<MortgageScenario> {
    try {
      const res = await this.fetchFn("/api/family-budget/mortgage/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", id, name: newName }),
      });

      if (!res.ok) {
        throw new Error(`Failed to duplicate scenario remotely: HTTP ${res.status}`);
      }

      const data = await res.json();
      const duplicated: MortgageScenario = data.scenario;

      const { scenarios } = this.loadLocalScenarios();
      this.saveLocalScenarios([...scenarios, duplicated], duplicated.id);
      return duplicated;
    } catch {
      // Offline fallback
      const { scenarios } = this.loadLocalScenarios();
      const source = scenarios.find((s) => s.id === id);
      if (!source) {
        throw new Error(`Scenario not found: ${id}`);
      }

      const duplicated: MortgageScenario = {
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: newName ?? `${source.name} (Copy)`,
        isPrimary: false,
        config: structuredClone(source.config),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.saveLocalScenarios([...scenarios, duplicated], duplicated.id);
      return duplicated;
    }
  }
}
