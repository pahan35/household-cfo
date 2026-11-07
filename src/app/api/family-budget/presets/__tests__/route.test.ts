import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import type { ExclusionPreset } from "@/app/(main)/dashboard/family-budget/_components/expense-transforms";
import * as authConfig from "@/server/auth/config";
import { BUILT_IN_PRESET_IDS, InMemoryPresetStore, setTestPresetStore } from "@/server/presets/db";

import { GET, POST } from "../route";

describe("/api/family-budget/presets route handler", () => {
  let store: InMemoryPresetStore;

  const samplePresets: ExclusionPreset[] = [
    {
      id: BUILT_IN_PRESET_IDS.ALL_ACTIVITY,
      name: "All Activity",
      incomeDeductions: [],
      expenseExclusions: [],
      isBuiltIn: true,
    },
    {
      id: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
      name: "Controllable Expenses",
      incomeDeductions: ["tax-1"],
      expenseExclusions: ["rent-1"],
      isBuiltIn: true,
    },
  ];

  beforeEach(() => {
    store = new InMemoryPresetStore(samplePresets, BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    setTestPresetStore(store);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
  });

  afterEach(() => {
    setTestPresetStore(null);
    vi.restoreAllMocks();
  });

  describe("Authentication", () => {
    it("rejects unauthorized GET requests when auth bypass is false", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

      const req = new NextRequest("http://localhost:3000/api/family-budget/presets");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.message).toBe("Unauthorized");
    });

    it("rejects unauthorized POST requests when auth bypass is false", async () => {
      vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

      const req = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({ action: "set_active", activePresetId: "test" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/family-budget/presets", () => {
    it("returns presets list and activePresetId", async () => {
      const req = new NextRequest("http://localhost:3000/api/family-budget/presets");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.presets).toHaveLength(2);
      expect(data.activePresetId).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    });
  });

  describe("POST /api/family-budget/presets", () => {
    it("handles set_active action", async () => {
      const req = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({ action: "set_active", activePresetId: BUILT_IN_PRESET_IDS.ALL_ACTIVITY }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.activePresetId).toBe(BUILT_IN_PRESET_IDS.ALL_ACTIVITY);

      const all = await store.loadAll();
      expect(all.activePresetId).toBe(BUILT_IN_PRESET_IDS.ALL_ACTIVITY);
    });

    it("handles upsert_preset action", async () => {
      const custom: ExclusionPreset = {
        id: "custom-travel",
        name: "Travel Focus",
        incomeDeductions: [],
        expenseExclusions: ["flight-cat"],
      };

      const req = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_preset", preset: custom, makeActive: true }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.preset.id).toBe("custom-travel");
      expect(data.activePresetId).toBe("custom-travel");
      expect(data.presets).toHaveLength(3);
    });

    it("handles delete_preset action", async () => {
      const req = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({ action: "delete_preset", presetId: BUILT_IN_PRESET_IDS.ALL_ACTIVITY }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.presets).toHaveLength(1);
    });

    it("handles seed_if_empty action", async () => {
      setTestPresetStore(new InMemoryPresetStore());

      const req = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({
          action: "seed_if_empty",
          presets: samplePresets,
          activePresetId: BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES,
        }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.presets).toHaveLength(2);
      expect(data.activePresetId).toBe(BUILT_IN_PRESET_IDS.CONTROLLABLE_EXPENSES);
    });

    it("handles save_all action", async () => {
      const updatedList: ExclusionPreset[] = [
        {
          id: "p1",
          name: "P1",
          incomeDeductions: ["tax-id"],
          expenseExclusions: [],
        },
      ];

      const req = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({ action: "save_all", presets: updatedList, activePresetId: "p1" }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.presets).toHaveLength(1);
      expect(data.activePresetId).toBe("p1");
    });

    it("returns 400 on invalid JSON or missing parameters", async () => {
      const reqBadJson = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: "bad-json",
      });
      const resBad = await POST(reqBadJson);
      expect(resBad.status).toBe(400);

      const reqMissing = new NextRequest("http://localhost:3000/api/family-budget/presets", {
        method: "POST",
        body: JSON.stringify({ action: "set_active" }),
      });
      const resMissing = await POST(reqMissing);
      expect(resMissing.status).toBe(400);
    });
  });
});
