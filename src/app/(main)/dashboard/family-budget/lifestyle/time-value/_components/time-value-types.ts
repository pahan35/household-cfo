/**
 * Time & Opportunity Motivator Domain Models & Types
 *
 * Models a dual-player ("Me" & "My Wife") household configuration:
 * - Partner & Home Care foundational recognition (celebrating non-formal care before screen time)
 * - Empathetic Joy vs. Drift screen-time reflection (zero-guilt fun recharge vs. tradeable drift)
 * - 3-Way Drift Reallocation (Extra Income / Pet Projects, Skill Learning ROI, Restorative Wellness)
 * - Primary partner Offer Comparator integration & Vacation vs. Day-Off Monetization dial
 * - Spouse Freelancing & Family Pet Project / Automation value compound engine
 * - Multi-Goal acceleration (1st Mortgage, Real Historical Trips, Personal Goals)
 * - Weekly Check-In historical log and LocalStorage schema
 */

export type PlayerId = "me" | "wife";

// ---------------------------------------------------------------------------
// 1. Device & Setup Profile
// ---------------------------------------------------------------------------

export interface DeviceSetup {
  primaryPhone: string; // e.g. "Pixel 9 Pro" or "Galaxy S24"
  gamingPlatform: string; // e.g. "PC / Console" or "Mobile & Switch"
  favoriteApps: string[]; // e.g. ["Instagram", "Threads", "Steam", "Mobile RPG"]
}

// ---------------------------------------------------------------------------
// 2. Joy vs. Drift Screen Time & Care Settings
// ---------------------------------------------------------------------------

export interface ScreenTimeReflection {
  gamingTotalHours: number;
  gamingJoyHours: number; // Genuine fun / recharging hours (cheered & protected)
  socialTotalHours: number;
  socialJoyHours: number; // Genuine connection / inspiring hours (cheered & protected)
}

export interface PartnerCareSettings {
  careHoursPerWeek: number; // Household management, cooking, emotional support, errands
  referenceHourlyRatePln: number; // Appreciative concierge/household market rate (default: 40 PLN/hr)
  celebrationTitle: string; // e.g. "Foundational Household Pillar & Emotional Anchor"
}

export interface DriftReallocationSplit {
  sideHustleHours: number; // Hours redirected to extra income / pet projects
  learningHours: number; // Hours redirected to courses, certifications, language
  properRelaxHours: number; // Hours redirected to intentional wellness (Pilates, walks, reading)
  focusEfficiencyPct: number; // Realistic focus conversion factor (default: 75%)
}

// ---------------------------------------------------------------------------
// 3. Primary Partner Opportunity & Time-Off Monetization
// ---------------------------------------------------------------------------

export interface PrimaryMonetizationSettings {
  rateSource: "offer_sync" | "manual";
  manualRatePln: number; // Used if "manual" or if Offer Comparator has no active revision
  annualDaysOffPool: number; // Vacation days + state holidays (e.g. 26 + 13 = 39)
  sacredUnplugDays: number; // Protected offline vacation/rest days (cheered, zero guilt)
  monetizedDaysOff: number; // Staycation / quiet holiday days dedicated to billing or deep projects
  hoursPerDayOff: number; // Hours per monetized day (default: 8)
}

// ---------------------------------------------------------------------------
// 4. Spouse Opportunity Engine: Freelancing & Pet Projects
// ---------------------------------------------------------------------------

export interface SpouseFreelanceSettings {
  enabled: boolean;
  hourlyRatePln: number; // e.g. 80 PLN/hr
  activeServicesDescription: string;
}

export interface FamilyPetProject {
  id: string;
  title: string;
  description: string;
  status: "active" | "planned" | "completed";
  allocatedHoursPerWeek: number;
  monthlyExpenseSavedPln: number; // Direct recurring subscription / service saved
  weeklyHouseholdHoursSaved: number; // Household chore / admin hours saved for family
  hoursSavedValuedAtPln: number; // Replacement rate (default: 50 PLN/hr)
  projectedLaunchMonthlyIncomePln: number; // Expected future recurring or client revenue
  milestoneBountyPln: number; // Cash bounty granted into her personal goal fund upon shipping
  milestoneCompleted: boolean;
  linkedPersonalGoalId?: string;
  createdAt: string;
}

export interface SpouseOpportunitySettings {
  freelance: SpouseFreelanceSettings;
  petProjectsEnabled: boolean;
}

// ---------------------------------------------------------------------------
// 5. Dual-Player Combined Profiles
// ---------------------------------------------------------------------------

export interface PrimaryPlayerProfile {
  id: "me";
  displayName: string;
  device: DeviceSetup;
  care: PartnerCareSettings;
  screenTime: ScreenTimeReflection;
  reallocation: DriftReallocationSplit;
  monetization: PrimaryMonetizationSettings;
}

export interface SpousePlayerProfile {
  id: "wife";
  displayName: string;
  device: DeviceSetup;
  care: PartnerCareSettings;
  screenTime: ScreenTimeReflection;
  reallocation: DriftReallocationSplit;
  opportunity: SpouseOpportunitySettings;
}

// ---------------------------------------------------------------------------
// 6. Personal & Her-Preference Goals
// ---------------------------------------------------------------------------

