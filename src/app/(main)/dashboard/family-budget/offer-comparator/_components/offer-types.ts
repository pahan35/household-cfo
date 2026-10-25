/**
 * Offer Comparator Domain Types & Data Models
 *
 * Models offer tracks, chronological revisions, time-off policies,
 * Polish B2B/UoP/PFRON tax structures, two-layer benefits, equity,
 * fractional side-gigs, and comparator global configurations.
 */

export type OfferTrackStatus = "current" | "negotiating" | "past_accepted" | "past_declined";

export type RatePeriod = "hourly" | "monthly" | "annual";

export interface RateSpecification {
  period: RatePeriod;
  amount: number;
  currency: "PLN" | "USD" | "EUR" | string;
}

// ---------------------------------------------------------------------------
// Time-Off Policies
// ---------------------------------------------------------------------------

export type TimeOffModelType = "model_a_separate" | "model_b_combined" | "model_c_unpaid";

export interface TimeOffModelASeparate {
  model: "model_a_separate";
  /** Paid vacation days per year (default 26 on Polish UoP standard) */
  paidVacationDays: number;
  /** Estimated paid sick days per year (default e.g. 5) */
  paidSickDays: number;
  /** Sick pay coverage percentage (default 80%) */
  sickPayPct: number;
  /** Paid state holidays recognized (default 13 on Polish calendar) */
  paidStateHolidays: number;
}

export interface TimeOffModelBCombined {
  model: "model_b_combined";
  /** Total combined PTO pool in days (e.g. 30 days) */
  combinedPtoDays: number;
  /** Whether weekday state holidays are deducted from the combined pool */
  stateHolidaysDeductedFromPool: boolean;
  /** Paid state holidays count (default 13) */
  paidStateHolidaysCount: number;
}

export interface TimeOffModelCUnpaid {
  model: "model_c_unpaid";
  /** Planned unpaid vacation days taken per year (e.g. 24) */
  plannedVacationDays: number;
  /** Estimated unpaid sick days per year (e.g. 5) */
  estimatedSickDays: number;
  /** State holidays taken unpaid (default 13) */
  stateHolidaysTaken: number;
  /** Optional PTO hourly rate markup percentage applied to quote */
  ptoRateMarkupPct?: number;
}

export type TimeOffPolicy = TimeOffModelASeparate | TimeOffModelBCombined | TimeOffModelCUnpaid;

// ---------------------------------------------------------------------------
// Polish Tax & ZUS Profiles
// ---------------------------------------------------------------------------

export type TaxRegime = "b2b_ryczalt" | "b2b_liniowy" | "b2b_skala" | "uop" | "custom";

export type ZusStage = "ulga_na_start" | "preferencyjny" | "duzy_zus";

export interface PfronRebateConfig {
  enabled: boolean;
  /** Rebate type: percentage of ZUS Społeczny (e.g. 60%) or fixed PLN/mo */
  type: "percentage" | "fixed_pln";
  /** Percentage of pension + disability ZUS refunded (0–100%) */
  percentage: number;
  /** Fixed monthly PLN cashback amount */
  fixedAmountPln: number;
}

export interface UopDisabilityConfig {
  /** If enabled, grants statutory 7h/day (35h/week) work norm and +10 extra vacation days */
  enabled: boolean;
  /** Statutory working hours per week (default 35h) */
  statutoryHoursPerWeek: number;
  /** Extra annual statutory paid vacation days (default 10 days) */
  extraVacationDays: number;
}

export interface TaxProfileB2bRyczalt {
  regime: "b2b_ryczalt";
  /** Ryczałt rate percentage (e.g. 12, 8.5, 15, 17) */
  ryczaltRatePct: number;
  /** Social security stage */
  zusStage: ZusStage;
  /** Monthly accounting fee in PLN (default e.g. 250) */
  monthlyAccountingCostPln: number;
  /** PFRON ZUS Społeczny cashback rebate config */
  pfronRebate: PfronRebateConfig;
  /** Voluntary sickness insurance (chorobowe) */
  voluntarySickness: boolean;
}

export interface TaxProfileB2bLiniowy {
  regime: "b2b_liniowy";
  /** Flat PIT rate percentage (standard 19%) */
  pitRatePct: number;
  /** Health insurance rate percentage (standard 4.9% with statutory minimum) */
  healthRatePct: number;
  /** Estimated monthly tax-deductible business expenses in PLN (excluding ZUS/accounting) */
  monthlyDeductibleCostsPln: number;
  /** Monthly accounting fee in PLN (default e.g. 250) */
  monthlyAccountingCostPln: number;
  /** Social security stage */
  zusStage: ZusStage;
  /** PFRON ZUS Społeczny cashback rebate config */
  pfronRebate: PfronRebateConfig;
  /** Voluntary sickness insurance */
  voluntarySickness: boolean;
}

