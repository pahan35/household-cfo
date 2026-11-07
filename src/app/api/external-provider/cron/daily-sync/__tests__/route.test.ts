import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import * as authConfig from "@/server/auth/config";
import * as sessionModule from "@/server/auth/session";
import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "@/server/external-provider/db";
import * as syncModule from "@/server/external-provider/sync";

import { GET, POST } from "../route";

describe("Daily Sync Cron Route (/api/external-provider/cron/daily-sync)", () => {
  let store: LocalFileExternalProviderStore;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    store = new LocalFileExternalProviderStore({ inMemory: true });
    setTestExternalProviderStore(store);
    process.env.CRON_SECRET = "super-cron-secret-12345";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setTestExternalProviderStore(null);
    vi.restoreAllMocks();
  });

  it("rejects unauthorized requests with 401 when neither bearer token nor valid session exists", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
    vi.spyOn(sessionModule, "getSessionFromRequest").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/external-provider/cron/daily-sync");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Unauthorized");
  });

  it("authenticates via Authorization: Bearer <CRON_SECRET>", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
    const syncSpy = vi.spyOn(syncModule, "runExternalProviderSync").mockResolvedValueOnce({
      success: true,
      tier: "hot",
      escalated: false,
      changed: false,
      syncVersion: 4,
      recordsSynced: { categories: 0, transactions: 0, currencies: 0, statPoints: 0 },
    });

    const req = new NextRequest("http://localhost:3000/api/external-provider/cron/daily-sync", {
      headers: {
        authorization: "Bearer super-cron-secret-12345",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(syncSpy).toHaveBeenCalledWith({
      tier: "hot",
      escalateIfBalanceChanged: true,
    });

    const config = await store.getSyncConfig();
    expect(config.last_cron_run_at).not.toBeNull();
  });

  it("authenticates via logged in family session when CRON_SECRET is not provided", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
    vi.spyOn(sessionModule, "getSessionFromRequest").mockResolvedValueOnce({
      email: "family@example.com",
      name: "Family Member",
    });

    vi.spyOn(syncModule, "runExternalProviderSync").mockResolvedValueOnce({
      success: true,
      tier: "hot",
      escalated: false,
      changed: true,
      syncVersion: 5,
      recordsSynced: { categories: 2, transactions: 5, currencies: 1, statPoints: 1 },
    });

    const req = new NextRequest("http://localhost:3000/api/external-provider/cron/daily-sync");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.syncResult.changed).toBe(true);
    expect(data.syncResult.syncVersion).toBe(5);

    const config = await store.getSyncConfig();
    expect(config.last_cron_run_at).not.toBeNull();
  });

  it("returns 500 when upstream sync fails", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
    vi.spyOn(syncModule, "runExternalProviderSync").mockResolvedValueOnce({
      success: false,
      tier: "hot",
      escalated: false,
      changed: false,
      syncVersion: 2,
      recordsSynced: { categories: 0, transactions: 0, currencies: 0, statPoints: 0 },
      error: "Upstream 502 Bad Gateway",
    });

    const req = new NextRequest("http://localhost:3000/api/external-provider/cron/daily-sync");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.message).toContain("Upstream 502 Bad Gateway");
  });
});