export type GoalOwner = "wife" | "me" | "shared";

export interface PersonalGoal {
  id: string;
  title: string;
  category: "travel" | "wellness" | "tech" | "fashion" | "education" | "home" | "other";
  targetAmountPln: number;
  currentSavedPln: number;
  owner: GoalOwner;
  notes?: string;
  targetDate?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 7. Weekly Check-In Log (Historical Reflections)
// ---------------------------------------------------------------------------

export interface PartnerWeeklyReflection {
  careHours: number;
  gamingTotalHours: number;
  gamingJoyHours: number;
  socialTotalHours: number;
  socialJoyHours: number;
  actualSideHustleHours: number;
  actualLearningHours: number;
  actualRelaxHours: number;
  reflectionNotes?: string;
}

export interface WeeklyCheckInEntry {
  id: string;
  weekStartDate: string; // "YYYY-MM-DD"
  weekNumber?: number;
  loggedAt: string; // ISO string
  me: PartnerWeeklyReflection;
  wife: PartnerWeeklyReflection;
  coupleCelebrationNotes?: string;
  totalHouseholdDriftReclaimedHours: number;
  totalHouseholdExtraCashflowPln: number;
}

// ---------------------------------------------------------------------------
// 8. Overall Time Value State & Storage
// ---------------------------------------------------------------------------

export const TIME_VALUE_STORAGE_KEY = "family-budget:time-value-motivator:v1";

export interface TimeValueMotivatorConfig {
  me: PrimaryPlayerProfile;
  wife: SpousePlayerProfile;
  petProjects: FamilyPetProject[];
  personalGoals: PersonalGoal[];
  weeklyLogs: WeeklyCheckInEntry[];
  learningProjectedRateGrowthPct: number; // Projected career hourly rate lift from active skill study (e.g. 5%)
  updatedAt?: string;
}

export interface TimeValueStoragePayload {
  version: 1;
  config: TimeValueMotivatorConfig;
  exportedAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// 9. Computed Metrics & Goal Accelerator Types
// ---------------------------------------------------------------------------

export interface ComputedPlayerScreenTime {
  totalHours: number;
  joyfulHours: number;
  driftHours: number;
  joyRatioPct: number;
  driftRatioPct: number;
  isAllJoyCelebration: boolean;
}

export interface ComputedPlayerReallocation {
  reclaimedDriftHours: number;
  sideHustleEffectiveHours: number;
  learningHours: number;
  properRelaxHours: number;
}

export interface ComputedPlayerCashflow {
  monthlySideHustleCashflowPln: number;
  annualSideHustleCashflowPln: number;
  dayOffMonetizationAnnualPln: number;
  dayOffMonetizationMonthlyPln: number;
  spouseMonthlySavingsPln: number;
  spouseHoursSavedPerWeek: number;
  spouseProjectedMonthlyRevenuePln: number;
  spouseEarnedBountiesPln: number;
  totalMonthlyValuePln: number;
  effectiveHourlyRatePln: number;
}

export interface MortgageGoalAcceleration {
  baselineMonthsMilestone1: number;
  acceleratedMonthsMilestone1: number;
  monthsSavedMilestone1: number;
  milestone1GapPln: number;
  baselineMonthsMilestone2: number;
  acceleratedMonthsMilestone2: number;
  monthsSavedMilestone2: number;
  totalGapPln: number;
  monthlyExtraIncomePln: number;
  annualExtraIncomePln: number;
  pricePerSqmPln: number;
  unlockedSqmPerYear: number;
}

export interface HistoricalTripBenchmark {
  id: string;
  destinationTag: string;
  name: string;
  totalCostPln: number;
  multiplierPerYear: number; // annualReclaimedCashflow / totalCostPln
  monthsToFund: number; // totalCostPln / monthlyReclaimedCashflow
}

export interface LearningRoiSummary {
  monthlyExternalProviderLearningSpendPln: number;
  weeklyStudyHours: number;
  monthlyStudyHours: number;
  activeCostPerStudyHourPln: number;
  projectedCareerRateLiftPln: number;
}

export interface ComputedTimeValueSummary {
  me: {
    screenTime: ComputedPlayerScreenTime;
    reallocation: ComputedPlayerReallocation;
    cashflow: ComputedPlayerCashflow;
    careAppreciationPln: number;
  };
  wife: {
    screenTime: ComputedPlayerScreenTime;
    reallocation: ComputedPlayerReallocation;
    cashflow: ComputedPlayerCashflow;
    careAppreciationPln: number;
  };
  household: {
    totalWeeklyJoyHours: number;
    totalWeeklyDriftHours: number;
    totalWeeklyReclaimedHours: number;
    totalWeeklyCareHours: number;
    totalWeeklyRelaxHours: number;
    totalWeeklyLearningHours: number;
    totalMonthlyCashflowBoostPln: number;
    totalAnnualCashflowBoostPln: number;
    totalSpouseMonthlyValuePln: number;
    sacredVacationDays: number;
    monetizedDaysOff: number;
  };
  learningRoi: LearningRoiSummary;
  mortgageAcceleration: MortgageGoalAcceleration;
  tripBenchmarks: HistoricalTripBenchmark[];
}
