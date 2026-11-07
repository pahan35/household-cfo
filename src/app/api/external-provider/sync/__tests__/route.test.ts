import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import * as authConfig from "@/server/auth/config";
import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "@/server/external-provider/db";
import * as syncModule from "@/server/external-provider/sync";

import { PATCH } from "../config/route";
import { GET, POST } from "../route";

describe("/api/external-provider/sync routes", () => {
  let store: LocalFileExternalProviderStore;

  beforeEach(() => {
    store = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(store);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
  });

  afterEach(() => {
    setTestExternalProviderStore(null);
    vi.restoreAllMocks();
  });

  describe("GET /api/external-provider/sync", () => {
    it("rejects unauthorized caller when auth bypass is inactive", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

      const req = new NextRequest("http://localhost:3000/api/external-provider/sync");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.message).toBe("Unauthorized");
    });

    it("triggers bootstrap sync if database has never had a full sync", async () => {
      const syncSpy = vi.spyOn(syncModule, "runExternalProviderSync").mockImplementation(async () => {
        await store.updateSyncConfig({
          sync_version: 1,
          last_full_reconcile_at: new Date().toISOString(),
        });
        return {
          success: true,
          tier: "cold",
          escalated: false,
          changed: true,
          syncVersion: 1,
          recordsSynced: { categories: 5, transactions: 20, currencies: 1, statPoints: 2 },
        };
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/sync");
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(syncSpy).toHaveBeenCalledWith({ tier: "cold" });
      const data = await res.json();
      expect(data.upToDate).toBe(false);
      expect(data.syncVersion).toBe(1);
    });

    it("returns upToDate: true when sinceVersion matches server sync_version", async () => {
      await store.updateSyncConfig({
        sync_version: 7,
        last_full_reconcile_at: new Date().toISOString(),
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/sync?sinceVersion=7");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.upToDate).toBe(true);
      expect(data.syncVersion).toBe(7);
      expect(data.snapshot).toBeUndefined();
    });

    it("returns full snapshot when sinceVersion is outdated", async () => {
      await store.updateSyncConfig({
        sync_version: 8,
        last_full_reconcile_at: new Date().toISOString(),
      });
      await store.upsertCategories([{ id: "cat-1", name: "Groceries", categoryType: 3 }]);

      const req = new NextRequest("http://localhost:3000/api/external-provider/sync?sinceVersion=3");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.upToDate).toBe(false);
      expect(data.syncVersion).toBe(8);
      expect(data.snapshot).toBeDefined();
      expect(data.snapshot.categories).toHaveLength(1);
    });
  });

  describe("POST /api/external-provider/sync", () => {
    it("returns 400 on invalid tier", async () => {
      const req = new NextRequest("http://localhost:3000/api/external-provider/sync", {
        method: "POST",
        body: JSON.stringify({ tier: "ultra_fast" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid sync tier: "ultra_fast"');
    });

    it("executes sync and returns result with updated snapshot", async () => {
      vi.spyOn(syncModule, "runExternalProviderSync").mockResolvedValueOnce({
        success: true,
        tier: "hot",
        escalated: false,
        changed: true,
        syncVersion: 2,
        recordsSynced: { categories: 10, transactions: 15, currencies: 1, statPoints: 1 },
      });

      const req = new NextRequest("http://localhost:3000/api/external-provider/sync", {
        method: "POST",
        body: JSON.stringify({ tier: "hot", force: true }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.tier).toBe("hot");
      expect(data.snapshot).toBeDefined();
    });
  });

  describe("PATCH /api/external-provider/sync/config", () => {
    it("validates allowed hot_pull_months values", async () => {
      const req = new NextRequest("http://localhost:3000/api/external-provider/sync/config", {
        method: "PATCH",
        body: JSON.stringify({ hot_pull_months: 5 }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("Must be 1, 3, 6, or 12");
    });

    it("validates allowed auto_poll_interval_minutes values", async () => {
      const req = new NextRequest("http://localhost:3000/api/external-provider/sync/config", {
        method: "PATCH",
        body: JSON.stringify({ auto_poll_interval_minutes: 45 }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("Must be 0, 5, 15, or 60");
    });

    it("updates valid sync configuration options", async () => {
      const req = new NextRequest("http://localhost:3000/api/external-provider/sync/config", {
        method: "PATCH",
        body: JSON.stringify({ hot_pull_months: 6, auto_poll_interval_minutes: 15 }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.syncConfig.hot_pull_months).toBe(6);
      expect(data.syncConfig.auto_poll_interval_minutes).toBe(15);

      const persisted = await store.getSyncConfig();
      expect(persisted.hot_pull_months).toBe(6);
      expect(persisted.auto_poll_interval_minutes).toBe(15);
    });
  });
});
