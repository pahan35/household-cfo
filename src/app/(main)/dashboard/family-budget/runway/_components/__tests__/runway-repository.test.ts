import { beforeEach, describe, expect, it, vi } from "vitest";

import { OFFER_STORAGE_KEY } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";

import { DEFAULT_CAPITAL_POOL_CONFIG, DEFAULT_JDG_RUNWAY_CONFIG } from "../runway-engine";
import {
  DEFAULT_RUNWAY_STORAGE_PAYLOAD,
  RunwayRepository,
  type RunwayScenarioTransport,
  type StorageLike,
} from "../runway-repository";
import type { RunwayScenario } from "../runway-types";

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

describe("runway-repository", () => {
  let memoryStorage: MemoryStorage;
  let repository: RunwayRepository;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    repository = new RunwayRepository("test-runway-key", memoryStorage);
  });

  describe("Single Scenario & Local Storage Compatibility", () => {
    it("loads default payload when storage is empty", async () => {
      const payload = await repository.load();
      expect(payload.version).toBe(1);
      expect(payload.lookbackWindow).toBe("3m");
      expect(payload.jdgConfig?.posture).toBe("active");
      expect(payload.capitalPoolConfig?.safetyFloorPln).toBe(10000);
    });

    it("persists and restores payload across saves", async () => {
      const customPayload = {
        ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
        lookbackWindow: "6m" as const,
        jdgConfig: {
          ...DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig,
          posture: "suspended" as const,
          monthlyAccountingCostPln: 150,
        },
        capitalPoolConfig: {
          ...DEFAULT_CAPITAL_POOL_CONFIG,
          safetyFloorPln: 25000,
        },
        categoryWeights: {
          "cat-trips": { enabled: false, retentionPct: 0 },
        },
      };

      await repository.save(customPayload);

      const newRepo = new RunwayRepository("test-runway-key", memoryStorage);
      const restored = await newRepo.load();

      expect(restored.lookbackWindow).toBe("6m");
      expect(restored.jdgConfig?.posture).toBe("suspended");
      expect(restored.jdgConfig?.monthlyAccountingCostPln).toBe(150);
      expect(restored.capitalPoolConfig?.safetyFloorPln).toBe(25000);
      expect(restored.categoryWeights?.["cat-trips"]?.enabled).toBe(false);
    });

    it("seeds JDG config and benefit replacement from OfferRepository current track", async () => {
      const mockOfferStorage = {
        version: 1,
        tracks: [
          {
            id: "track-1",
            companyName: "Acme",
            status: "current",
            activeRevisionId: "rev-1",
            revisions: [
              {
                id: "rev-1",
                taxProfile: {
                  regime: "b2b_ryczalt",
                  zusStage: "duzy_zus",
                  voluntarySickness: true,
                  monthlyAccountingCostPln: 350,
                  pfronRebate: { enabled: true, type: "percentage", percentage: 50, fixedAmountPln: 0 },
                },
                benefits: [
                  { id: "b1", name: "Health", monthlyBudgetOffsetPln: 300 },
                  { id: "b2", name: "Gym", monthlyBudgetOffsetPln: 150 },
                ],
              },
            ],
          },
        ],
      };

      memoryStorage.setItem(OFFER_STORAGE_KEY, JSON.stringify(mockOfferStorage));

      const seededRepo = new RunwayRepository("seeded-runway-key", memoryStorage);
      const seeded = await seededRepo.seedJdgConfigFromOfferRepository();

      expect(seeded.regime).toBe("b2b_ryczalt");
      expect(seeded.zusStage).toBe("duzy_zus");
      expect(seeded.monthlyAccountingCostPln).toBe(350);
      expect(seeded.pfronRebate?.enabled).toBe(true);
      expect(seeded.benefitLossReplacementPln).toBe(450);
    });

    it("resets cleanly to defaults", async () => {
      await repository.save({
        ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
        lookbackWindow: "1m",
      });

      const reset = await repository.resetToDefaults();
      expect(reset.lookbackWindow).toBe("3m");
    });

    it("seamlessly migrates legacy v1 single-scenario payload to multi-scenario v2 format", () => {
      const legacyV1Payload = {
        version: 1,
        jdgConfig: {
          posture: "wakacje_skladkowe",
          monthlyAccountingCostPln: 200,
        },
        capitalPoolConfig: {
          safetyFloorPln: 18000,
        },
        lookbackWindow: "12m",
        activePresetId: "preset-moderate",
        categoryWeights: {
          "cat-dining": { enabled: true, retentionPct: 50 },
        },
      };

      memoryStorage.setItem("test-runway-key", JSON.stringify(legacyV1Payload));

      const { scenarios, activeScenarioId } = repository.loadLocalScenarios();
      expect(scenarios).toHaveLength(1);
      expect(activeScenarioId).toBe(scenarios[0].id);
      expect(scenarios[0].isPrimary).toBe(true);
      expect(scenarios[0].jdgConfig.posture).toBe("wakacje_skladkowe");
      expect(scenarios[0].capitalPoolConfig.safetyFloorPln).toBe(18000);
      expect(scenarios[0].lookbackWindow).toBe("12m");
      expect(scenarios[0].categoryCuts["cat-dining"]).toEqual({ enabled: true, retentionPct: 50 });
    });
  });

  describe("Cloud Synchronization & Auto-Migration (Supabase)", () => {
    it("auto-migrates local scenario to Supabase when remote database is empty", async () => {
      // Setup local storage with a customized scenario
      repository.saveLocalScenarios([
        {
          id: "local-austerity",
          name: "Initial Local Austerity",
          isPrimary: true,
          jdgConfig: {
            ...DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig,
            month1Vat7Pln: 5000,
          } as any,
          capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
          lookbackWindow: "6m",
          activePresetId: "preset-normal",
          customPresets: [],
          categoryCuts: { "cat-1": { enabled: true, retentionPct: 30 } },
          baselineOfferRevisionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      let postCalls = 0;
      let postedBody: any = null;

      const mockFetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === "GET") {
          // Initial remote check returns empty array
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ scenarios: [] }),
          });
        }
        if (opts?.method === "POST") {
          postCalls++;
          postedBody = JSON.parse(opts.body as string);
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({
              scenario: {
                id: "remote-seeded-uuid",
                name: postedBody.name,
                isPrimary: true,
                jdgConfig: postedBody.jdgConfig,
                capitalPoolConfig: postedBody.capitalPoolConfig,
                lookbackWindow: postedBody.lookbackWindow,
                activePresetId: postedBody.activePresetId,
                customPresets: postedBody.customPresets,
                categoryCuts: postedBody.categoryCuts,
                baselineOfferRevisionId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        }
        return Promise.reject(new Error("Unexpected call"));
      });

      const syncRepo = new RunwayRepository("test-runway-key", memoryStorage, mockFetch as any);
      const result = await syncRepo.fetchRemoteScenarios();

      expect(postCalls).toBe(1);
      expect(postedBody.name).toBe("Initial Local Austerity");
      expect(postedBody.jdgConfig.month1Vat7Pln).toBe(5000);
      expect(postedBody.categoryCuts["cat-1"]).toEqual({ enabled: true, retentionPct: 30 });

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0].id).toBe("remote-seeded-uuid");
      expect(result.activeScenarioId).toBe("remote-seeded-uuid");

      // Verify cached in local storage
      const cached = syncRepo.loadLocalScenarios();
      expect(cached.scenarios[0].id).toBe("remote-seeded-uuid");
    });

    it("syncs remote scenarios and caches them in localStorage", async () => {
      const remoteScenarios: RunwayScenario[] = [
        {
          id: "scen-remote-1",
          name: "Plan Alpha",
          isPrimary: true,
          jdgConfig: DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig as any,
          capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
          lookbackWindow: "3m",
          activePresetId: "preset-normal",
          customPresets: [],
          categoryCuts: {},
          baselineOfferRevisionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "scen-remote-2",
          name: "Plan Beta",
          isPrimary: false,
          jdgConfig: DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig as any,
          capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
          lookbackWindow: "6m",
          activePresetId: "preset-aggressive",
          customPresets: [],
          categoryCuts: {},
          baselineOfferRevisionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ scenarios: remoteScenarios }),
        }),
      );

      const syncRepo = new RunwayRepository("test-runway-key", memoryStorage, mockFetch as any);
      const result = await syncRepo.fetchRemoteScenarios();

      expect(result.scenarios).toHaveLength(2);
      expect(result.activeScenarioId).toBe("scen-remote-1");

      const cached = syncRepo.loadLocalScenarios();
      expect(cached.scenarios).toHaveLength(2);
      expect(cached.activeScenarioId).toBe("scen-remote-1");
    });

    it("gracefully falls back to local cache when offline or fetch fails", async () => {
      repository.saveLocalScenarios([
        {
          id: "offline-plan",
          name: "Offline Plan",
          isPrimary: true,
          jdgConfig: DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig as any,
          capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
          lookbackWindow: "3m",
          activePresetId: "preset-normal",
          customPresets: [],
          categoryCuts: {},
          baselineOfferRevisionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const failingFetch = vi.fn().mockImplementation(() => Promise.reject(new Error("Network Error")));
      const offlineRepo = new RunwayRepository("test-runway-key", memoryStorage, failingFetch as any);

      const result = await offlineRepo.fetchRemoteScenarios();
      expect(result.isOfflineFallback).toBe(true);
      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0].name).toBe("Offline Plan");
    });

    it("handles remote CRUD, set primary, and duplicate with offline fallback", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === "POST") {
          const body = JSON.parse(opts.body as string);
          if (body.action === "duplicate") {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: async () => ({
                scenario: {
                  id: "scen-dup",
                  name: body.name,
                  isPrimary: false,
                  jdgConfig: DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig,
                  capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
                  lookbackWindow: "3m",
                  activePresetId: "preset-normal",
                  customPresets: [],
                  categoryCuts: {},
                  baselineOfferRevisionId: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              }),
            });
          }
          if (body.action === "set_primary") {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                scenario: { id: body.id, isPrimary: true },
              }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({
              scenario: {
                id: "scen-created",
                name: body.name,
                isPrimary: Boolean(body.isPrimary),
                jdgConfig: DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig,
                capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
                lookbackWindow: "3m",
                activePresetId: "preset-normal",
                customPresets: [],
                categoryCuts: {},
                baselineOfferRevisionId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        }
        if (opts?.method === "PATCH") {
          const body = JSON.parse(opts.body as string);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              scenario: {
                id: body.id,
                name: body.name,
                isPrimary: false,
                jdgConfig: DEFAULT_RUNWAY_STORAGE_PAYLOAD.jdgConfig,
                capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
                lookbackWindow: "3m",
                activePresetId: "preset-normal",
                customPresets: [],
                categoryCuts: {},
                baselineOfferRevisionId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        }
        if (opts?.method === "DELETE") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          });
        }
        return Promise.reject(new Error("Unexpected request"));
      });

      const repo = new RunwayRepository("test-runway-key", memoryStorage, mockFetch as any);

      // Create
      const created = await repo.createRemoteScenario({ name: "Remote Scenario 1" });
      expect(created.id).toBe("scen-created");

      // Update
      const updated = await repo.updateRemoteScenario("scen-created", { name: "Remote Scenario 1 Updated" });
      expect(updated.name).toBe("Remote Scenario 1 Updated");

      // Duplicate
      const duplicated = await repo.duplicateRemoteScenario("scen-created", "Remote Scenario 1 Cloned");
      expect(duplicated.id).toBe("scen-dup");
      expect(duplicated.name).toBe("Remote Scenario 1 Cloned");

      // Set Primary
      const primary = await repo.setPrimaryRemoteScenario("scen-dup");
      expect(primary.isPrimary).toBe(true);

      // Delete
      const deleted = await repo.deleteRemoteScenario("scen-created");
      expect(deleted).toBe(true);

      const local = repo.loadLocalScenarios();
      expect(local.scenarios.some((s) => s.id === "scen-created")).toBe(false);
    });

    it("fetches linked offer revision when requested", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("include_offer=true")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              scenario: { id: "scen-with-offer", baselineOfferRevisionId: "rev-123" },
              linkedOfferRevision: { id: "rev-123", title: "Active Offer" },
            }),
          });
        }
        return Promise.reject(new Error("Not found"));
      });

      const repo = new RunwayRepository("test-runway-key", memoryStorage, mockFetch as any);
      const offerRev = await repo.fetchLinkedOfferRevision("scen-with-offer");
      expect(offerRev?.id).toBe("rev-123");
      expect(offerRev?.title).toBe("Active Offer");
    });

    it("auto-replays offline-* created runway scenarios on reconnect and maps local ID", async () => {
      const client = new RunwayRepository("test-runway-key", memoryStorage);

      // Create scenario offline
      const offlineScen = await client.createRemoteScenario({
        name: "Offline Austerity Freeze",
        lookbackWindow: "6m",
      });
      expect(offlineScen.id).toMatch(/^offline-/);

      const serverUuid = "server-uuid-runway-999";
      const mockRemote: RunwayScenario[] = [
        {
          id: "server-existing-1",
          name: "Existing Plan",
          isPrimary: true,
          jdgConfig: DEFAULT_JDG_RUNWAY_CONFIG,
          capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
          lookbackWindow: "3m",
          activePresetId: "preset-normal",
          customPresets: [],
          categoryCuts: {},
          baselineOfferRevisionId: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ];

      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          return {
            ok: true,
            status: 201,
            json: async () => ({
              scenario: {
                ...offlineScen,
                id: serverUuid,
                name: body.name,
                updatedAt: new Date().toISOString(),
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ scenarios: mockRemote }),
        };
      });

      const syncedClient = new RunwayRepository("test-runway-key", memoryStorage, mockFetch as unknown as typeof fetch);
      const result = await syncedClient.fetchRemoteScenarios();

      expect(result.status).toBe("synced");
      expect(result.conflicts).toHaveLength(0);
      const loaded = syncedClient.loadLocalScenarios();
      expect(loaded.scenarios.some((s) => s.id === serverUuid)).toBe(true);
      expect(loaded.scenarios.some((s) => s.id.startsWith("offline-"))).toBe(false);
    });

    it("detects conflict and halts silent local overwrites when concurrent edits occur", async () => {
      const client = new RunwayRepository("test-runway-key", memoryStorage);

      const baseline: RunwayScenario = {
        id: "scen-runway-shared",
        name: "Shared Plan",
        isPrimary: true,
        jdgConfig: DEFAULT_JDG_RUNWAY_CONFIG,
        capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
        lookbackWindow: "3m",
        activePresetId: "preset-normal",
        customPresets: [],
        categoryCuts: {},
        baselineOfferRevisionId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      client.saveLocalScenarios([baseline], baseline.id);
      client.setLastSyncedAt("2026-01-01T00:00:00Z");

      // Local user edits offline
      await client.updateRemoteScenario("scen-runway-shared", {
        name: "Shared Plan - Local 6m Window",
        lookbackWindow: "6m",
      });

      // Remote DB has concurrent edit
      const remoteConflicting: RunwayScenario = {
        ...baseline,
        name: "Shared Plan - Remote 12m Window",
        lookbackWindow: "12m",
        updatedAt: "2026-01-02T12:00:00Z",
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ scenarios: [remoteConflicting] }),
      });

      const syncedClient = new RunwayRepository("test-runway-key", memoryStorage, mockFetch as unknown as typeof fetch);
      const result = await syncedClient.fetchRemoteScenarios();

      expect(result.status).toBe("conflict");
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts?.[0].entityId).toBe("scen-runway-shared");

      // Local draft is preserved
      const localAfter = syncedClient.loadLocalScenarios().scenarios[0];
      expect(localAfter.name).toBe("Shared Plan - Local 6m Window");
      expect(localAfter.lookbackWindow).toBe("6m");

      // Resolve conflict via "use_cloud"
      if (result.conflicts?.[0]) {
        await syncedClient.resolveConflict(result.conflicts[0], "use_cloud");
      }
      const localResolved = syncedClient.loadLocalScenarios().scenarios[0];
      expect(localResolved.name).toBe("Shared Plan - Remote 12m Window");
      expect(localResolved.lookbackWindow).toBe("12m");
    });

    it("supports pluggable ScenarioTransport and falls back to local storage when transport fails", async () => {
      const storage = new MemoryStorage();
      const failingTransport = {
        list: vi.fn().mockRejectedValue(new Error("Server action timeout")),
        create: vi.fn().mockRejectedValue(new Error("Action error")),
        update: vi.fn().mockRejectedValue(new Error("Action error")),
        delete: vi.fn().mockRejectedValue(new Error("Action error")),
        setPrimary: vi.fn().mockRejectedValue(new Error("Action error")),
        duplicate: vi.fn().mockRejectedValue(new Error("Action error")),
      };

      const repo = new RunwayRepository(
        "transport-runway-key",
        storage,
        undefined,
        failingTransport as unknown as RunwayScenarioTransport,
      );

      // Creating remotely falls back to offline local storage
      const created = await repo.createRemoteScenario({ name: "Offline Runway Action Plan", isPrimary: true });
      expect(created.name).toBe("Offline Runway Action Plan");
      expect(created.id).toMatch(/^offline-/);

      // Listing scenarios returns the offline fallback
      const synced = await repo.fetchRemoteScenarios();
      expect(synced.isOfflineFallback).toBe(true);
      expect(synced.status).toBe("offline");
      expect(synced.scenarios[0].name).toBe("Offline Runway Action Plan");

      // Updating remotely when offline updates local storage
      const updated = await repo.updateRemoteScenario(created.id, { name: "Offline Runway Action Plan v2" });
      expect(updated.name).toBe("Offline Runway Action Plan v2");
      expect(repo.loadLocalScenarios().scenarios[0].name).toBe("Offline Runway Action Plan v2");
    });
  });
});
