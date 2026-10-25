/**
 * Offer Comparator Persistence Repository & Starter Tracks
 *
 * Provides LocalStorage persistence behind a clean asynchronous-ready
 * repository interface, default starter tracks (Current Baseline with
 * PLN->USD Restructure, Past Company with 1-Year Raise, and Negotiating Offer),
 * and validated JSON Export/Import helpers.
 */

import { DEFAULT_COMPARATOR_CONFIG } from "./compensation-engine";
import type { ComparatorGlobalConfig, OfferRevision, OfferTrack } from "./offer-types";

export const OFFER_STORAGE_KEY = "family-budget:offer-comparator:v1";

export interface OfferComparatorStoragePayload {
  version: 1;
  tracks: OfferTrack[];
  globalConfig: ComparatorGlobalConfig;
  exportedAt?: string;
}

// ---------------------------------------------------------------------------
// Default Starter Offer Tracks & Revisions
// ---------------------------------------------------------------------------

export function getDefaultStarterTracks(): OfferTrack[] {
  // 1. Current Company Track (with PLN Baseline -> USD Restructure revision)
  const currentTrackId = "track-current-employer";
  const currentRev1Id = "rev-current-pln-baseline";
  const currentRev2Id = "rev-current-usd-restructure";

  const currentTrack: OfferTrack = {
    id: currentTrackId,
    companyName: "Acme Cloud Corp",
    roleTitle: "Staff Software Engineer",
    status: "current",
    notes: "Primary role. Recently restructured from PLN monthly retainer to USD hourly with rate raise.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-07-01T00:00:00.000Z",
    activeRevisionId: currentRev2Id,
    revisions: [
      {
        id: currentRev1Id,
        trackId: currentTrackId,
        title: "Rev 1: PLN Baseline + Family Health",
        effectiveDate: "2024-01",
        rateSpec: { period: "monthly", amount: 22000, currency: "PLN" },
        timeOff: {
          model: "model_b_combined",
          combinedPtoDays: 26,
          stateHolidaysDeductedFromPool: false,
          paidStateHolidaysCount: 13,
        },
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 250,
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        benefits: [
          {
            id: "ben-current-health-fam",
            name: "Medicover Private Medical (Family Tier)",
            category: "health",
            nominalValuePln: 450,
            monthlyBudgetOffsetPln: 400,
            subjectiveUtilityWeightPct: 20,
            tier: "family",
            spouseCopayMonthlyPln: 0,
            linkedExternalProviderCategory: "Medicine",
          },
          {
            id: "ben-current-sport",
            name: "MultiSport Plus",
            category: "sport",
            nominalValuePln: 180,
            monthlyBudgetOffsetPln: 180,
            subjectiveUtilityWeightPct: 30,
            tier: "individual",
            linkedExternalProviderCategory: "Sport",
          },
        ],
        equityGrants: [],
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        notes: "Baseline package before mid-year restructure.",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: currentRev2Id,
        trackId: currentTrackId,
        title: "Rev 2: USD Raise + Individual Health",
        effectiveDate: "2024-07",
        rateSpec: { period: "hourly", amount: 48, currency: "USD" }, // ~2016h * 48 USD * 3.80 PLN ~ 367k PLN gross
        timeOff: {
          model: "model_b_combined",
          combinedPtoDays: 26,
          stateHolidaysDeductedFromPool: false,
          paidStateHolidaysCount: 13,
        },
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 250,
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        benefits: [
          {
            id: "ben-current-health-indiv",
            name: "Medicover Private Medical (Individual Tier)",
            category: "health",
            nominalValuePln: 250,
            monthlyBudgetOffsetPln: 200,
            subjectiveUtilityWeightPct: 20,
            tier: "individual",
            spouseCopayMonthlyPln: 220, // Downgrade requires 220 PLN/mo spouse copay
            linkedExternalProviderCategory: "Medicine",
          },
          {
            id: "ben-current-sport-usd",
            name: "MultiSport Plus",
            category: "sport",
            nominalValuePln: 180,
            monthlyBudgetOffsetPln: 180,
            subjectiveUtilityWeightPct: 30,
            tier: "individual",
            linkedExternalProviderCategory: "Sport",
          },
        ],
        equityGrants: [
          {
            id: "eq-current-rsu",
            type: "rsu",
            isLiquid: true,
            totalGrantValue: 24000,
            currency: "USD",
            vestingYears: 4,
            cliffMonths: 12,
            volatilityDiscountPct: 15,
            belkaTaxPct: 19,
            notes: "24,000 USD public RSU grant over 4 years.",
          },
        ],
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        notes: "Current active contract with USD rate raise and individual health coverage.",
        createdAt: "2024-07-01T00:00:00.000Z",
        updatedAt: "2024-07-01T00:00:00.000Z",
      },
    ],
  };

  // 2. Past Company Track (Past Accepted with 1-Year Rate Raise)
  const pastTrackId = "track-past-employer";
  const pastRev1Id = "rev-past-year1";
  const pastRev2Id = "rev-past-year2";

  const pastTrack: OfferTrack = {
    id: pastTrackId,
    companyName: "Nexus FinTech Labs",
    roleTitle: "Senior Backend Developer",
    status: "past_accepted",
    notes: "Historical employer. Demonstrates 1-year annual raise progression in real CPI-adjusted terms.",
    createdAt: "2023-03-01T00:00:00.000Z",
    updatedAt: "2024-03-01T00:00:00.000Z",
    activeRevisionId: pastRev2Id,
    revisions: [
      {
        id: pastRev1Id,
        trackId: pastTrackId,
        title: "Year 1: 110 PLN/hr (Historical)",
        effectiveDate: "2023-03",
        isHistorical: true,
        rateSpec: { period: "hourly", amount: 110, currency: "PLN" },
        timeOff: {
          model: "model_c_unpaid",
          plannedVacationDays: 20,
          estimatedSickDays: 5,
          stateHolidaysTaken: 13,
        },
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "preferencyjny",
          monthlyAccountingCostPln: 200,
          voluntarySickness: false,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        benefits: [],
        equityGrants: [],
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        createdAt: "2023-03-01T00:00:00.000Z",
        updatedAt: "2023-03-01T00:00:00.000Z",
      },
      {
        id: pastRev2Id,
        trackId: pastTrackId,
        title: "Year 2: 130 PLN/hr Raise (Historical)",
        effectiveDate: "2024-03",
        isHistorical: true,
        rateSpec: { period: "hourly", amount: 130, currency: "PLN" },
        timeOff: {
          model: "model_c_unpaid",
          plannedVacationDays: 20,
          estimatedSickDays: 5,
          stateHolidaysTaken: 13,
        },
        taxProfile: {
          regime: "b2b_ryczalt",
          ryczaltRatePct: 12,
          zusStage: "duzy_zus",
          monthlyAccountingCostPln: 200,
          voluntarySickness: true,
          pfronRebate: { enabled: false, type: "percentage", percentage: 0, fixedAmountPln: 0 },
        },
        benefits: [],
        equityGrants: [],
        expectedWeeklyHours: 40,
        allowsSideGig: true,
        createdAt: "2024-03-01T00:00:00.000Z",
        updatedAt: "2024-03-01T00:00:00.000Z",
      },
    ],
  };

  // 3. Negotiating Offer Track (UoP with 50% AKUP & Startup Options)
  const negTrackId = "track-negotiating-fintech";
  const negRev1Id = "rev-negotiating-uop";

  const negotiatingTrack: OfferTrack = {
    id: negTrackId,
    companyName: "Horizon Security AI",
    roleTitle: "Lead AI Platform Architect",
    status: "negotiating",
    notes: "Active offer in final negotiation stage. Umowa o Pracę with 50% AKUP and ESOP.",
    createdAt: "2025-01-10T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z",
    activeRevisionId: negRev1Id,
    revisions: [
      {
        id: negRev1Id,
        trackId: negTrackId,
        title: "Rev 1: UoP 32k Gross + 50% AKUP",
        effectiveDate: "2025-02",
        rateSpec: { period: "monthly", amount: 32000, currency: "PLN" },
        timeOff: {
          model: "model_a_separate",
          paidVacationDays: 26,
          paidSickDays: 5,
          sickPayPct: 80,
          paidStateHolidays: 13,
        },
        taxProfile: {
          regime: "uop",
          hasAkup: true,
          creativeWorkPct: 80,
          ppkEmployeePct: 2,
          ppkEmployerPct: 1.5,
          jointTaxFiling: false,
          disabilityRights: {
            enabled: false,
            statutoryHoursPerWeek: 35,
            extraVacationDays: 10,
          },
        },
        benefits: [
          {
            id: "ben-neg-health",
            name: "LuxMed VIP Family Package",
            category: "health",
            nominalValuePln: 550,
            monthlyBudgetOffsetPln: 450,
            subjectiveUtilityWeightPct: 20,
            tier: "family",
            spouseCopayMonthlyPln: 0,
            linkedExternalProviderCategory: "Medicine",
          },
          {
            id: "ben-neg-learn",
            name: "Annual Learning & Tech Stipend",
            category: "learning",
            nominalValuePln: 600,
            monthlyBudgetOffsetPln: 300,
            subjectiveUtilityWeightPct: 50,
            tier: "individual",
            linkedExternalProviderCategory: "Learning",
          },
        ],
        equityGrants: [
          {
            id: "eq-neg-esop",
            type: "esop",
            isLiquid: false,
            totalGrantValue: 50000,
            currency: "USD",
            vestingYears: 4,
            cliffMonths: 12,
            volatilityDiscountPct: 0,
            belkaTaxPct: 19,
            notes: "Series B Stock Options (ESOP). Tracked as paper upside.",
          },
        ],
        expectedWeeklyHours: 40,
        allowsSideGig: false,
        notes: "Full employment rights with 80% creative copyright deduction.",
        createdAt: "2025-01-10T00:00:00.000Z",
        updatedAt: "2025-01-10T00:00:00.000Z",
      },
    ],
  };

  return [currentTrack, pastTrack, negotiatingTrack];
}

