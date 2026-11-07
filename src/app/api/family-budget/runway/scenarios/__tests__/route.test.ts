import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import * as authConfig from "@/server/auth/config";
import { InMemoryRunwayStore, setTestRunwayStore } from "@/server/runway/db";

import { DELETE, GET, PATCH, POST } from "../route";

describe("/api/family-budget/runway/scenarios", () => {
  let store: InMemoryRunwayStore;

  beforeEach(() => {
    store = new InMemoryRunwayStore();
    setTestRunwayStore(store);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
  });

  afterEach(() => {
    setTestRunwayStore(null);
    vi.restoreAllMocks();
  });

  it("rejects unauthorized GET requests when auth bypass is inactive", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/family-budget/runway/scenarios");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Unauthorized");
  });

  it("handles GET to list all scenarios or fetch by id", async () => {
    const _s1 = await store.create({ name: "Primary Austerity", isPrimary: true });
    const s2 = await store.create({ name: "Aggressive Winter Freeze", isPrimary: false });

    // List all
    const reqList = new NextRequest("http://localhost:3000/api/family-budget/runway/scenarios");
    const resList = await GET(reqList);
    expect(resList.status).toBe(200);
    const dataList = await resList.json();
    expect(dataList.scenarios).toHaveLength(2);

    // Fetch by id
    const reqSingle = new NextRequest(`http://localhost:3000/api/family-budget/runway/scenarios?id=${s2.id}`);
    const resSingle = await GET(reqSingle);
    expect(resSingle.status).toBe(200);
    const dataSingle = await resSingle.json();
    expect(dataSingle.scenario.name).toBe("Aggressive Winter Freeze");
  });

  it("handles POST to create a runway scenario with category cuts", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/runway/scenarios", {
      method: "POST",
      body: JSON.stringify({
        name: "Zero Spending",
        isPrimary: false,
        jdgConfig: { posture: "suspended" },
        categoryCuts: {
          "cat-entertainment": { enabled: true, retentionPct: 0 },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.scenario.name).toBe("Zero Spending");
    expect(data.scenario.jdgConfig.posture).toBe("suspended");
    expect(data.scenario.categoryCuts["cat-entertainment"]).toEqual({
      enabled: true,
      retentionPct: 0,
    });
  });

  it("handles POST action=set_primary and action=duplicate", async () => {
    const _s1 = await store.create({ name: "Plan 1" });
    const s2 = await store.create({ name: "Plan 2" });

    // Set primary
    const reqSetPrimary = new NextRequest("http://localhost:3000/api/family-budget/runway/scenarios", {
      method: "POST",
      body: JSON.stringify({ action: "set_primary", id: s2.id }),
    });
    const resSetPrimary = await POST(reqSetPrimary);
    expect(resSetPrimary.status).toBe(200);
    const resultSetPrimary = await resSetPrimary.json();
    expect(resultSetPrimary.scenario.isPrimary).toBe(true);

    // Duplicate
    const reqDuplicate = new NextRequest("http://localhost:3000/api/family-budget/runway/scenarios", {
      method: "POST",
      body: JSON.stringify({ action: "duplicate", id: s2.id, name: "Plan 2 Cloned" }),
    });
    const resDuplicate = await POST(reqDuplicate);
    expect(resDuplicate.status).toBe(201);
    const resultDuplicate = await resDuplicate.json();
    expect(resultDuplicate.scenario.name).toBe("Plan 2 Cloned");
  });

  it("handles PATCH to update scenario properties and cuts", async () => {
    const s = await store.create({ name: "Editable Plan" });

    const req = new NextRequest("http://localhost:3000/api/family-budget/runway/scenarios", {
      method: "PATCH",
      body: JSON.stringify({
        id: s.id,
        name: "Renamed Editable Plan",
        jdgConfig: { month1Vat7Pln: 5500 },
        categoryCuts: {
          "cat-food": { enabled: true, retentionPct: 75 },
        },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scenario.name).toBe("Renamed Editable Plan");
    expect(data.scenario.jdgConfig.month1Vat7Pln).toBe(5500);
    expect(data.scenario.categoryCuts["cat-food"]).toEqual({
      enabled: true,
      retentionPct: 75,
    });
  });

  it("handles DELETE to remove a scenario", async () => {
    const s = await store.create({ name: "To Delete" });

    const req = new NextRequest(`http://localhost:3000/api/family-budget/runway/scenarios?id=${s.id}`, {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const check = await store.get(s.id);
    expect(check).toBeNull();
  });
});
