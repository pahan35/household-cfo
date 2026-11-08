import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as authConfig from "@/server/auth/config";
import { setTestExternalProviderAdapter } from "@/server/external-provider/adapter";
import { LocalFileExternalProviderStore, setTestExternalProviderStore } from "@/server/external-provider/db";
import { InMemoryTimeValueStore, setTestTimeValueStore } from "@/server/lifestyle/time-value-db";
import { InMemoryMortgageStore, setTestMortgageStore } from "@/server/mortgage/db";

import { PUT as putCategories } from "../external-provider/categories/route";
import { POST as resetMock } from "../external-provider/mock/reset/route";
import { GET as getSnapshot } from "../external-provider/snapshot/route";
import { POST as postSync } from "../external-provider/sync/route";
import { PATCH as patchTransaction, POST as postTransactions } from "../external-provider/transactions/route";
import { DELETE, GET as getScenarios, PATCH, POST as postScenario } from "../scenarios/[kind]/route";
import { GET as getScreenLogs, POST as postScreenLogs } from "../screen-logs/route";

const TOKEN = "test-mobile-token-123";

function request(url: string, init: RequestInit & { token?: string | null } = {}): Request {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (rest.body) headers.set("content-type", "application/json");
  return new Request(`http://localhost:3000${url}`, { ...rest, headers });
}

const kindContext = (kind: string) => ({ params: Promise.resolve({ kind }) });

