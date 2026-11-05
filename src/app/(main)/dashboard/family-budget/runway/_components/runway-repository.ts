import {
  OFFER_STORAGE_KEY,
  type OfferComparatorStoragePayload,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-repository";
import type {
  OfferRevision,
  OfferTrack,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";

import { DEFAULT_CAPITAL_POOL_CONFIG, DEFAULT_JDG_RUNWAY_CONFIG } from "./runway-engine";
import type { JdgRunwayConfig, JdgTaxRegime, RunwaySimulatorStoragePayload } from "./runway-types";

export const RUNWAY_STORAGE_KEY = "family-budget:runway-simulator:v1";

export const DEFAULT_RUNWAY_STORAGE_PAYLOAD: RunwaySimulatorStoragePayload = {
  version: 1,
  jdgConfig: DEFAULT_JDG_RUNWAY_CONFIG,
  capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
  lookbackWindow: "3m",
  activePresetId: "preset-normal",
  customPresets: [],
  categoryWeights: {},
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class RunwayRepository {
  private memoryPayload: RunwaySimulatorStoragePayload | null = null;
  private readonly storageKey: string;
  private readonly storage: StorageLike | null = null;

  constructor(storageKey = RUNWAY_STORAGE_KEY, customStorage?: StorageLike) {
    this.storageKey = storageKey;
    if (customStorage) {
      this.storage = customStorage;
    } else if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
  }

  /**
   * Reads the active "current" track from OfferRepository (if available) and
   * extracts initial JDG tax profile settings and benefit replacement cost.
   */
  public async seedJdgConfigFromOfferRepository(): Promise<Partial<JdgRunwayConfig>> {
    if (!this.storage) {
      return {};
    }

    try {
      const rawOffers = this.storage.getItem(OFFER_STORAGE_KEY);
      if (!rawOffers) return {};

      const parsed = JSON.parse(rawOffers) as OfferComparatorStoragePayload | null;
      if (parsed?.version !== 1 || !Array.isArray(parsed.tracks)) {
        return {};
      }

      // Find active current track
      const currentTrack: OfferTrack | undefined =
        parsed.tracks.find((t) => t.status === "current") ?? parsed.tracks[0];

      if (!currentTrack || !Array.isArray(currentTrack.revisions) || currentTrack.revisions.length === 0) {
        return {};
      }

      const activeRev: OfferRevision | undefined =
        currentTrack.revisions.find((r) => r.id === currentTrack.activeRevisionId) ??
        currentTrack.revisions[currentTrack.revisions.length - 1];

      if (!activeRev) return {};

      const partialConfig: Partial<JdgRunwayConfig> = {};

      const profile = activeRev.taxProfile;
      if (
        profile &&
        (profile.regime === "b2b_ryczalt" || profile.regime === "b2b_liniowy" || profile.regime === "b2b_skala")
      ) {
        partialConfig.regime = profile.regime as JdgTaxRegime;
        partialConfig.zusStage = profile.zusStage;
        partialConfig.voluntarySickness = Boolean(profile.voluntarySickness);
        partialConfig.pfronRebate = profile.pfronRebate;
        if (typeof profile.monthlyAccountingCostPln === "number") {
          partialConfig.monthlyAccountingCostPln = profile.monthlyAccountingCostPln;
        }
      }

      // Calculate benefit replacement cost from lost benefits
      if (Array.isArray(activeRev.benefits) && activeRev.benefits.length > 0) {
        const replacementCost = activeRev.benefits.reduce((sum, b) => {
          return sum + (b.monthlyBudgetOffsetPln ?? b.nominalValuePln ?? 0);
        }, 0);
        if (replacementCost > 0) {
          partialConfig.benefitLossReplacementPln = replacementCost;
        }
      }

      return partialConfig;
    } catch (e) {
      console.warn("Failed to seed JDG posture from OfferRepository:", e);
      return {};
    }
  }

  public async load(): Promise<RunwaySimulatorStoragePayload> {
    if (this.storage) {
      try {
        const raw = this.storage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as RunwaySimulatorStoragePayload;
          if (parsed && parsed.version === 1) {
            return {
              ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
              ...parsed,
              jdgConfig: {
                ...DEFAULT_JDG_RUNWAY_CONFIG,
                ...parsed.jdgConfig,
              },
              capitalPoolConfig: {
                ...DEFAULT_CAPITAL_POOL_CONFIG,
                ...parsed.capitalPoolConfig,
              },
            };
          }
        }
      } catch (e) {
        console.warn("Failed to load runway simulator state from storage:", e);
      }
    }

    if (this.memoryPayload) {
      return this.memoryPayload;
    }

    // Default initialization with offer repo seeding attempt
    const seededJdg = await this.seedJdgConfigFromOfferRepository();
    const initialPayload: RunwaySimulatorStoragePayload = {
      ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
      jdgConfig: {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        ...seededJdg,
      },
    };

    if (this.storage) {
      try {
        this.storage.setItem(this.storageKey, JSON.stringify(initialPayload));
      } catch {
        // storage quota exceeded or private mode
      }
    }

    this.memoryPayload = initialPayload;
    return initialPayload;
  }

  public async save(payload: RunwaySimulatorStoragePayload): Promise<void> {
    const dataToSave: RunwaySimulatorStoragePayload = {
      ...payload,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    this.memoryPayload = dataToSave;

    if (this.storage) {
      try {
        this.storage.setItem(this.storageKey, JSON.stringify(dataToSave));
      } catch (e) {
        console.error("Failed to save runway simulator state to storage:", e);
      }
    }
  }

  public async resetToDefaults(): Promise<RunwaySimulatorStoragePayload> {
    const seededJdg = await this.seedJdgConfigFromOfferRepository();
    const resetPayload: RunwaySimulatorStoragePayload = {
      ...DEFAULT_RUNWAY_STORAGE_PAYLOAD,
      jdgConfig: {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        ...seededJdg,
      },
    };

    await this.save(resetPayload);
    return resetPayload;
  }
}

export const runwayRepository = new RunwayRepository();
