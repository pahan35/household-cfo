import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_COMPARATOR_CONFIG } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/compensation-engine";
import { getDefaultStarterTracks } from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";
import type {
  ComparatorGlobalConfig,
  OfferRevision,
  OfferTrack,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";

import {
  assumptionsRowToConfig,
  configToAssumptionsRow,
  domainToRevisionRow,
  domainToTrackRow,
  getOfferStore,
  InMemoryOfferStore,
  type OfferRevisionRow,
  type OfferTrackRow,
  revisionRowToDomain,
  SupabaseRestOfferStore,
  setTestOfferStore,
  trackRowToDomain,
} from "../db";

describe("Offer Store DB Layer", () => {
  afterEach(() => {
    setTestOfferStore(null);
    vi.restoreAllMocks();
  });

  describe("Row Serialization & Deserialization", () => {
    it("converts domain OfferTrack to OfferTrackRow and back", () => {
      const starterTracks = getDefaultStarterTracks();
      const track = starterTracks[0];

      const row = domainToTrackRow(track, 3);
      expect(row.id).toBe(track.id);
      expect(row.company).toBe(track.companyName);
      expect(row.role).toBe(track.roleTitle);
      expect(row.status).toBe(track.status);
      expect(row.sort_order).toBe(3);
      expect(row.active_revision_id).toBe(track.activeRevisionId);

      const reconstructed = trackRowToDomain(row, track.revisions);
      expect(reconstructed.id).toBe(track.id);
      expect(reconstructed.companyName).toBe(track.companyName);
      expect(reconstructed.roleTitle).toBe(track.roleTitle);
      expect(reconstructed.status).toBe(track.status);
      expect(reconstructed.activeRevisionId).toBe(track.activeRevisionId);
      expect(reconstructed.revisions).toHaveLength(track.revisions.length);
    });

    it("converts B2B OfferRevision to OfferRevisionRow and back with full fidelity", () => {
      const starterTracks = getDefaultStarterTracks();
      const b2bRev = starterTracks[0].revisions[0]; // B2B Ryczalt

      const row = domainToRevisionRow(b2bRev, "track-1", 1);
      expect(row.contract_type).toBe("b2b");
      expect(row.b2b_tax_regime).toBe("ryczalt");
      expect(row.ryczalt_tax_rate_pct).toBe(12);
      expect(row.time_off_model).toBe("model_b_combined");
      expect(row.rate_amount).toBe(22000);
      expect(row.rate_currency).toBe("PLN");

      const reconstructed = revisionRowToDomain(row);
      expect(reconstructed.id).toBe(b2bRev.id);
      expect(reconstructed.rateSpec.amount).toBe(22000);
      expect(reconstructed.taxProfile.regime).toBe("b2b_ryczalt");
      expect(reconstructed.timeOff.model).toBe("model_b_combined");
      expect(reconstructed.benefits).toHaveLength(b2bRev.benefits.length);
    });

    it("converts UoP OfferRevision to OfferRevisionRow and back", () => {
      const starterTracks = getDefaultStarterTracks();
      const uopRev = starterTracks[2].revisions[0]; // UoP track

      const row = domainToRevisionRow(uopRev, "track-3", 1);
      expect(row.contract_type).toBe("uop");
      expect(row.b2b_tax_regime).toBe("uop");
      expect(row.rate_amount).toBe(uopRev.rateSpec.amount);

      const reconstructed = revisionRowToDomain(row);
      expect(reconstructed.taxProfile.regime).toBe("uop");
      expect(reconstructed.rateSpec.amount).toBe(uopRev.rateSpec.amount);
      expect(reconstructed.equityGrants).toHaveLength(uopRev.equityGrants.length);
    });

    it("converts fallback OfferRevisionRow without JSON columns to domain correctly", () => {
      const row: OfferRevisionRow = {
        id: "rev-fallback",
        track_id: "track-1",
        revision_number: 1,
        title: "Legacy Fallback",
        effective_date: "2024-05",
        rate_amount: "15000.00",
        rate_currency: "PLN",
        rate_period: "monthly",
        contract_type: "uop",
        b2b_tax_regime: "uop",
        ryczalt_tax_rate_pct: 0,
        zus_stage: "pelny_zus",
        voluntary_sickness_insurance: true,
        pfron_has_certificate: true,
        pfron_rebate_pct: 0,
        monthly_accounting_cost_pln: 0,
        tax_profile_json: null,
        time_off_model: "model_a_separate",
        paid_vacation_days: "26",
        paid_sick_days: "5",
        sick_pay_pct: "80.0",
        paid_state_holidays: "13",
        combined_pto_days: "26",
        state_holidays_deducted_from_pool: false,
        pto_rate_markup_pct: "0",
        time_off_json: null,
        real_expected_weekly_hours: 35,
        allows_side_gig: false,
        benefits_json: [],
        equity_grants_json: [],
        side_gigs_json: [],
        notes: "Test notes",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      };

      const domain = revisionRowToDomain(row);
      expect(domain.taxProfile.regime).toBe("uop");
      expect(domain.timeOff.model).toBe("model_a_separate");
      expect(domain.expectedWeeklyHours).toBe(35);
      expect(domain.rateSpec.amount).toBe(15000);
      expect(domain.notes).toBe("Test notes");
    });

    it("serializes and deserializes ComparatorGlobalConfig row", () => {
      const customConfig: ComparatorGlobalConfig = {
        ...DEFAULT_COMPARATOR_CONFIG,
        targetMonthlyExpensePln: 14500,
        targetMonthlySavingsPln: 7000,
        activeYearProjection: 2,
        manualFxOverrides: { USD: 4.15 },
      };

      const row = configToAssumptionsRow(customConfig, "default");
      expect(row.id).toBe("default");
      expect(row.target_monthly_expense_pln).toBe(14500);
      expect(row.target_monthly_savings_pln).toBe(7000);
      expect(row.active_year_projection).toBe(2);

      const reconstructed = assumptionsRowToConfig(row);
      expect(reconstructed.targetMonthlyExpensePln).toBe(14500);
      expect(reconstructed.targetMonthlySavingsPln).toBe(7000);
      expect(reconstructed.activeYearProjection).toBe(2);
      expect(reconstructed.manualFxOverrides).toEqual({ USD: 4.15 });
    });
  });

  describe("InMemoryOfferStore", () => {
    let store: InMemoryOfferStore;

    beforeEach(() => {
      const starterTracks = getDefaultStarterTracks();
      store = new InMemoryOfferStore(starterTracks, DEFAULT_COMPARATOR_CONFIG);
    });

    it("lists seeded tracks", async () => {
      const tracks = await store.listTracks();
      expect(tracks).toHaveLength(3);
      expect(tracks[0].companyName).toBe("Acme Cloud Corp");
    });

    it("gets track by id and returns deep copy", async () => {
      const track = await store.getTrack("track-current-employer");
      expect(track).not.toBeNull();
      expect(track?.companyName).toBe("Acme Cloud Corp");

      // Modifying returned object must not mutate store
      if (track) {
        track.companyName = "Mutated Corp";
      }
      const fetchedAgain = await store.getTrack("track-current-employer");
      expect(fetchedAgain?.companyName).toBe("Acme Cloud Corp");
    });

    it("saves and updates tracks", async () => {
      const newTrack: OfferTrack = {
        id: "new-track-1",
        companyName: "Stripe",
        roleTitle: "Staff Infrastructure Engineer",
        status: "negotiating",
        revisions: [],
        activeRevisionId: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.saveTrack(newTrack);
      const fetched = await store.getTrack("new-track-1");
      expect(fetched?.companyName).toBe("Stripe");
    });

    it("deletes a track", async () => {
      const deleted = await store.deleteTrack("track-current-employer");
      expect(deleted).toBe(true);

      const tracks = await store.listTracks();
      expect(tracks).toHaveLength(2);
      expect(await store.getTrack("track-current-employer")).toBeNull();
    });

    it("handles revisions CRUD within a track", async () => {
      const revs = await store.listRevisions("track-current-employer");
      expect(revs).toHaveLength(2);

      const newRev: OfferRevision = {
        id: "rev-new-1",
        trackId: "track-current-employer",
        title: "Rev 3: Director Promotion",
        effectiveDate: "2025-01",
        rateSpec: { period: "monthly", amount: 35000, currency: "PLN" },
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
          monthlyAccountingCostPln: 300,
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        benefits: [],
        equityGrants: [],
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.saveRevision(newRev);
      const updatedRevs = await store.listRevisions("track-current-employer");
      expect(updatedRevs).toHaveLength(3);

      const deleted = await store.deleteRevision("track-current-employer", "rev-new-1");
      expect(deleted).toBe(true);
      const afterDelete = await store.listRevisions("track-current-employer");
      expect(afterDelete).toHaveLength(2);
    });

    it("gets and saves global comparator configuration", async () => {
      const initial = await store.getGlobalConfig();
      expect(initial.targetMonthlyExpensePln).toBe(DEFAULT_COMPARATOR_CONFIG.targetMonthlyExpensePln);

      const updated = await store.saveGlobalConfig({
        ...initial,
        targetMonthlyExpensePln: 20000,
      });
      expect(updated.targetMonthlyExpensePln).toBe(20000);

      const retrieved = await store.getGlobalConfig();
      expect(retrieved.targetMonthlyExpensePln).toBe(20000);
    });

    it("loadAll and saveAll perform bulk synchronization", async () => {
      const all = await store.loadAll();
      expect(all.tracks).toHaveLength(3);

      const modifiedTracks = all.tracks.slice(0, 1);
      const modifiedConfig = { ...all.globalConfig, targetMonthlySavingsPln: 9999 };

      await store.saveAll(modifiedTracks, modifiedConfig);

      const reloaded = await store.loadAll();
      expect(reloaded.tracks).toHaveLength(1);
      expect(reloaded.globalConfig.targetMonthlySavingsPln).toBe(9999);
    });
  });

  describe("SupabaseRestOfferStore", () => {
    const supabaseUrl = "https://example-project.supabase.co";
    const serviceRoleKey = "test-service-key";

    it("lists tracks and associates nested revisions from Supabase REST", async () => {
      const store = new SupabaseRestOfferStore(supabaseUrl, serviceRoleKey);

      const fakeTracks: OfferTrackRow[] = [
        {
          id: "track-1",
          company: "Acme Cloud",
          role: "SWE",
          status: "negotiating",
          sort_order: 0,
          active_revision_id: "rev-1",
          notes: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      const fakeRevisions: OfferRevisionRow[] = [
        {
          id: "rev-1",
          track_id: "track-1",
          revision_number: 1,
          title: "Initial",
          effective_date: "2024-01",
          rate_amount: 20000,
          rate_currency: "PLN",
          rate_period: "monthly",
          contract_type: "b2b",
          b2b_tax_regime: "ryczalt",
          ryczalt_tax_rate_pct: 12,
          zus_stage: "duzy_zus",
          voluntary_sickness_insurance: false,
          pfron_has_certificate: false,
          pfron_rebate_pct: 0,
          monthly_accounting_cost_pln: 250,
          time_off_model: "model_b_combined",
          paid_vacation_days: 26,
          paid_sick_days: 0,
          sick_pay_pct: 100,
          paid_state_holidays: 13,
          combined_pto_days: 26,
          state_holidays_deducted_from_pool: false,
          pto_rate_markup_pct: 0,
          real_expected_weekly_hours: 40,
          allows_side_gig: true,
          benefits_json: [],
          equity_grants_json: [],
          side_gigs_json: [],
          notes: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/offer_tracks")) {
          return Promise.resolve(new Response(JSON.stringify(fakeTracks), { status: 200 }));
        }
        if (url.includes("/offer_revisions")) {
          return Promise.resolve(new Response(JSON.stringify(fakeRevisions), { status: 200 }));
        }
        return Promise.resolve(new Response("[]", { status: 200 }));
      });

      const tracks = await store.listTracks();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].companyName).toBe("Acme Cloud");
      expect(tracks[0].revisions).toHaveLength(1);
      expect(tracks[0].revisions[0].id).toBe("rev-1");
    });

    it("throws clear error on non-ok REST response", async () => {
      const store = new SupabaseRestOfferStore(supabaseUrl, serviceRoleKey);
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("Permission denied", { status: 403, statusText: "Forbidden" }));

      await expect(store.listTracks()).rejects.toThrow("Supabase REST error (403 Forbidden)");
    });
  });

  describe("getOfferStore & setTestOfferStore factory", () => {
    it("returns InMemoryOfferStore when no environment variables are set", () => {
      const store = getOfferStore();
      expect(store).toBeInstanceOf(InMemoryOfferStore);
    });

    it("allows injecting test store via setTestOfferStore", () => {
      const mockStore = new InMemoryOfferStore();
      setTestOfferStore(mockStore);
      expect(getOfferStore()).toBe(mockStore);
    });
  });
});
