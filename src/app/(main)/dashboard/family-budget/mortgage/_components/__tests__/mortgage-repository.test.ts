import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MORTGAGE_SIMULATOR_CONFIG, DEFAULT_PROPERTY_ACQUISITION_CONFIG } from "../mortgage-engine";
import { MortgageRepository, type StorageLike } from "../mortgage-repository";
import type { MortgageScenario, MortgageSimulatorConfig } from "../mortgage-types";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe("MortgageRepository Local Persistence", () => {
  it("returns default config when storage is empty", () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);
    const config = repo.loadConfig();

    expect(config.property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
    expect(config.financing.downPaymentPct).toBe(20);
    expect(config.goalTracking.linkedGoalCategoryIds).toEqual([]);
  });

  it("saves and reloads modified config cleanly", () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);

    const customConfig: MortgageSimulatorConfig = {
      ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      property: {
        ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
        areaSqm: 82,
        pricePerSqmPln: 17500,
      },
      goalTracking: {
        ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG.goalTracking,
        linkedGoalCategoryIds: ["goal-123"],
      },
    };

    repo.saveConfig(customConfig);
    const loaded = repo.loadConfig();

    expect(loaded.property.areaSqm).toBe(82);
    expect(loaded.property.pricePerSqmPln).toBe(17500);
    expect(loaded.goalTracking.linkedGoalCategoryIds).toEqual(["goal-123"]);
  });

  it("migrates legacy v1 single-config payload to v2 multi-scenario format", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "test-key",
      JSON.stringify({
        version: 1,
        config: {
          ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
          property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 99 },
        },
      }),
    );

    const repo = new MortgageRepository("test-key", storage);
    const { scenarios, activeScenarioId } = repo.loadLocalScenarios();

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe("Primary Plan");
    expect(scenarios[0].isPrimary).toBe(true);
    expect(scenarios[0].config.property.areaSqm).toBe(99);
    expect(activeScenarioId).toBe(scenarios[0].id);
  });

  it("handles corrupted storage gracefully", () => {
    const storage = new MemoryStorage();
    storage.setItem("test-key", "{ broken json ---");
    const repo = new MortgageRepository("test-key", storage);
    const loaded = repo.loadConfig();

    expect(loaded).toEqual(DEFAULT_MORTGAGE_SIMULATOR_CONFIG);
  });

  it("resets to defaults cleanly", () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);

    repo.saveConfig({
      ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 120 },
    });

    const resetConfig = repo.resetToDefaults();
    expect(resetConfig.property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
    expect(repo.loadConfig().property.areaSqm).toBe(DEFAULT_PROPERTY_ACQUISITION_CONFIG.areaSqm);
  });
});

