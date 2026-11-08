import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as authConfig from "@/server/auth/config";
import { InMemoryTimeValueStore, setTestTimeValueStore } from "@/server/lifestyle/time-value-db";
import { InMemoryMortgageStore, setTestMortgageStore } from "@/server/mortgage/db";

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
    vi.stubEnv("MOBILE_API_TOKENS", `phone:${TOKEN}`);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);
  });

  afterEach(() => {
    setTestMortgageStore(null);
    setTestTimeValueStore(null);
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
});
