import {
  OFFER_STORAGE_KEY,
  type OfferComparatorStoragePayload,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";
import type {
  OfferRevision,
  OfferTrack,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import {
  type CloudSyncStatus,
  type ConflictRecord,
  type ConflictResolutionChoice,
  reconcileEntities,
} from "@/lib/cloud-sync-reconciler";
import { createFetchScenarioTransport, type ScenarioTransport } from "@/lib/scenario-transport";
import type { CreateRunwayScenarioDto, UpdateRunwayScenarioDto } from "@/lib/schemas/scenarios";

import { DEFAULT_CAPITAL_POOL_CONFIG, DEFAULT_JDG_RUNWAY_CONFIG } from "./runway-engine";
import type {
  AusterityPreset,
  CapitalPoolConfig,
  CategoryAusterityWeight,
  JdgRunwayConfig,
  JdgTaxRegime,
  LookbackWindow,
  RunwayScenario,
  RunwaySimulatorStoragePayload,
} from "./runway-types";

export const RUNWAY_STORAGE_KEY = "family-budget:runway-simulator:v1";

export type RunwayScenarioCreateInput = CreateRunwayScenarioDto;
export type RunwayScenarioUpdateInput = Omit<UpdateRunwayScenarioDto, "id">;
export type RunwayScenarioTransport = ScenarioTransport<
  RunwayScenario,
  RunwayScenarioCreateInput,
  RunwayScenarioUpdateInput
>;

export const DEFAULT_RUNWAY_STORAGE_PAYLOAD: RunwaySimulatorStoragePayload = {
  version: 1,
  jdgConfig: DEFAULT_JDG_RUNWAY_CONFIG,
  capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
  lookbackWindow: "3m",
  activePresetId: "preset-normal",
  customPresets: [],
  categoryWeights: {},
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createDefaultRunwayScenario(
  id = "default-runway",
  name = "Baseline Austerity",
  seededJdg?: Partial<JdgRunwayConfig>,
): RunwayScenario {
  return {
    id,
    name,
    isPrimary: true,
    jdgConfig: {
      ...DEFAULT_JDG_RUNWAY_CONFIG,
      ...seededJdg,
    },
    capitalPoolConfig: { ...DEFAULT_CAPITAL_POOL_CONFIG },
    lookbackWindow: "3m",
    activePresetId: "preset-normal",
    customPresets: [],
    categoryCuts: {},
    baselineOfferRevisionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeRunwayScenario(raw: Partial<RunwayScenario>, id?: string): RunwayScenario {
  return {
    id: raw.id ?? id ?? `scen-${Math.random().toString(36).slice(2, 9)}`,
    name: raw.name?.trim() ? raw.name.trim() : "Baseline Austerity",
    isPrimary: Boolean(raw.isPrimary),
    jdgConfig: {
      ...DEFAULT_JDG_RUNWAY_CONFIG,
      ...raw.jdgConfig,
    },
    capitalPoolConfig: {
      ...DEFAULT_CAPITAL_POOL_CONFIG,
      ...raw.capitalPoolConfig,
    },
    lookbackWindow: raw.lookbackWindow ?? "3m",
    activePresetId: raw.activePresetId ?? "preset-normal",
    customPresets: Array.isArray(raw.customPresets) ? [...raw.customPresets] : [],
    categoryCuts: raw.categoryCuts ? { ...raw.categoryCuts } : {},
    baselineOfferRevisionId: raw.baselineOfferRevisionId ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export class RunwayRepository {
  private memoryPayload: RunwaySimulatorStoragePayload | null = null;
  private readonly storageKey: string;
  private readonly storage: StorageLike | null = null;
  private readonly fetchFn: typeof fetch;
  private readonly transport: RunwayScenarioTransport;

  /**
   * @param transport Remote transport for scenario persistence. Defaults to the REST routes over
   * `customFetch`; pass an action-backed transport to use Server Actions. Offline fallbacks apply either way.
   */
  constructor(
    storageKey = RUNWAY_STORAGE_KEY,
    customStorage?: StorageLike,
    customFetch?: typeof fetch,
    transport?: RunwayScenarioTransport,
  ) {
    this.storageKey = storageKey;
    if (customStorage) {
      this.storage = customStorage;
    } else if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
    this.fetchFn = customFetch ?? ((...args) => fetch(...args));
    this.transport =
      transport ??
      createFetchScenarioTransport<RunwayScenario, RunwayScenarioCreateInput, RunwayScenarioUpdateInput>(
        this.fetchFn,
        "/api/family-budget/runway/scenarios",
      );
  }

  /**
   * Reads the active "current" track from OfferRepository (if available) and
   * extracts initial JDG tax profile settings and benefit replacement cost.
   */
  public async seedJdgConfigFromOfferRepository(): Promise<Partial<JdgRunwayConfig>> {
    if (!this.storage) {
      return {};
    }

    try {
      const rawOffers = this.storage.getItem(OFFER_STORAGE_KEY);
      if (!rawOffers) return {};

      const parsed = JSON.parse(rawOffers) as OfferComparatorStoragePayload | null;
      if (parsed?.version !== 1 || !Array.isArray(parsed.tracks)) {
        return {};
      }

      // Find active current track
      const currentTrack: OfferTrack | undefined =
        parsed.tracks.find((t) => t.status === "current") ?? parsed.tracks[0];

      if (!currentTrack || !Array.isArray(currentTrack.revisions) || currentTrack.revisions.length === 0) {
        return {};
      }

      const activeRev: OfferRevision | undefined =
        currentTrack.revisions.find((r) => r.id === currentTrack.activeRevisionId) ??
        currentTrack.revisions[currentTrack.revisions.length - 1];

      if (!activeRev) return {};

      const partialConfig: Partial<JdgRunwayConfig> = {};

      const profile = activeRev.taxProfile;
      if (
        profile &&
        (profile.regime === "b2b_ryczalt" || profile.regime === "b2b_liniowy" || profile.regime === "b2b_skala")
      ) {
        partialConfig.regime = profile.regime as JdgTaxRegime;
        partialConfig.zusStage = profile.zusStage;
        partialConfig.voluntarySickness = Boolean(profile.voluntarySickness);
        partialConfig.pfronRebate = profile.pfronRebate;
        if (typeof profile.monthlyAccountingCostPln === "number") {
          partialConfig.monthlyAccountingCostPln = profile.monthlyAccountingCostPln;
        }
      }

      // Calculate benefit replacement cost from lost benefits
      if (Array.isArray(activeRev.benefits) && activeRev.benefits.length > 0) {
        const replacementCost = activeRev.benefits.reduce((sum, b) => {
          return sum + (b.monthlyBudgetOffsetPln ?? b.nominalValuePln ?? 0);
        }, 0);
        if (replacementCost > 0) {
          partialConfig.benefitLossReplacementPln = replacementCost;
        }
      }

      return partialConfig;
    } catch (e) {
      console.warn("Failed to seed JDG posture from OfferRepository:", e);
      return {};
    }
  }

  /**
   * Loads scenarios stored locally in browser localStorage.
   * Seamlessly migrates legacy v1 single-scenario payload to multi-scenario v2 format.
   */
  public loadLocalScenarios(): { scenarios: RunwayScenario[]; activeScenarioId: string | null } {
    if (!this.storage) {
      return { scenarios: [], activeScenarioId: null };
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return { scenarios: [], activeScenarioId: null };
      }

      const parsed = JSON.parse(raw) as RunwaySimulatorStoragePayload | null;
      if (!parsed) {
        return { scenarios: [], activeScenarioId: null };
      }

      // If already v2 format with scenarios array
      if (Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
        const scenarios: RunwayScenario[] = parsed.scenarios.map((s) => sanitizeRunwayScenario(s));
        let activeId = parsed.activeScenarioId ?? null;
        if (!activeId || !scenarios.some((s) => s.id === activeId)) {
          const primary = scenarios.find((s) => s.isPrimary);
          activeId = primary ? primary.id : scenarios[0].id;
        }
        return { scenarios, activeScenarioId: activeId };
      }

      // Legacy v1 single-scenario format migration
      if (parsed.jdgConfig || parsed.capitalPoolConfig) {
        const migrated: RunwayScenario = {
          id: "local-migrated",
          name: "Baseline Austerity",
          isPrimary: true,
          jdgConfig: {
            ...DEFAULT_JDG_RUNWAY_CONFIG,
            ...parsed.jdgConfig,
          },
          capitalPoolConfig: {
            ...DEFAULT_CAPITAL_POOL_CONFIG,
            ...parsed.capitalPoolConfig,
          },
          lookbackWindow: parsed.lookbackWindow ?? "3m",
          activePresetId: parsed.activePresetId ?? "preset-normal",
          customPresets: Array.isArray(parsed.customPresets) ? parsed.customPresets : [],
          categoryCuts: parsed.categoryWeights ?? {},
          baselineOfferRevisionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: parsed.updatedAt ?? new Date().toISOString(),
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
  public saveLocalScenarios(scenarios: RunwayScenario[], activeScenarioId?: string): void {
    if (!this.storage) return;

    try {
      const primary = scenarios.find((s) => s.isPrimary) ?? scenarios[0];
      const active = scenarios.find((s) => s.id === activeScenarioId) ?? primary;

      const payload: RunwaySimulatorStoragePayload = {
        version: 2,
        scenarios,
        activeScenarioId: active ? active.id : undefined,
        jdgConfig: active ? active.jdgConfig : DEFAULT_JDG_RUNWAY_CONFIG,
        capitalPoolConfig: active ? active.capitalPoolConfig : DEFAULT_CAPITAL_POOL_CONFIG,
        lookbackWindow: active ? active.lookbackWindow : "3m",
        activePresetId: active ? active.activePresetId : "preset-normal",
        customPresets: active ? active.customPresets : [],
        categoryWeights: active ? active.categoryCuts : {},
        updatedAt: new Date().toISOString(),
      };

      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota errors in constrained environments
    }
  }

  /**
   * Backwards-compatible load method for single-scenario readers.
   */
  public async load(): Promise<RunwaySimulatorStoragePayload> {
    const { scenarios, activeScenarioId } = this.loadLocalScenarios();

    if (scenarios.length > 0) {
      const active =
        scenarios.find((s) => s.id === activeScenarioId) ?? scenarios.find((s) => s.isPrimary) ?? scenarios[0];

      return {
        version: 1,
        jdgConfig: active.jdgConfig,
        capitalPoolConfig: active.capitalPoolConfig,
        lookbackWindow: active.lookbackWindow,
        activePresetId: active.activePresetId,
        customPresets: active.customPresets,
        categoryWeights: active.categoryCuts,
        scenarios,
        activeScenarioId: active.id,
      };
    }

    if (this.memoryPayload) {
      return this.memoryPayload;
    }

    // Default initialization with offer repo seeding attempt
    const seededJdg = await this.seedJdgConfigFromOfferRepository();
    const defaultScenario = createDefaultRunwayScenario("local-primary", "Baseline Austerity", seededJdg);
    this.saveLocalScenarios([defaultScenario], defaultScenario.id);

    const initialPayload: RunwaySimulatorStoragePayload = {
      ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
      jdgConfig: defaultScenario.jdgConfig,
      scenarios: [defaultScenario],
      activeScenarioId: defaultScenario.id,
    };

    this.memoryPayload = initialPayload;
    return initialPayload;
  }

  /**
   * Backwards-compatible save method for single-scenario callers.
   */
  public async save(payload: RunwaySimulatorStoragePayload): Promise<void> {
    const { scenarios, activeScenarioId } = this.loadLocalScenarios();
    const targetId = activeScenarioId ?? scenarios.find((s) => s.isPrimary)?.id ?? scenarios[0]?.id;

    if (!targetId || scenarios.length === 0) {
      const initial: RunwayScenario = {
        id: "local-primary",
        name: "Baseline Austerity",
        isPrimary: true,
        jdgConfig: { ...DEFAULT_JDG_RUNWAY_CONFIG, ...payload.jdgConfig },
        capitalPoolConfig: { ...DEFAULT_CAPITAL_POOL_CONFIG, ...payload.capitalPoolConfig },
        lookbackWindow: payload.lookbackWindow ?? "3m",
        activePresetId: payload.activePresetId ?? "preset-normal",
        customPresets: payload.customPresets ? [...payload.customPresets] : [],
        categoryCuts: payload.categoryWeights ? { ...payload.categoryWeights } : {},
        baselineOfferRevisionId: null,
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
            jdgConfig: { ...s.jdgConfig, ...payload.jdgConfig },
            capitalPoolConfig: { ...s.capitalPoolConfig, ...payload.capitalPoolConfig },
            lookbackWindow: payload.lookbackWindow ?? s.lookbackWindow,
            activePresetId: payload.activePresetId ?? s.activePresetId,
            customPresets: payload.customPresets ? [...payload.customPresets] : s.customPresets,
            categoryCuts: payload.categoryWeights ? { ...payload.categoryWeights } : s.categoryCuts,
            updatedAt: new Date().toISOString(),
          }
        : s,
    );

    this.saveLocalScenarios(updated, targetId);
  }

  public async resetToDefaults(): Promise<RunwaySimulatorStoragePayload> {
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore
      }
    }

    const seededJdg = await this.seedJdgConfigFromOfferRepository();
    const defaultScenario = createDefaultRunwayScenario("local-primary", "Baseline Austerity", seededJdg);
    this.saveLocalScenarios([defaultScenario], defaultScenario.id);

    return {
      ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
      jdgConfig: defaultScenario.jdgConfig,
      scenarios: [defaultScenario],
      activeScenarioId: defaultScenario.id,
    };
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
      // Ignore
    }
  }

  /**
   * Fetches scenarios from Supabase and applies reconciliation:
   * - Auto-replays offline-created scenarios (`offline-*` IDs).
   * - Detects concurrent conflicting edits and halts silent local overwrites.
   * - Cleanly updates local cache and persists synchronized state.
   */
  public async fetchRemoteScenarios(signal?: AbortSignal): Promise<{
    scenarios: RunwayScenario[];
    activeScenarioId: string;
    isOfflineFallback?: boolean;
    conflicts?: ConflictRecord<RunwayScenario>[];
    status?: CloudSyncStatus;
  }> {
    try {
      const remoteScenarios: RunwayScenario[] = await this.transport.list(signal);
      const local = this.loadLocalScenarios();

      // Auto-migration: if remote database is empty, seed it with the current local scenario
      if (remoteScenarios.length === 0) {
        const activeLocal =
          local.scenarios.find((s) => s.id === local.activeScenarioId) ??
          local.scenarios.find((s) => s.isPrimary) ??
          local.scenarios[0];

        const seededJdg = await this.seedJdgConfigFromOfferRepository();

        const seedInput = {
          name: activeLocal ? activeLocal.name : "Baseline Austerity",
          isPrimary: true,
          jdgConfig: activeLocal ? activeLocal.jdgConfig : { ...DEFAULT_JDG_RUNWAY_CONFIG, ...seededJdg },
          capitalPoolConfig: activeLocal ? activeLocal.capitalPoolConfig : DEFAULT_CAPITAL_POOL_CONFIG,
          lookbackWindow: activeLocal ? activeLocal.lookbackWindow : ("3m" as LookbackWindow),
          activePresetId: activeLocal ? activeLocal.activePresetId : "preset-normal",
          customPresets: activeLocal ? activeLocal.customPresets : [],
          categoryCuts: activeLocal ? activeLocal.categoryCuts : {},
        };

        const seeded = await this.createRemoteScenario(seedInput);
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

      // Reconcile local and remote entities
      const reconcileResult = await reconcileEntities<RunwayScenario>({
        localEntities: local.scenarios,
        remoteEntities: remoteScenarios,
        lastSyncedAt: this.getLastSyncedAt(),
        uploadOfflineEntity: async (item) => {
          return await this.createRemoteScenarioWithoutCacheUpdate({
            name: item.name,
            isPrimary: item.isPrimary,
            jdgConfig: item.jdgConfig,
            capitalPoolConfig: item.capitalPoolConfig,
            lookbackWindow: item.lookbackWindow,
            activePresetId: item.activePresetId,
            customPresets: item.customPresets,
            categoryCuts: item.categoryCuts,
            baselineOfferRevisionId: item.baselineOfferRevisionId,
          });
        },
        uploadModifiedEntity: async (item) => {
          return await this.updateRemoteScenarioWithoutCacheUpdate(item.id, {
            name: item.name,
            isPrimary: item.isPrimary,
            jdgConfig: item.jdgConfig,
            capitalPoolConfig: item.capitalPoolConfig,
            lookbackWindow: item.lookbackWindow,
            activePresetId: item.activePresetId,
            customPresets: item.customPresets,
            categoryCuts: item.categoryCuts,
            baselineOfferRevisionId: item.baselineOfferRevisionId,
          });
        },
        getEntityName: (item) => item.name,
      });

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
      const scenarios = local.scenarios.length > 0 ? local.scenarios : [createDefaultRunwayScenario()];
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
    conflict: ConflictRecord<RunwayScenario>,
    choice: ConflictResolutionChoice,
  ): Promise<RunwayScenario[]> {
    const { scenarios, activeScenarioId } = this.loadLocalScenarios();

    if (choice === "keep_local") {
      await this.updateRemoteScenario(conflict.entityId, {
        name: conflict.localVersion.name,
        isPrimary: conflict.localVersion.isPrimary,
        jdgConfig: conflict.localVersion.jdgConfig,
        capitalPoolConfig: conflict.localVersion.capitalPoolConfig,
        lookbackWindow: conflict.localVersion.lookbackWindow,
        activePresetId: conflict.localVersion.activePresetId,
        customPresets: conflict.localVersion.customPresets,
        categoryCuts: conflict.localVersion.categoryCuts,
        baselineOfferRevisionId: conflict.localVersion.baselineOfferRevisionId,
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
    jdgConfig?: Partial<JdgRunwayConfig>;
    capitalPoolConfig?: Partial<CapitalPoolConfig>;
    lookbackWindow?: LookbackWindow;
    activePresetId?: string;
    customPresets?: AusterityPreset[];
    categoryCuts?: Record<string, CategoryAusterityWeight>;
    baselineOfferRevisionId?: string | null;
  }): Promise<RunwayScenario> {
    return await this.transport.create(input);
  }

  public async updateRemoteScenarioWithoutCacheUpdate(
    id: string,
    updates: {
      name?: string;
      isPrimary?: boolean;
      jdgConfig?: Partial<JdgRunwayConfig>;
      capitalPoolConfig?: Partial<CapitalPoolConfig>;
      lookbackWindow?: LookbackWindow;
      activePresetId?: string;
      customPresets?: AusterityPreset[];
      categoryCuts?: Record<string, CategoryAusterityWeight>;
      baselineOfferRevisionId?: string | null;
    },
  ): Promise<RunwayScenario> {
    return await this.transport.update(id, updates);
  }

  /**
   * Creates a new scenario remotely, falling back to local storage if offline.
   */
  public async createRemoteScenario(input: {
    name: string;
    isPrimary?: boolean;
    jdgConfig?: Partial<JdgRunwayConfig>;
    capitalPoolConfig?: Partial<CapitalPoolConfig>;
    lookbackWindow?: LookbackWindow;
    activePresetId?: string;
    customPresets?: AusterityPreset[];
    categoryCuts?: Record<string, CategoryAusterityWeight>;
    baselineOfferRevisionId?: string | null;
  }): Promise<RunwayScenario> {
    try {
      const created: RunwayScenario = await this.transport.create(input);

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

      const fallback: RunwayScenario = {
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name.trim() ? input.name.trim() : "New Scenario",
        isPrimary,
        jdgConfig: { ...DEFAULT_JDG_RUNWAY_CONFIG, ...input.jdgConfig },
        capitalPoolConfig: { ...DEFAULT_CAPITAL_POOL_CONFIG, ...input.capitalPoolConfig },
        lookbackWindow: input.lookbackWindow ?? "3m",
        activePresetId: input.activePresetId ?? "preset-normal",
        customPresets: input.customPresets ? [...input.customPresets] : [],
        categoryCuts: input.categoryCuts ? { ...input.categoryCuts } : {},
        baselineOfferRevisionId: input.baselineOfferRevisionId ?? null,
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
      jdgConfig?: Partial<JdgRunwayConfig>;
      capitalPoolConfig?: Partial<CapitalPoolConfig>;
      lookbackWindow?: LookbackWindow;
      activePresetId?: string;
      customPresets?: AusterityPreset[];
      categoryCuts?: Record<string, CategoryAusterityWeight>;
      baselineOfferRevisionId?: string | null;
    },
  ): Promise<RunwayScenario> {
    try {
      const updated: RunwayScenario = await this.transport.update(id, updates);

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

      const updated: RunwayScenario = {
        ...target,
        name: updates.name !== undefined ? updates.name.trim() : target.name,
        isPrimary: updates.isPrimary ?? target.isPrimary,
        jdgConfig: updates.jdgConfig ? { ...target.jdgConfig, ...updates.jdgConfig } : target.jdgConfig,
        capitalPoolConfig: updates.capitalPoolConfig
          ? { ...target.capitalPoolConfig, ...updates.capitalPoolConfig }
          : target.capitalPoolConfig,
        lookbackWindow: updates.lookbackWindow ?? target.lookbackWindow,
        activePresetId: updates.activePresetId ?? target.activePresetId,
        customPresets: updates.customPresets ? [...updates.customPresets] : target.customPresets,
        categoryCuts: updates.categoryCuts ? { ...updates.categoryCuts } : target.categoryCuts,
        baselineOfferRevisionId: updates.baselineOfferRevisionId ?? target.baselineOfferRevisionId,
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
   * Deletes a scenario remotely, falling back to local storage if offline.
   */
  public async deleteRemoteScenario(id: string): Promise<boolean> {
    try {
      await this.transport.delete(id);

      const { scenarios, activeScenarioId } = this.loadLocalScenarios();
      const remaining = scenarios.filter((s) => s.id !== id);

      let nextActiveId = activeScenarioId;
      if (activeScenarioId === id) {
        const primary = remaining.find((s) => s.isPrimary);
        nextActiveId = primary ? primary.id : (remaining[0]?.id ?? null);
      }

      this.saveLocalScenarios(remaining, nextActiveId ?? undefined);
      return true;
    } catch {
      // Offline fallback
      const { scenarios, activeScenarioId } = this.loadLocalScenarios();
      const remaining = scenarios.filter((s) => s.id !== id);

      let nextActiveId = activeScenarioId;
      if (activeScenarioId === id) {
        const primary = remaining.find((s) => s.isPrimary);
        nextActiveId = primary ? primary.id : (remaining[0]?.id ?? null);
      }

      this.saveLocalScenarios(remaining, nextActiveId ?? undefined);
      return true;
    }
  }

  /**
   * Sets primary scenario remotely, falling back to local storage if offline.
   */
  public async setPrimaryRemoteScenario(id: string): Promise<RunwayScenario> {
    try {
      const primary: RunwayScenario = await this.transport.setPrimary(id);

      const { scenarios } = this.loadLocalScenarios();
      const updatedList = scenarios.map((s) => ({
        ...s,
        isPrimary: s.id === id,
      }));

      this.saveLocalScenarios(updatedList, id);
      return primary;
    } catch {
      // Offline fallback
      const { scenarios } = this.loadLocalScenarios();
      const updatedList = scenarios.map((s) => ({
        ...s,
        isPrimary: s.id === id,
      }));

      const target = updatedList.find((s) => s.id === id);
      if (!target) throw new Error(`Scenario not found: ${id}`);

      this.saveLocalScenarios(updatedList, id);
      return target;
    }
  }

  /**
   * Duplicates a scenario remotely, falling back to local storage if offline.
   */
  public async duplicateRemoteScenario(id: string, newName?: string): Promise<RunwayScenario> {
    try {
      const duplicated: RunwayScenario = await this.transport.duplicate(id, newName);

      const { scenarios } = this.loadLocalScenarios();
      this.saveLocalScenarios([...scenarios, duplicated], duplicated.id);
      return duplicated;
    } catch {
      // Offline fallback
      const { scenarios } = this.loadLocalScenarios();
      const source = scenarios.find((s) => s.id === id);
      if (!source) throw new Error(`Source scenario not found: ${id}`);

      const fallback: RunwayScenario = {
        ...structuredClone(source),
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: newName ?? `${source.name} (Copy)`,
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.saveLocalScenarios([...scenarios, fallback], fallback.id);
      return fallback;
    }
  }

  /**
   * Fetches linked OfferRevision from offer comparator database if baselineOfferRevisionId is set.
   */
  public async fetchLinkedOfferRevision(scenarioId: string): Promise<OfferRevision | null> {
    try {
      const res = await this.fetchFn(
        `/api/family-budget/runway/scenarios?id=${encodeURIComponent(scenarioId)}&include_offer=true`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.linkedOfferRevision ?? null;
    } catch {
      return null;
    }
  }
}

export const runwayRepository = new RunwayRepository();