export interface TaxProfileB2bSkala {
  regime: "b2b_skala";
  /** Estimated monthly tax-deductible business expenses in PLN */
  monthlyDeductibleCostsPln: number;
  /** Monthly accounting fee in PLN */
  monthlyAccountingCostPln: number;
  /** Social security stage */
  zusStage: ZusStage;
  /** PFRON ZUS Społeczny cashback rebate config */
  pfronRebate: PfronRebateConfig;
  /** Voluntary sickness insurance */
  voluntarySickness: boolean;
}

export interface TaxProfileUop {
  regime: "uop";
  /** Autorskie Koszty Uzyskania Przychodu (50% AKUP) enabled */
  hasAkup: boolean;
  /** Percentage of salary qualified for creative copyright work (0–100%, e.g. 80%) */
  creativeWorkPct: number;
  /** Employee PPK contribution percentage (0% or standard 2.0%) */
  ppkEmployeePct: number;
  /** Employer PPK contribution percentage (0% or standard 1.5%) */
  ppkEmployerPct: number;
  /** Joint tax filing with non-earning or lower-earning spouse */
  jointTaxFiling: boolean;
  /** Statutory disability rights (35h/wk norm and +10 vacation days) */
  disabilityRights: UopDisabilityConfig;
}

export interface TaxProfileCustom {
  regime: "custom";
  /** Flat percentage of gross income deducted for taxes & contributions */
  effectiveTaxRatePct: number;
  /** Static monthly flat deduction in PLN */
  staticMonthlyCostPln: number;
}

export type TaxProfile =
  | TaxProfileB2bRyczalt
  | TaxProfileB2bLiniowy
  | TaxProfileB2bSkala
  | TaxProfileUop
  | TaxProfileCustom;

// ---------------------------------------------------------------------------
// Benefits & Equity
// ---------------------------------------------------------------------------

export type BenefitCategory =
  | "health"
  | "sport"
  | "learning"
  | "mental_health"
  | "massage"
  | "lunch"
  | "gift"
  | "equipment"
  | "sabbatical"
  | "bonus"
  | "other";

export type BenefitCoverageTier = "individual" | "family";

export interface BenefitItem {
  id: string;
  name: string;
  category: BenefitCategory;
  /** Nominal company value or package sticker price in PLN/month */
  nominalValuePln: number;
  /**
   * Layer 1: Hard Budget Offset in PLN/month.
   * Replaces real ExternalProvider household out-of-pocket spending.
   */
  monthlyBudgetOffsetPln: number;
  /**
   * Layer 2: Subjective Utility Weight (0–100%).
   * Applied to perceived utility of non-offset perks.
   */
  subjectiveUtilityWeightPct: number;
  /** Health/insurance coverage tier */
  tier?: BenefitCoverageTier;
  /**
   * Optional monthly spouse add-on co-pay deducted when individual tier is provided
   * but family coverage is required.
   */
  spouseCopayMonthlyPln?: number;
  /** Optional linked ExternalProvider category identifier */
  linkedExternalProviderCategory?: string;
  /** Optional notes */
  notes?: string;
}

export type EquityType = "rsu" | "esop";

