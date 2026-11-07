import { describe, expect, it, vi } from "vitest";

import { DEFAULT_COMPARATOR_CONFIG, normalizeOfferRevision } from "../compensation-engine";
import { getDefaultStarterTracks, LocalStorageOfferRepository, type StorageLike } from "../offer-repository";
import type { ComparatorGlobalConfig, OfferRevision, OfferTrack } from "../offer-types";

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

describe("Offer Comparator Dashboard Multi-Track Integration & Simulated Reload", () => {
  it("persists track creation, revision editing, and multi-track comparisons across a simulated reload", async () => {
    const sharedStorage = new MemoryStorage();
    let serverDatabaseTracks: OfferTrack[] = [];
    let serverDatabaseConfig: ComparatorGlobalConfig = { ...DEFAULT_COMPARATOR_CONFIG };

    // Mock API handler simulating /api/family-budget/offers
    const mockFetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      const method = options?.method ?? "GET";
      if (url.includes("/api/family-budget/offers")) {
        if (method === "GET") {
          return new Response(
            JSON.stringify({
              tracks: serverDatabaseTracks,
              globalConfig: serverDatabaseConfig,
            }),
            { status: 200 },
          );
        }
        if (method === "POST" || method === "PUT") {
          const body = JSON.parse(options?.body as string);
          if (body.action === "save_all" || Array.isArray(body.tracks)) {
            serverDatabaseTracks = body.tracks;
            serverDatabaseConfig = body.globalConfig;
            return new Response(JSON.stringify({ success: true }), { status: 200 });
          }
          if (body.action === "save_track" && body.track) {
            const idx = serverDatabaseTracks.findIndex((t) => t.id === body.track.id);
            if (idx >= 0) {
              serverDatabaseTracks[idx] = body.track;
            } else {
              serverDatabaseTracks.push(body.track);
            }
            return new Response(JSON.stringify({ track: body.track }), { status: 201 });
          }
        }
      }
      return new Response("Not Found", { status: 404 });
    });

    // --- Session 1: Initial Load & Auto-migration ---
    const repoSession1 = new LocalStorageOfferRepository(
      "family-budget:test:v1",
      sharedStorage,
      mockFetch as unknown as typeof fetch,
    );

    const initialLoad = await repoSession1.load();
    // Since server was empty, starter tracks (3) were auto-migrated
    expect(initialLoad.tracks).toHaveLength(3);
    expect(serverDatabaseTracks).toHaveLength(3);

    // --- Session 1: Create a New Track ---
    const newTrackId = "track-amazon-l6";
    const initialRevId = "rev-amazon-r1";

    const amazonRev1: OfferRevision = {
      id: initialRevId,
      trackId: newTrackId,
      title: "Rev 1: Principal SDE Initial",
      effectiveDate: "2025-04",
      rateSpec: { period: "monthly", amount: 45000, currency: "PLN" },
      timeOff: {
        model: "model_b_combined",
        combinedPtoDays: 30,
        stateHolidaysDeductedFromPool: false,
        paidStateHolidaysCount: 13,
      },
      taxProfile: {
        regime: "b2b_ryczalt",
        ryczaltRatePct: 12,
        zusStage: "duzy_zus",
        monthlyAccountingCostPln: 350,
        voluntarySickness: true,
        pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
      },
      benefits: [
        {
          id: "ben-amazon-health",
          name: "LuxMed VIP",
          category: "health",
          nominalValuePln: 600,
          monthlyBudgetOffsetPln: 500,
          subjectiveUtilityWeightPct: 40,
          tier: "family",
        },
      ],
      equityGrants: [
        {
          id: "eq-amazon-rsu",
          type: "rsu",
          totalGrantValue: 120000,
          currency: "USD",
          vestingYears: 4,
          cliffMonths: 12,
          volatilityDiscountPct: 15,
          belkaTaxPct: 19,
          isLiquid: true,
        },
      ],
      expectedWeeklyHours: 40,
      allowsSideGig: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const amazonTrack: OfferTrack = {
      id: newTrackId,
      companyName: "Amazon Web Services",
      roleTitle: "Principal Solutions Architect",
      status: "negotiating",
      revisions: [amazonRev1],
      activeRevisionId: initialRevId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedTracks = [...initialLoad.tracks, amazonTrack];
    await repoSession1.save(updatedTracks, initialLoad.globalConfig);

    // --- Session 1: Edit Revision on New Track (add counter-offer Rev 2) ---
    const amazonRev2: OfferRevision = {
      ...amazonRev1,
      id: "rev-amazon-r2-counter",
      title: "Rev 2: Counter + Higher Monthly Rate",
      rateSpec: { period: "monthly", amount: 52000, currency: "PLN" },
      updatedAt: new Date().toISOString(),
    };

    amazonTrack.revisions.push(amazonRev2);
    amazonTrack.activeRevisionId = amazonRev2.id;
    await repoSession1.save(updatedTracks, initialLoad.globalConfig);

    // Verify multi-track comparison calculation before reload
    const currentTrack = updatedTracks.find((t) => t.status === "current")!;
    const currentActiveRev = currentTrack.revisions.find((r) => r.id === currentTrack.activeRevisionId)!;
    const currentComp = normalizeOfferRevision(currentActiveRev, initialLoad.globalConfig);

    const amazonComp = normalizeOfferRevision(amazonRev2, initialLoad.globalConfig);

    expect(amazonComp.hardNetMonthlyCashflowPln).toBeGreaterThan(currentComp.hardNetMonthlyCashflowPln);
    expect(amazonComp.monthlyLiquidEquityPln).toBeGreaterThan(0);

    // --- Session 2: Simulated Browser Reload ---
    // A fresh client instance is instantiated with the same sharedStorage and mockFetch
    const repoSession2 = new LocalStorageOfferRepository(
      "family-budget:test:v1",
      sharedStorage,
      mockFetch as unknown as typeof fetch,
    );

    const reloadedData = await repoSession2.load();

    // Verify all 4 tracks are present
    expect(reloadedData.tracks).toHaveLength(4);

    const reloadedAmazon = reloadedData.tracks.find((t) => t.id === newTrackId);
    expect(reloadedAmazon).toBeDefined();
    expect(reloadedAmazon?.companyName).toBe("Amazon Web Services");
    expect(reloadedAmazon?.revisions).toHaveLength(2);
    expect(reloadedAmazon?.activeRevisionId).toBe("rev-amazon-r2-counter");

    // Verify multi-track comparison produces exact identical metrics after reload
    const reloadedAmazonRev2 = reloadedAmazon!.revisions.find((r) => r.id === "rev-amazon-r2-counter")!;
    const reloadedComp = normalizeOfferRevision(reloadedAmazonRev2, reloadedData.globalConfig);

    expect(reloadedComp.hardNetMonthlyCashflowPln).toBe(amazonComp.hardNetMonthlyCashflowPln);
    expect(reloadedComp.monthlyGrossRevenuePln).toBe(amazonComp.monthlyGrossRevenuePln);
    expect(reloadedComp.monthlyHardBudgetOffsetPln).toBe(500);
  });
});
