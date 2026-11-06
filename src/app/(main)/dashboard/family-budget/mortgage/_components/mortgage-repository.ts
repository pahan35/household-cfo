import {
  DEFAULT_HOME_GOAL_TRACKING_CONFIG,
  DEFAULT_MORTGAGE_FINANCING_CONFIG,
  DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
  DEFAULT_OVERLAP_TIMELINE_CONFIG,
  DEFAULT_PROPERTY_ACQUISITION_CONFIG,
} from "./mortgage-engine";
import type { MortgageSimulatorConfig, MortgageSimulatorStoragePayload } from "./mortgage-types";

export const MORTGAGE_STORAGE_KEY = "family-budget:mortgage-simulator:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MortgageRepository {
  private readonly storageKey: string;
  private readonly storage: StorageLike | null = null;

  constructor(storageKey = MORTGAGE_STORAGE_KEY, customStorage?: StorageLike) {
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
   * Loads persisted mortgage simulator config from localStorage.
   * Gracefully falls back to default settings if empty, invalid, or corrupted.
   */
  public loadConfig(): MortgageSimulatorConfig {
    if (!this.storage) {
      return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
      }

      const parsed = JSON.parse(raw) as MortgageSimulatorStoragePayload | null;
      if (parsed?.version !== 1 || !parsed.config) {
        return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
      }

      // Deeply merge with defaults to ensure complete config even if fields were added in updates
      return {
        property: {
          ...DEFAULT_PROPERTY_ACQUISITION_CONFIG,
          ...parsed.config.property,
        },
        financing: {
          ...DEFAULT_MORTGAGE_FINANCING_CONFIG,
          ...parsed.config.financing,
        },
        overlap: {
          ...DEFAULT_OVERLAP_TIMELINE_CONFIG,
          ...parsed.config.overlap,
        },
        goalTracking: {
          ...DEFAULT_HOME_GOAL_TRACKING_CONFIG,
          ...parsed.config.goalTracking,
          linkedGoalCategoryIds: Array.isArray(parsed.config.goalTracking.linkedGoalCategoryIds)
            ? parsed.config.goalTracking.linkedGoalCategoryIds
            : [],
        },
      };
    } catch {
      return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
    }
  }

  /**
   * Persists simulator configuration to localStorage.
   */
  public saveConfig(config: MortgageSimulatorConfig): void {
    if (!this.storage) {
      return;
    }

    try {
      const payload: MortgageSimulatorStoragePayload = {
        version: 1,
        config,
      };
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota errors in constrained environments
    }
  }

  /**
   * Clears persisted configuration and resets to project defaults.
   */
  public resetToDefaults(): MortgageSimulatorConfig {
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore removal error
      }
    }
    return DEFAULT_MORTGAGE_SIMULATOR_CONFIG;
  }
}
