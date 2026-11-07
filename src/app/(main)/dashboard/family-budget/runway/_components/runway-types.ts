import type {
  PfronRebateConfig,
  ZusStage,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";

export type JdgPosture = "active" | "wakacje_skladkowe" | "suspended";

export type JdgTaxRegime = "b2b_ryczalt" | "b2b_liniowy" | "b2b_skala";

export type RyczaltYtdHealthTier = "tier1" | "tier2" | "tier3";

export type LookbackWindow = "1m" | "3m" | "6m" | "12m";

export interface Month1TaxTailConfig {
  enabled: boolean;
  vat7AmountPln: number;
  ppeAmountPln: number;
  autoDetectedVat7Pln?: number;
  autoDetectedPpePln?: number;
  referenceMonth?: string;
}

export interface JdgRunwayConfig {
  posture: JdgPosture;
  regime: JdgTaxRegime;
  zusStage: ZusStage;
  voluntarySickness: boolean;
  ryczaltYtdHealthTier: RyczaltYtdHealthTier;
  pfronRebate: PfronRebateConfig;
  monthlyAccountingCostPln: number;
  suspendedAccountingCostPln: number;
  voluntaryNfzWhenSuspended: boolean;
  statutoryVoluntaryNfzPln: number;
  wakacjeMonthIndex: number; // 1-12 (e.g. 12 for December)
  includeMonth1TaxTail: boolean;
  month1Vat7Pln: number;
  month1PpePln: number;
  benefitLossReplacementPln: number;
  residualMonthlyIncomePln: number;
}

export interface CapitalPoolItem {
  id: string;
  name: string;
  categoryType: number;
  accountType?: string;
  nativeBalance: number;
  currencyCode: string;
  convertedPln: number;
  included: boolean;
  isOffBalance?: boolean;
  isGoal?: boolean;
}

export interface CapitalPoolConfig {
  excludedItemIds: string[];
  includeOffBalanceAccounts: boolean;
  includeGoals: boolean;
  safetyFloorPln: number;
  fxHaircutPct: number; // -15% to +15%
}

export interface CapitalPoolSummary {
  totalGrossPln: number;
  fxAdjustmentPln: number;
  safetyFloorPln: number;
  usableCapitalPln: number;
  items: CapitalPoolItem[];
}

export interface CategoryAusterityWeight {
  enabled: boolean;
  retentionPct: number; // 0 to 150
}

export interface CategoryAusterityItem {
  id: string;
  name: string;
  baselineMonthlyBurnPln: number;
  retentionPct: number;
  enabled: boolean;
  isFixed: boolean;
  childCategoryIds: string[];
}

export interface AusterityPreset {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  weights: Record<string, CategoryAusterityWeight>;
}

export interface RunwayCashflowRow {
  monthIndex: number; // 1..60
  yearMonth: string; // YYYY-MM
  calendarYear: number;
  calendarMonth: number; // 1..12
  startingBalancePln: number;
  grossZusPln: number;
  pfronRebatePln: number;
  netZusPln: number;
  healthPln: number;
  isRyczaltTier1Reset: boolean;
  isWakacjeSkladkoweMonth: boolean;
  accountingPln: number;
  month1TaxTailPln: number;
  totalJdgObligationsPln: number;
  livingBurnPln: number;
  benefitReplacementPln: number;
  residualIncomePln: number;
  netCashflowPln: number;
  endingBalancePln: number;
  isDepleted: boolean;
}

export interface RunwayScenarioResult {
  usableStartingCapitalPln: number;
  usableCapitalAfterTaxTailPln: number;
  month1OutflowPln: number;
  ongoingMonthlyBurnPln: number;
  runwayMonths: number;
  exhaustionDate: string | null;
  exhaustionYearMonth: string | null;
  isCashflowPositive: boolean;
  rows: RunwayCashflowRow[];
}

export interface RunwayScenario {
  id: string;
  name: string;
  isPrimary: boolean;
  jdgConfig: JdgRunwayConfig;
  capitalPoolConfig: CapitalPoolConfig;
  lookbackWindow: LookbackWindow;
  activePresetId: string;
  customPresets: AusterityPreset[];
  categoryCuts: Record<string, CategoryAusterityWeight>;
  baselineOfferRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunwaySimulatorStoragePayload {
  version: 1 | 2;
  // Legacy v1 fields
  jdgConfig?: Partial<JdgRunwayConfig>;
  capitalPoolConfig?: CapitalPoolConfig;
  lookbackWindow?: LookbackWindow;
  activePresetId?: string;
  customPresets?: AusterityPreset[];
  categoryWeights?: Record<string, CategoryAusterityWeight>;
  // Multi-scenario v2 fields
  scenarios?: RunwayScenario[];
  activeScenarioId?: string;
  updatedAt?: string;
}
