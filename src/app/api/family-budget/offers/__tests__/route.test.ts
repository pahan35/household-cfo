import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

import { DEFAULT_COMPARATOR_CONFIG } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/compensation-engine";
import { getDefaultStarterTracks } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";
import type { OfferTrack } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import * as authConfig from "@/server/auth/config";
import { InMemoryOfferStore, setTestOfferStore } from "@/server/offers/db";

import { DELETE, GET, POST, PUT } from "../route";

describe("/api/family-budget/offers API Route", () => {
  let store: InMemoryOfferStore;

  beforeEach(() => {
    const starterTracks = getDefaultStarterTracks();
    store = new InMemoryOfferStore(starterTracks, DEFAULT_COMPARATOR_CONFIG);
    setTestOfferStore(store);
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);
  });

  afterEach(() => {
    setTestOfferStore(null);
    vi.restoreAllMocks();
  });

  it("rejects unauthorized GET requests when auth bypass is inactive", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/family-budget/offers");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Unauthorized");
  });

  it("handles GET to load all tracks and global config", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/offers");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tracks).toHaveLength(3);
    expect(data.globalConfig.defaultWorkingDaysPerYear).toBe(252);
  });

  it("handles GET with id parameter to fetch a single track", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/offers?id=track-current-employer");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.track.companyName).toBe("Acme Cloud Corp");
  });

  it("returns 404 when GET fetches non-existent track id", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/offers?id=non-existent");
    const res = await GET(req);

    expect(res.status).toBe(404);
  });

  it("handles POST to save a track", async () => {
    const newTrack: OfferTrack = {
      id: "track-netflix",
      companyName: "Netflix",
      roleTitle: "Senior Engineer",
      status: "negotiating",
      revisions: [],
      activeRevisionId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const req = new NextRequest("http://localhost:3000/api/family-budget/offers", {
      method: "POST",
      body: JSON.stringify({ action: "save_track", track: newTrack }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.track.companyName).toBe("Netflix");

    const trackInStore = await store.getTrack("track-netflix");
    expect(trackInStore).not.toBeNull();
  });

  it("handles POST to update global config", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/offers", {
      method: "POST",
      body: JSON.stringify({
        action: "save_config",
        globalConfig: {
          ...DEFAULT_COMPARATOR_CONFIG,
          targetMonthlyExpensePln: 25000,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.globalConfig.targetMonthlyExpensePln).toBe(25000);
  });

  it("handles PUT for bulk replacement of tracks and config", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/offers", {
      method: "PUT",
      body: JSON.stringify({
        tracks: [],
        globalConfig: { ...DEFAULT_COMPARATOR_CONFIG, targetMonthlySavingsPln: 12000 },
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.tracks).toHaveLength(0);

    const reloaded = await store.loadAll();
    expect(reloaded.tracks).toHaveLength(0);
    expect(reloaded.globalConfig.targetMonthlySavingsPln).toBe(12000);
  });

  it("handles DELETE to remove a track", async () => {
    const req = new NextRequest("http://localhost:3000/api/family-budget/offers?id=track-current-employer", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const remaining = await store.listTracks();
    expect(remaining).toHaveLength(2);
  });

  it("handles DELETE to remove a specific revision", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/family-budget/offers?trackId=track-current-employer&revisionId=rev-current-usd-restructure",
      {
        method: "DELETE",
      },
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);

    const revs = await store.listRevisions("track-current-employer");
    expect(revs).toHaveLength(1);
    expect(revs[0].id).toBe("rev-current-pln-baseline");
  });
});