describe("MortgageRepository Remote Synchronization & Auto-Migration", () => {
  it("auto-migrates local config to Supabase if remote scenario list is empty", async () => {
    const storage = new MemoryStorage();
    // Pre-populate custom local setting
    const repo = new MortgageRepository("test-key", storage);
    repo.saveConfig({
      ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 74 },
    });

    const mockFetch = vi.fn();
    // 1st call: GET /api/family-budget/mortgage/scenarios -> empty []
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ scenarios: [] }),
    });

    // 2nd call: POST /api/family-budget/mortgage/scenarios -> creates seeded scenario
    const seededRemote: MortgageScenario = {
      id: "remote-seeded-1",
      name: "Primary Plan",
      isPrimary: true,
      config: {
        ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
        property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 74 },
      },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ scenario: seededRemote }),
    });

    const client = new MortgageRepository("test-key", storage, mockFetch as unknown as typeof fetch);
    const result = await client.fetchRemoteScenarios();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].id).toBe("remote-seeded-1");
    expect(result.scenarios[0].config.property.areaSqm).toBe(74);

    // Verify written to local cache
    const cached = client.loadLocalScenarios();
    expect(cached.scenarios[0].id).toBe("remote-seeded-1");
  });

  it("fetches and updates cache when remote scenarios already exist", async () => {
    const storage = new MemoryStorage();
    const mockRemoteScenarios: MortgageScenario[] = [
      {
        id: "plan-a",
        name: "Plan A",
        isPrimary: true,
        config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "plan-b",
        name: "Plan B",
        isPrimary: false,
        config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ scenarios: mockRemoteScenarios }),
    });

    const client = new MortgageRepository("test-key", storage, mockFetch as unknown as typeof fetch);
    const result = await client.fetchRemoteScenarios();

    expect(result.scenarios).toHaveLength(2);
    expect(result.activeScenarioId).toBe("plan-a");
    expect(result.isOfflineFallback).toBeFalsy();
  });

  it("falls back to local scenarios when remote fetch fails or user is offline", async () => {
    const storage = new MemoryStorage();
    const repo = new MortgageRepository("test-key", storage);
    repo.saveConfig({
      ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 85 },
    });

    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network connection lost"));
    const client = new MortgageRepository("test-key", storage, mockFetch as unknown as typeof fetch);

    const result = await client.fetchRemoteScenarios();
    expect(result.isOfflineFallback).toBe(true);
    expect(result.scenarios[0].config.property.areaSqm).toBe(85);
  });

  it("performs remote mutations and maintains cache integrity", async () => {
    const storage = new MemoryStorage();
    const mockFetch = vi.fn();

    // 1. Create scenario
    const newScen: MortgageScenario = {
      id: "scen-wola",
      name: "Wola 68m²",
      isPrimary: false,
      config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ scenario: newScen }),
    });

    const client = new MortgageRepository("test-key", storage, mockFetch as unknown as typeof fetch);
    const created = await client.createRemoteScenario({ name: "Wola 68m²" });
    expect(created.id).toBe("scen-wola");

    // 2. Set primary
    const setPrimaryScen: MortgageScenario = { ...newScen, isPrimary: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ scenario: setPrimaryScen }),
    });

    const primaryResult = await client.setRemotePrimary("scen-wola");
    expect(primaryResult.isPrimary).toBe(true);

    // 3. Delete
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const deleteResult = await client.deleteRemoteScenario("scen-wola");
    expect(deleteResult).toBe(true);
    expect(client.loadLocalScenarios().scenarios).toHaveLength(0);
  });

  it("auto-replays offline-* created scenarios on reconnect and maps local ID", async () => {
    const storage = new MemoryStorage();
    const client = new MortgageRepository("test-key", storage);

    // 1. User created a scenario while offline
    const offlineScenario = await client.createRemoteScenario({
      name: "Offline Terrace Flat",
      config: { property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 75 } },
    });
    expect(offlineScenario.id).toMatch(/^offline-/);

    // 2. Reconnect with remote DB containing another scenario
    const serverUuid = "server-uuid-terrace-123";
    const mockRemoteScenarios: MortgageScenario[] = [
      {
        id: "server-existing-1",
        name: "Existing Cloud Plan",
        isPrimary: true,
        config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
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
              ...offlineScenario,
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
        json: async () => ({ scenarios: mockRemoteScenarios }),
      };
    });

    const syncedClient = new MortgageRepository("test-key", storage, mockFetch as unknown as typeof fetch);
    const result = await syncedClient.fetchRemoteScenarios();

    expect(result.status).toBe("synced");
    expect(result.conflicts).toHaveLength(0);
    // Offline scenario must be replaced with server UUID in local cache
    const loadedLocal = syncedClient.loadLocalScenarios();
    expect(loadedLocal.scenarios.some((s) => s.id === serverUuid)).toBe(true);
    expect(loadedLocal.scenarios.some((s) => s.id.startsWith("offline-"))).toBe(false);
  });

  it("detects conflict and halts silent local overwrites when concurrent edits occur", async () => {
    const storage = new MemoryStorage();
    const client = new MortgageRepository("test-key", storage);

    // Baseline synced scenario
    const baseline: MortgageScenario = {
      id: "scen-shared-1",
      name: "Shared Plan",
      isPrimary: true,
      config: {
        ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
        property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 60 },
      },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    client.saveLocalScenarios([baseline], baseline.id);
    client.setLastSyncedAt("2026-01-01T00:00:00Z");

    // Local user edits offline
    await client.updateRemoteScenario("scen-shared-1", {
      name: "Shared Plan - Local 70m²",
      config: { property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 70 } },
    });

    // Remote database was also edited concurrently
    const remoteConflicting: MortgageScenario = {
      ...baseline,
      name: "Shared Plan - Remote 80m²",
      config: {
        ...DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
        property: { ...DEFAULT_PROPERTY_ACQUISITION_CONFIG, areaSqm: 80 },
      },
      updatedAt: "2026-01-02T12:00:00Z",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ scenarios: [remoteConflicting] }),
    });

    const syncedClient = new MortgageRepository("test-key", storage, mockFetch as unknown as typeof fetch);
    const result = await syncedClient.fetchRemoteScenarios();

    expect(result.status).toBe("conflict");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts?.[0].entityId).toBe("scen-shared-1");
    // Local cache MUST NOT be overwritten with remote 80m²
    const localAfter = syncedClient.loadLocalScenarios().scenarios[0];
    expect(localAfter.name).toBe("Shared Plan - Local 70m²");
    expect(localAfter.config.property.areaSqm).toBe(70);

    // Resolving conflict with "use_cloud" adopts remote
    await syncedClient.resolveConflict(result.conflicts![0], "use_cloud");
    const localResolved = syncedClient.loadLocalScenarios().scenarios[0];
    expect(localResolved.name).toBe("Shared Plan - Remote 80m²");
    expect(localResolved.config.property.areaSqm).toBe(80);
  });
});