export interface EquityGrant {
  id: string;
  type: EquityType;
  /** Total initial grant value */
  totalGrantValue: number;
  currency: "PLN" | "USD" | "EUR";
  /** Vesting period in years (default 4) */
  vestingYears: number;
  /** Cliff in months (default 12) */
  cliffMonths: number;
  /** Volatility discount applied to liquid RSUs (e.g. 15%) */
  volatilityDiscountPct: number;
  /** Belka capital gains tax percentage (standard 19%) */
  belkaTaxPct: number;
  /** Publicly traded liquid stock (RSU) vs. illiquid startup options (ESOP) */
  isLiquid: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Side-Gig Addon
// ---------------------------------------------------------------------------

export interface SideGigAddon {
  enabled: boolean;
  roleTitle: string;
  rateSpec: RateSpecification;
  hoursPerWeek: number;
  taxProfile: TaxProfile;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Revisions & Tracks
// ---------------------------------------------------------------------------

export interface OfferRevision {
  id: string;
  trackId: string;
  title: string;
  /** Effective month key, e.g. "2024-03" or ISO string */
  effectiveDate: string;
  isHistorical?: boolean;
  rateSpec: RateSpecification;
  timeOff: TimeOffPolicy;
  taxProfile: TaxProfile;
  benefits: BenefitItem[];
  equityGrants: EquityGrant[];
  sideGig?: SideGigAddon;
  /** Real expected weekly working hours (e.g. 40h or 35h) */
  expectedWeeklyHours: number;
  /** Exclusivity/non-compete policy allows fractional side-gig */
  allowsSideGig: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferTrack {
  id: string;
  companyName: string;
  roleTitle: string;
  status: OfferTrackStatus;
  revisions: OfferRevision[];
  activeRevisionId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Global Comparator Assumptions & Configuration
// ---------------------------------------------------------------------------

export interface ComparatorGlobalConfig {
  /** Working weekdays per year on Polish calendar (standard 252) */
  defaultWorkingDaysPerYear: number;
  /** Weekday state holidays per year on Polish calendar (standard 13) */
  defaultStateHolidaysCount: number;
  /** Standard hours per working day (standard 8) */
  workingHoursPerDay: number;
  /** Projected annual growth rate for static costs and ZUS bases (default 0.07 / 7%) */
  annualStaticCostGrowthPct: number;
  /**
   * Currency-specific pessimistic buffer percentage.
   * e.g. { USD: 0.05, EUR: 0.03 } reduces effective exchange rate by 5% and 3%.
   */
  fxPessimisticBufferPct: Record<string, number>;
  /** Manual FX rate overrides against PLN (e.g. { USD: 3.95 }) */
  manualFxOverrides: Record<string, number>;
  /** User's baseline monthly living expenses from ExternalProvider in PLN */
  targetMonthlyExpensePln: number;
  /** Monthly savings goal in PLN */
  targetMonthlySavingsPln: number;
  /** Selected multi-year projection horizon (Year 1, 2, or 3) */
  activeYearProjection: 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Calculation Engine Result Structures
// ---------------------------------------------------------------------------

export interface AnnualTaxBreakdown {
  annualGrossPln: number;
  annualZusSpolecznyPln: number;
  annualPfronRebatePln: number;
  annualNetZusSpolecznyPln: number;
  annualHealthInsurancePln: number;
  annualPitPln: number;
  annualAccountingCostPln: number;
  annualPpkEmployeePln: number;
  annualPpkEmployerPln: number;
  annualTotalTaxesAndContributionsPln: number;
  annualNetCashflowPln: number;
  monthlyNetCashflowPln: number;
  effectiveTaxRatePct: number;
}

export interface MultiYearTaxProjection {
  year1: AnnualTaxBreakdown;
  year2: AnnualTaxBreakdown;
  year3: AnnualTaxBreakdown;
  zusBaseGrowthPct: number;
}

export interface NormalizedCompensationSummary {
  annualGrossRevenuePln: number;
  monthlyGrossRevenuePln: number;
  annualBillableHours: number;
  effectiveWorkingDays: number;
  timeOffDaysTaken: number;
  effectiveExchangeRate: number;
  taxBreakdown: AnnualTaxBreakdown;
  multiYearTax: MultiYearTaxProjection;
  monthlyHardBudgetOffsetPln: number;
  monthlySubjectiveUtilityPln: number;
  monthlyLiquidEquityPln: number;
  hasIlliquidEquity: boolean;
  totalIlliquidEquityNominalPln: number;
  /** Hard Monthly Cashflow = Monthly Net from Job + Hard Budget Offsets + Liquid Equity */
  hardNetMonthlyCashflowPln: number;
  /** Total Perceived Comp = Hard Monthly Cashflow + Subjective Perks */
  totalPerceivedMonthlyCompPln: number;
  effectiveNetHourlyRatePln: number;
  sideGigSummary?: {
    combinedGrossMonthlyPln: number;
    combinedNetMonthlyPln: number;
    marginalNetMonthlyPln: number;
    marginalNetHourlyRatePln: number;
    totalWeeklyHours: number;
    crossesHealthTier: boolean;
    crossesTaxBracket: boolean;
  };
}

export interface RestructureImpactDiff {
  baseTrackId: string;
  baseRevisionId: string;
  targetRevisionId: string;
  monthlyGrossDeltaPln: number;
  fxBufferDragPln: number;
  netCashflowDeltaPln: number;
  benefitOffsetDeltaPln: number;
  spouseDowngradeCostPln: number;
  realPurchasingPowerDeltaPln?: number;
  effectiveHourlyRateDeltaPln: number;
  netMonthlyGainPln: number;
}
