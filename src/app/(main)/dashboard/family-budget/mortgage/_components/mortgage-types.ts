export type PropertyPricingMode = "area_and_price_per_sqm" | "total_price";

export type RenovationFundingMode = "cash" | "mortgage";

export type InstallmentType = "equal" | "decreasing";

export type LookbackWindow = "3m" | "6m" | "12m" | "all";

export interface PropertyAcquisitionConfig {
  pricingMode: PropertyPricingMode;
  areaSqm: number;
  pricePerSqmPln: number;
  customTotalPricePln: number;
  includeParking: boolean;
  parkingPricePln: number;
  includeStorage: boolean;
  storagePricePln: number;
  renovationBudgetPln: number;
  renovationContingencyPct: number; // 0 to 25% (e.g. 10)
  renovationFundingMode: RenovationFundingMode;
  bankValuationFeePln: number; // default ~500 PLN
  customNotaryFeePln?: number; // optional manual override
}

export interface MortgageFinancingConfig {
  downPaymentPct: number; // e.g. 10, 15, 20, 25, 30
  loanTermYears: number; // e.g. 15 to 35, default 25 or 30
  referenceRatePct: number; // e.g. 5.15% (WIBOR/WIRON)
  bankMarginPct: number; // e.g. 1.85%
  rateStressDeltaPct: number; // -2.0% to +3.0%, default 0
  installmentType: InstallmentType;
}

export interface OverlapTimelineConfig {
  monthsToSigning: number; // default 6
  constructionWaitMonths: number; // default 18
  finishingOverlapMonths: number; // default 3
  currentMonthlyRentPln: number; // default 3500
  newCommunityAdminFeePln: number; // czynsz administracyjny, default 900
  averageTrancheDrawnPctDuringConstruction: number; // default 50%
}

export interface HomeGoalTrackingConfig {
  linkedGoalCategoryIds: string[];
  customMonthlyNetIncomeFallbackPln?: number;
  lookbackWindow: LookbackWindow;
}

export interface MortgageSimulatorConfig {
  property: PropertyAcquisitionConfig;
  financing: MortgageFinancingConfig;
  overlap: OverlapTimelineConfig;
  goalTracking: HomeGoalTrackingConfig;
}

export interface NotaryFeeBreakdown {
  baseFeePln: number;
  vatPln: number; // 23% VAT
  totalNotaryWithVatPln: number;
  buyerSharePln: number; // typically 50% for developer agreement / preliminary, or 100% for final conveyance
}

export interface CourtFeesBreakdown {
  ownershipRegisterEntryPln: number; // 200 PLN
  mortgageRegisterEntryPln: number; // 200 PLN
  pcc3MortgageTaxPln: number; // 19 PLN
  totalCourtFeesPln: number; // 419 PLN
}

export interface PropertyAcquisitionSummary {
  apartmentPricePln: number;
  parkingPricePln: number;
  storagePricePln: number;
  propertyTotalPln: number;
  renovationBasePln: number;
  renovationContingencyPln: number;
  renovationTotalPln: number;
  projectTotalPln: number; // propertyTotal + (renovationTotal if mortgage bundled)
  pccTaxPln: number; // 0 PLN (0% PCC for primary market)
  pccTaxRatePct: number; // 0
  notaryFees: NotaryFeeBreakdown;
  courtFees: CourtFeesBreakdown;
  bankFeesPln: number;
  totalClosingFeesPln: number;
  downPaymentPln: number;
  loanPrincipalPln: number;
  upfrontCashMilestone1Pln: number; // Down Payment + Closing fees
  upfrontCashMilestone2Pln: number; // Cash renovation if cash-funded
  totalCashRequiredPln: number; // Milestone 1 + Milestone 2
}

export interface AmortizationMonthSchedule {
  monthIndex: number;
  installmentTotalPln: number;
  principalPartPln: number;
  interestPartPln: number;
  remainingPrincipalPln: number;
}

export interface AmortizationSummary {
  effectiveRatePct: number;
  nominalRatePct: number;
  monthlyRate: number;
  totalMonths: number;
  firstMonthInstallmentPln: number;
  lastMonthInstallmentPln: number;
  totalPaymentPln: number;
  totalInterestPln: number;
  schedule: AmortizationMonthSchedule[];
}

export interface OverlapPhaseCashflow {
  phaseKey: "saving" | "construction" | "finishing" | "steady_state";
  phaseTitle: string;
  durationMonths: number;
  monthlyRentPln: number;
  monthlyMortgagePln: number;
  monthlyAdminFeePln: number;
  monthlyTotalHousingCostPln: number;
  totalPhaseOutflowPln: number;
}

export interface OverlapTimelineSummary {
  phases: OverlapPhaseCashflow[];
  peakMonthlyHousingCostPln: number;
  peakPhaseKey: "saving" | "construction" | "finishing" | "steady_state";
  totalOverlapCostPln: number; // Total cost spent on rent + mortgage before full move-in
  timelineMonths: {
    monthIndex: number;
    phaseKey: "saving" | "construction" | "finishing" | "steady_state";
    rentPln: number;
    mortgagePln: number;
    adminFeePln: number;
    totalPln: number;
  }[];
}

export interface GoalSavingsAudit {
  accumulatedSavingsPln: number;
  milestone1TargetPln: number;
  milestone1GapPln: number;
  milestone1ProgressPct: number;
  milestone1RequiredMonthlyPacePln: number;

  milestone2TargetPln: number;
  milestone2GapPln: number;
  milestone2ProgressPct: number;
  milestone2RequiredMonthlyPacePln: number;

  totalTargetPln: number;
  totalGapPln: number;
  totalProgressPct: number;

  historicalNetCashflowMarginPln: number;
  paceStatus: "on_track" | "shortfall";
  monthlyDeltaPln: number; // positive = buffer surplus, negative = deficit
  projectedMilestone1DelayMonths: number; // 0 if on track, else estimated delay
}

export interface BudgetImpactSummary {
  currentMonthlyRentPln: number;
  newMonthlyHousingCostPln: number;
  newMortgageInstallmentPln: number;
  newCommunityAdminFeePln: number;
  monthlyCashflowDeltaPln: number; // newMonthlyHousingCost - currentMonthlyRent
  householdNetIncomePln: number;
  currentHousingDtiPct: number;
  newHousingDtiPct: number;
  stressedInstallmentPln: number;
  stressedHousingDtiPct: number;
}

export interface MortgageSimulatorStoragePayload {
  version: 1;
  config: MortgageSimulatorConfig;
}