// ---------------------------------------------------------------------------
// Repository Interface & LocalStorage Implementation
// ---------------------------------------------------------------------------

export interface OfferRepository {
  load(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }>;
  save(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): Promise<void>;
  exportJson(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): string;
  importJson(jsonString: string): { tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig };
  resetToDefaults(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }>;
}

export class LocalStorageOfferRepository implements OfferRepository {
  private memoryPayload: OfferComparatorStoragePayload | null = null;
  private readonly storageKey: string;

  constructor(storageKey = OFFER_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  private isLocalStorageAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  public async load(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }> {
    if (this.isLocalStorageAvailable()) {
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as OfferComparatorStoragePayload;
          if (parsed && parsed.version === 1 && Array.isArray(parsed.tracks)) {
            return {
              tracks: parsed.tracks,
              globalConfig: { ...DEFAULT_COMPARATOR_CONFIG, ...(parsed.globalConfig || {}) },
            };
          }
        }
      } catch (e) {
        console.warn("Failed to load offer comparator state from localStorage, initializing defaults", e);
      }
    }

    if (this.memoryPayload) {
      return {
        tracks: this.memoryPayload.tracks,
        globalConfig: this.memoryPayload.globalConfig,
      };
    }

    // Default seed
    const defaultTracks = getDefaultStarterTracks();
    const defaultPayload: OfferComparatorStoragePayload = {
      version: 1,
      tracks: defaultTracks,
      globalConfig: DEFAULT_COMPARATOR_CONFIG,
    };

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(defaultPayload));
      } catch {
        // quota exceeded or private mode
      }
    }
    this.memoryPayload = defaultPayload;

    return {
      tracks: defaultTracks,
      globalConfig: DEFAULT_COMPARATOR_CONFIG,
    };
  }

  public async save(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): Promise<void> {
    const payload: OfferComparatorStoragePayload = {
      version: 1,
      tracks,
      globalConfig,
    };

    this.memoryPayload = payload;

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      } catch (e) {
        console.error("Failed to save offer comparator state to localStorage", e);
      }
    }
  }

  public exportJson(tracks: OfferTrack[], globalConfig: ComparatorGlobalConfig): string {
    const payload: OfferComparatorStoragePayload = {
      version: 1,
      tracks,
      globalConfig,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  }

  public importJson(jsonString: string): { tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error("Invalid JSON format. Please upload a valid JSON file.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("JSON payload must be a non-null object.");
    }

    const payload = parsed as Partial<OfferComparatorStoragePayload>;
    if (payload.version !== 1) {
      throw new Error(`Unsupported schema version: ${payload.version ?? "unknown"}. Expected version 1.`);
    }

    if (!Array.isArray(payload.tracks)) {
      throw new Error("Invalid JSON payload: 'tracks' must be an array.");
    }

    // Basic track validation
    for (const track of payload.tracks) {
      if (!track.id || !track.companyName || !Array.isArray(track.revisions)) {
        throw new Error(`Track '${track.companyName ?? "unknown"}' is missing required id or revisions.`);
      }
    }

    const globalConfig: ComparatorGlobalConfig = {
      ...DEFAULT_COMPARATOR_CONFIG,
      ...(payload.globalConfig ?? {}),
    };

    return {
      tracks: payload.tracks,
      globalConfig,
    };
  }

  public async resetToDefaults(): Promise<{ tracks: OfferTrack[]; globalConfig: ComparatorGlobalConfig }> {
    const defaultTracks = getDefaultStarterTracks();
    await this.save(defaultTracks, DEFAULT_COMPARATOR_CONFIG);
    return {
      tracks: defaultTracks,
      globalConfig: DEFAULT_COMPARATOR_CONFIG,
    };
  }
}
