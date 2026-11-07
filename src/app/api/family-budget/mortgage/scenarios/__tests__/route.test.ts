import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import * as authConfig from "@/server/auth/config";
import { InMemoryMortgageStore, setTestMortgageStore } from "@/server/mortgage/db";

import { DELETE, GET, PATCH, POST } from "../route";

describe("/api/family-budget/mortgage/scenarios", () => {
  let store: InMemoryMortgageStore;

  beforeEach(() => {
    store = new InMemoryMortgageStore();
    setTestMortgageStore(store);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
  });

  afterEach(() => {
    setTestMortgageStore(null);
    vi.restoreAllMocks();
  });

  it("rejects unauthorized GET requests when auth bypass is inactive", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/family-budget/mortgage/scenarios");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Unauthorized");
  });

  it("handles GET to list all scenarios or fetch by id", async () => {
    const _s1 = await store.create({ name: "Primary", isPrimary: true });
    const s2 = await store.create({ name: "Alternative", isPrimary: false });

    // List all
    const reqList = new NextRequest("http://localhost:3000/api/family-budget/mortgage/scenarios");
    const resList = await GET(reqList);
    expect(resList.status).toBe(200);
    const dataList = await resList.json();
    expect(dataList.scenarios).toHaveLength(2);

    // Fetch by id
    const reqSingle = new NextRequest(`http://localhost:3000/api/family-budget/mortgage/scenarios?id=${s2.id}`);
    const resSingle = await GET(reqSingle);
    expect(resSingle.status).toBe(200);
    const dataSingle = await resSingle.json();
    expect(dataSingle.scenario.name).toBe("Alternative");
  });

  it("handles POST to create a scenario", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/mortgage/scenarios", {
      method: "POST",
      body: JSON.stringify({
        name: "Wola 68m²",
        isPrimary: false,
        config: {
          property: { areaSqm: 68, pricePerSqmPln: 17000 },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.scenario.name).toBe("Wola 68m²");
    expect(data.scenario.config.property.areaSqm).toBe(68);
  });

  it("handles POST action=set_primary and action=duplicate", async () => {
    const _s1 = await store.create({ name: "Plan 1" });
    const s2 = await store.create({ name: "Plan 2" });

    // Set primary
    const reqSetPrimary = new NextRequest("http://localhost:3000/api/family-budget/mortgage/scenarios", {
      method: "POST",
      body: JSON.stringify({ action: "set_primary", id: s2.id }),
    });
    const resSetPrimary = await POST(reqSetPrimary);
    expect(resSetPrimary.status).toBe(200);
    const resultSetPrimary = await resSetPrimary.json();
    expect(resultSetPrimary.scenario.isPrimary).toBe(true);

    // Duplicate
    const reqDuplicate = new NextRequest("http://localhost:3000/api/family-budget/mortgage/scenarios", {
      method: "POST",
      body: JSON.stringify({ action: "duplicate", id: s2.id, name: "Plan 2 Cloned" }),
    });
    const resDuplicate = await POST(reqDuplicate);
    expect(resDuplicate.status).toBe(201);
    const resultDuplicate = await resDuplicate.json();
    expect(resultDuplicate.scenario.name).toBe("Plan 2 Cloned");
  });

  it("handles PATCH to update scenario properties", async () => {
    const scen = await store.create({ name: "Original Name" });

    const req = new NextRequest("http://localhost:3000/api/family-budget/mortgage/scenarios", {
      method: "PATCH",
      body: JSON.stringify({
        id: scen.id,
        name: "Renamed Scenario",
        config: {
          property: { areaSqm: 95 },
        },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scenario.name).toBe("Renamed Scenario");
    expect(data.scenario.config.property.areaSqm).toBe(95);
  });

  it("handles DELETE to remove scenario", async () => {
    const scen = await store.create({ name: "To Delete" });

    const req = new NextRequest(`http://localhost:3000/api/family-budget/mortgage/scenarios?id=${scen.id}`, {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(await store.get(scen.id)).toBeNull();
  });
});