describe("/api/v1 routes", () => {
  beforeEach(() => {
    setTestMortgageStore(new InMemoryMortgageStore());
    setTestTimeValueStore(new InMemoryTimeValueStore());
    setTestExternalProviderStore(new LocalFileExternalProviderStore({ inMemory: true }));
    setTestExternalProviderAdapter(null);
    vi.stubEnv("MOBILE_API_TOKENS", `phone:${TOKEN}`);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
  });

  afterEach(() => {
    setTestMortgageStore(null);
    setTestTimeValueStore(null);
    setTestExternalProviderStore(null);
    setTestExternalProviderAdapter(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("authentication", () => {
    it("rejects requests without credentials", async () => {
      const res = await getScreenLogs(request("/api/v1/screen-logs"));
      expect(res.status).toBe(401);
    });

    it("rejects an invalid Bearer token even when the bypass is active", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
      const res = await getScreenLogs(request("/api/v1/screen-logs", { token: "wrong" }));
      expect(res.status).toBe(401);
    });

    it("accepts a valid mobile Bearer token", async () => {
      const res = await getScreenLogs(request("/api/v1/screen-logs", { token: TOKEN }));
      expect(res.status).toBe(200);
    });

    it("accepts the web session path (local bypass) without a token", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
      const res = await getScreenLogs(request("/api/v1/screen-logs"));
      expect(res.status).toBe(200);
    });
  });

  describe("screen-logs", () => {
    it("ingests a single log and a batch, validating payloads", async () => {
      const single = await postScreenLogs(
        request("/api/v1/screen-logs", {
          method: "POST",
          token: TOKEN,
          body: JSON.stringify({ weekStartDate: "2026-11-02", player: "me", gamingTotalHours: 3 }),
        }),
      );
      expect(single.status).toBe(201);

      const batch = await postScreenLogs(
        request("/api/v1/screen-logs", {
          method: "POST",
          token: TOKEN,
          body: JSON.stringify({ logs: [{ weekStartDate: "2026-11-02", player: "wife", socialTotalHours: 2 }] }),
        }),
      );
      expect(batch.status).toBe(201);

      const list = await (await getScreenLogs(request("/api/v1/screen-logs", { token: TOKEN }))).json();
      expect(list.weeklyLogs).toHaveLength(1);
      expect(list.weeklyLogs[0].me.gamingTotalHours).toBe(3);
      expect(list.weeklyLogs[0].wife.socialTotalHours).toBe(2);

      const bad = await postScreenLogs(
        request("/api/v1/screen-logs", {
          method: "POST",
          token: TOKEN,
          body: JSON.stringify({ weekStartDate: "bad", player: "me" }),
        }),
      );
      expect(bad.status).toBe(400);

      const malformed = await postScreenLogs(
        request("/api/v1/screen-logs", { method: "POST", token: TOKEN, body: "{nope" }),
      );
      expect(malformed.status).toBe(400);
    });
  });

  describe("scenarios", () => {
    it("runs the mortgage scenario lifecycle under Bearer and session auth", async () => {
      const created = await postScenario(
        request("/api/v1/scenarios/mortgage", {
          method: "POST",
          token: TOKEN,
          body: JSON.stringify({ name: "Plan", isPrimary: true }),
        }),
        kindContext("mortgage"),
      );
      expect(created.status).toBe(201);
      const { scenario } = await created.json();

      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
      const patched = await PATCH(
        request("/api/v1/scenarios/mortgage", {
          method: "PATCH",
          body: JSON.stringify({ id: scenario.id, name: "Renamed" }),
        }),
        kindContext("mortgage"),
      );
      expect(patched.status).toBe(200);
      expect((await patched.json()).scenario.name).toBe("Renamed");

      const listed = await (await getScenarios(request("/api/v1/scenarios/mortgage"), kindContext("mortgage"))).json();
      expect(listed.scenarios).toHaveLength(1);

      const removed = await DELETE(
        request(`/api/v1/scenarios/mortgage?id=${scenario.id}`, { method: "DELETE" }),
        kindContext("mortgage"),
      );
      expect(removed.status).toBe(200);

      const missing = await getScenarios(
        request(`/api/v1/scenarios/mortgage?id=${scenario.id}`),
        kindContext("mortgage"),
      );
      expect(missing.status).toBe(404);
    });

    it("rejects unknown scenario kinds and unauthenticated calls", async () => {
      const unknown = await getScenarios(request("/api/v1/scenarios/offers", { token: TOKEN }), kindContext("offers"));
      expect(unknown.status).toBe(404);

      const anon = await getScenarios(request("/api/v1/scenarios/mortgage"), kindContext("mortgage"));
      expect(anon.status).toBe(401);
    });
  });

  describe("/api/v1/external-provider endpoints", () => {
    describe("in mock adapter mode", () => {
      beforeEach(() => {
        process.env.EXTERNAL_API_ADAPTER = "mock";
      });

      it("fetches snapshot and auto-seeds on initial access", async () => {
        const res = await getSnapshot(request("/api/v1/external-provider/snapshot", { token: TOKEN }));
        expect(res.status).toBe(200);
        const snapshot = await res.json();
        expect(snapshot.syncConfig.sync_version).toBe(1);
        expect(snapshot.categories.length).toBeGreaterThan(0);
      });

      it("triggers sync via POST /api/v1/external-provider/sync", async () => {
        const res = await postSync(
          request("/api/v1/external-provider/sync", {
            token: TOKEN,
            method: "POST",
            body: JSON.stringify({ tier: "hot" }),
          }),
        );
        expect(res.status).toBe(200);
        const result = await res.json();
        expect(result.success).toBe(true);
      });

      it("creates transactions via POST /api/v1/external-provider/transactions", async () => {
        const res = await postTransactions(
          request("/api/v1/external-provider/transactions", {
            token: TOKEN,
            method: "POST",
            body: JSON.stringify({
              sourceId: "cat-acc-main",
              sourceAmount: 120,
              destinationId: "cat-exp-groceries",
              destinationAmount: 120,
            }),
          }),
        );
        expect(res.status).toBe(201);
        const created = await res.json();
        expect(created).toHaveLength(1);
        expect(created[0].sourceAmount).toBe(120);
      });

      it("updates transactions via PATCH /api/v1/external-provider/transactions", async () => {
        const res = await patchTransaction(
          request("/api/v1/external-provider/transactions", {
            token: TOKEN,
            method: "PATCH",
            body: JSON.stringify({
              id: "tx-seed-1",
              comment: "Patched comment",
            }),
          }),
        );
        expect(res.status).toBe(200);
        const updated = await res.json();
        expect(updated.comment).toBe("Patched comment");
      });

      it("upserts categories via PUT /api/v1/external-provider/categories", async () => {
        const res = await putCategories(
          request("/api/v1/external-provider/categories", {
            token: TOKEN,
            method: "PUT",
            body: JSON.stringify([
              { id: "cat-exp-groceries", name: "Groceries (V1)", categoryType: 3, limitAmount: 3500 },
            ]),
          }),
        );
        expect(res.status).toBe(200);
        const updated = await res.json();
        expect(updated[0].name).toBe("Groceries (V1)");
      });

      it("resets state to seed via POST /api/v1/external-provider/mock/reset", async () => {
        const res = await resetMock(
          request("/api/v1/external-provider/mock/reset", {
            token: TOKEN,
            method: "POST",
          }),
        );
        expect(res.status).toBe(200);
        const snapshot = await res.json();
        expect(snapshot.syncConfig.sync_version).toBe(1);
      });
    });

    describe("in live externalProvider mode (default)", () => {
      it("rejects POST /api/v1/external-provider/mock/reset with 403 Forbidden", async () => {
        delete process.env.EXTERNAL_API_ADAPTER;

        const res = await resetMock(
          request("/api/v1/external-provider/mock/reset", {
            token: TOKEN,
            method: "POST",
          }),
        );
        expect(res.status).toBe(403);
        const err = await res.json();
        expect(err.error.message).toContain("Resetting ExternalProvider is forbidden when not in mock mode");
      });
    });
  });
});
