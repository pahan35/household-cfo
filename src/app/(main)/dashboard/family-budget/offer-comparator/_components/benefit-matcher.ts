/**
 * Benefit Matcher & ExternalProvider Spend Ceilings Engine
 *
 * Computes trailing monthly ExternalProvider spend ceilings across unified categories
 * (Medicine, Sport, Mental Health, Massage, Learning) split into:
 * 1. Covered primary spend (corporate package eligible, for the employee)
 * 2. Covered spouse / family spend (#wife, #partner, #family)
 * 3. Out-of-pocket spend (#dentist, #pharmacy, #pilates)
 *
 * Provides suggested budget offsets for Individual vs. Family benefit tiers.
 */

import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderTransaction,
} from "../../_components/external-provider-data";
import {
  getConvertedTransactionAmount,
  getTransactionDate,
  isExpenseTransaction,
  isMedicalCoveredTag,
  isMedicalOutOfPocketTag,
  isSportCoveredTag,
  isSportOutOfPocketTag,
  isSpouseOrFamilyTag,
  normalizeLifestyleTag,
  normalizeUnifiedCategory,
} from "../../_components/lifestyle-transforms";
import type { BenefitCategory, BenefitCoverageTier, BenefitItem } from "./offer-types";

export interface CategorySpendBreakdown {
  unifiedCategory: string;
  benefitCategory: BenefitCategory;
  totalSpendPln: number;
  monthlyAveragePln: number;
  coveredPrimaryMonthlyPln: number;
  coveredSpouseMonthlyPln: number;
  outOfPocketMonthlyPln: number;
  transactionCount: number;
}

export interface BenefitCeilingsSummary {
  breakdowns: Record<BenefitCategory, CategorySpendBreakdown>;
  totalCoveredPrimaryMonthlyPln: number;
  totalCoveredSpouseMonthlyPln: number;
  totalOutOfPocketMonthlyPln: number;
  windowMonths: number;
  startDateStr: string;
  endDateStr: string;
}

export function computeBenefitSpendCeilings(input: {
  transactions: ExternalProviderTransaction[];
  categories: ExternalProviderCategory[] | Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  defaultCurrency?: string;
  monthsWindow?: number;
}): BenefitCeilingsSummary {
  const { transactions, currencies, defaultCurrency = "PLN", monthsWindow = 12 } = input;
  const categoryMap =
    input.categories instanceof Map
      ? input.categories
      : new Map<string, ExternalProviderCategory>(input.categories.map((c) => [c.id, c]));

  // Calculate cutoff timestamp
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsWindow, 1);
  const cutoffTime = cutoffDate.getTime();

  // Accumulator buckets
  const buckets: Record<
    BenefitCategory,
    {
      unifiedCategory: string;
      totalSpend: number;
      coveredPrimary: number;
      coveredSpouse: number;
      outOfPocket: number;
      txCount: number;
    }
  > = {
    health: {
      unifiedCategory: "Medicine",
      totalSpend: 0,
      coveredPrimary: 0,
      coveredSpouse: 0,
      outOfPocket: 0,
      txCount: 0,
    },
    sport: { unifiedCategory: "Sport", totalSpend: 0, coveredPrimary: 0, coveredSpouse: 0, outOfPocket: 0, txCount: 0 },
    mental_health: {
      unifiedCategory: "Mental Health",
      totalSpend: 0,
      coveredPrimary: 0,
      coveredSpouse: 0,
      outOfPocket: 0,
      txCount: 0,
    },
    massage: {
      unifiedCategory: "Massage",
      totalSpend: 0,
      coveredPrimary: 0,
      coveredSpouse: 0,
      outOfPocket: 0,
      txCount: 0,
    },
    learning: {
      unifiedCategory: "Learning",
      totalSpend: 0,
      coveredPrimary: 0,
      coveredSpouse: 0,
      outOfPocket: 0,
      txCount: 0,
    },
    lunch: { unifiedCategory: "Lunch", totalSpend: 0, coveredPrimary: 0, coveredSpouse: 0, outOfPocket: 0, txCount: 0 },
    gift: { unifiedCategory: "Gift", totalSpend: 0, coveredPrimary: 0, coveredSpouse: 0, outOfPocket: 0, txCount: 0 },
    equipment: {
      unifiedCategory: "Equipment",
      totalSpend: 0,
      coveredPrimary: 0,
      coveredSpouse: 0,
      outOfPocket: 0,
      txCount: 0,
    },
    sabbatical: {
      unifiedCategory: "Sabbatical",
      totalSpend: 0,
      coveredPrimary: 0,
      coveredSpouse: 0,
      outOfPocket: 0,
      txCount: 0,
    },
    bonus: { unifiedCategory: "Bonus", totalSpend: 0, coveredPrimary: 0, coveredSpouse: 0, outOfPocket: 0, txCount: 0 },
    other: { unifiedCategory: "Other", totalSpend: 0, coveredPrimary: 0, coveredSpouse: 0, outOfPocket: 0, txCount: 0 },
  };

  let earliestTxTime = now.getTime();
  let latestTxTime = 0;

  for (const tx of transactions) {
    if (tx.deleted) continue;
    if (!isExpenseTransaction(tx, categoryMap)) continue;

    const txDate = getTransactionDate(tx);
    const txTime = txDate.getTime();
    if (txTime < cutoffTime) continue;

    earliestTxTime = Math.min(earliestTxTime, txTime);
    latestTxTime = Math.max(latestTxTime, txTime);

    const catId = tx.destinationId;
    const cat = catId ? categoryMap.get(catId) : undefined;
    const rawName = cat?.name ?? "";
    const unified = normalizeUnifiedCategory(rawName);

    const { convertedAmount } = getConvertedTransactionAmount(tx, defaultCurrency, currencies, categoryMap);

    const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
    const cleanTags = rawTags.map(normalizeLifestyleTag);

    const isSpouse = cleanTags.some(isSpouseOrFamilyTag);

    if (unified === "Medicine") {
      const b = buckets.health;
      b.totalSpend += convertedAmount;
      b.txCount++;

      const isExplicitOop = cleanTags.some(isMedicalOutOfPocketTag);
      const isExplicitCovered = cleanTags.some(isMedicalCoveredTag);

      if (isExplicitOop) {
        b.outOfPocket += convertedAmount;
      } else if (isExplicitCovered) {
        if (isSpouse) {
          b.coveredSpouse += convertedAmount;
        } else {
          b.coveredPrimary += convertedAmount;
        }
      } else {
        // Untagged fallback: assume 60% eligible consultations/exams, 40% out-of-pocket pharmacy/dentist
        const eligible = convertedAmount * 0.6;
        const oop = convertedAmount * 0.4;
        b.outOfPocket += oop;
        if (isSpouse) {
          b.coveredSpouse += eligible;
        } else {
          b.coveredPrimary += eligible;
        }
      }
    } else if (unified === "Sport") {
      const b = buckets.sport;
      b.totalSpend += convertedAmount;
      b.txCount++;

      const isExplicitOop = cleanTags.some(isSportOutOfPocketTag); // e.g. pilates
      const isExplicitCovered = cleanTags.some(isSportCoveredTag); // e.g. gym, multisport

      if (isExplicitOop) {
        b.outOfPocket += convertedAmount;
      } else if (isExplicitCovered) {
        if (isSpouse) {
          b.coveredSpouse += convertedAmount;
        } else {
          b.coveredPrimary += convertedAmount;
        }
      } else {
        // Untagged sport: default to covered gym/multisport
        if (isSpouse) {
          b.coveredSpouse += convertedAmount;
        } else {
          b.coveredPrimary += convertedAmount;
        }
      }
    } else if (unified === "Mental Health") {
      const b = buckets.mental_health;
      b.totalSpend += convertedAmount;
      b.txCount++;
      if (isSpouse) {
        b.coveredSpouse += convertedAmount;
      } else {
        b.coveredPrimary += convertedAmount;
      }
    } else if (unified === "Massage") {
      const b = buckets.massage;
      b.totalSpend += convertedAmount;
      b.txCount++;
      if (isSpouse) {
        b.coveredSpouse += convertedAmount;
      } else {
        b.coveredPrimary += convertedAmount;
      }
    } else if (unified === "Learning") {
      const b = buckets.learning;
      b.totalSpend += convertedAmount;
      b.txCount++;
      b.coveredPrimary += convertedAmount;
    }
  }

  // Determine actual active months in the analyzed window
  const activeDays = Math.max(1, (latestTxTime - earliestTxTime) / (1000 * 3600 * 24));
  const activeMonths = Math.min(monthsWindow, Math.max(1, Math.round((activeDays / 30.4) * 10) / 10));

  const breakdowns = {} as Record<BenefitCategory, CategorySpendBreakdown>;
  let totalCoveredPrimary = 0;
  let totalCoveredSpouse = 0;
  let totalOop = 0;

  for (const [key, b] of Object.entries(buckets) as [BenefitCategory, (typeof buckets)[BenefitCategory]][]) {
    const monthlyAverage = Math.round((b.totalSpend / activeMonths) * 100) / 100;
    const primaryMo = Math.round((b.coveredPrimary / activeMonths) * 100) / 100;
    const spouseMo = Math.round((b.coveredSpouse / activeMonths) * 100) / 100;
    const oopMo = Math.round((b.outOfPocket / activeMonths) * 100) / 100;

    totalCoveredPrimary += primaryMo;
    totalCoveredSpouse += spouseMo;
    totalOop += oopMo;

    breakdowns[key] = {
      unifiedCategory: b.unifiedCategory,
      benefitCategory: key,
      totalSpendPln: Math.round(b.totalSpend * 100) / 100,
      monthlyAveragePln: monthlyAverage,
      coveredPrimaryMonthlyPln: primaryMo,
      coveredSpouseMonthlyPln: spouseMo,
      outOfPocketMonthlyPln: oopMo,
      transactionCount: b.txCount,
    };
  }

  return {
    breakdowns,
    totalCoveredPrimaryMonthlyPln: Math.round(totalCoveredPrimary * 100) / 100,
    totalCoveredSpouseMonthlyPln: Math.round(totalCoveredSpouse * 100) / 100,
    totalOutOfPocketMonthlyPln: Math.round(totalOop * 100) / 100,
    windowMonths: activeMonths,
    startDateStr: cutoffDate.toISOString().slice(0, 10),
    endDateStr: now.toISOString().slice(0, 10),
  };
}

/**
 * Suggests the monthly hard budget offset for a specific benefit item based on
 * real ExternalProvider spending and coverage tier.
 */
export function suggestBudgetOffset(
  category: BenefitCategory,
  tier: BenefitCoverageTier = "individual",
  ceilings: BenefitCeilingsSummary,
): {
  suggestedOffsetPln: number;
  spouseDowngradeDeltaPln: number;
  explanation: string;
} {
  const breakdown = ceilings.breakdowns[category];
  if (!breakdown || breakdown.monthlyAveragePln === 0) {
    return {
      suggestedOffsetPln: 0,
      spouseDowngradeDeltaPln: 0,
      explanation: "No recent ExternalProvider spending in this category to offset.",
    };
  }

  const primary = breakdown.coveredPrimaryMonthlyPln;
  const spouse = breakdown.coveredSpouseMonthlyPln;

  if (tier === "family") {
    const suggestedOffsetPln = primary + spouse;
    return {
      suggestedOffsetPln,
      spouseDowngradeDeltaPln: spouse,
      explanation: `Family tier offsets both primary (${primary} PLN) and spouse/family (${spouse} PLN) monthly spend.`,
    };
  }

  // Individual tier
  return {
    suggestedOffsetPln: primary,
    spouseDowngradeDeltaPln: spouse,
    explanation: `Individual tier offsets primary spend (${primary} PLN). Excludes spouse spend (${spouse} PLN/mo).`,
  };
}

/**
 * Generates starter benefit items for an offer based on live ExternalProvider spend ceilings.
 */
export function generateStarterBenefitsFromCeilings(ceilings: BenefitCeilingsSummary): BenefitItem[] {
  const items: BenefitItem[] = [];

  // 1. Health package
  const healthBd = ceilings.breakdowns.health;
  if (healthBd && healthBd.monthlyAveragePln > 0) {
    const isFamily = healthBd.coveredSpouseMonthlyPln > 0;
    const offset = isFamily
      ? healthBd.coveredPrimaryMonthlyPln + healthBd.coveredSpouseMonthlyPln
      : healthBd.coveredPrimaryMonthlyPln;

    items.push({
      id: "benefit-health",
      name: isFamily ? "Private Medical Care (Family)" : "Private Medical Care (Individual)",
      category: "health",
      nominalValuePln: isFamily ? 450 : 250,
      monthlyBudgetOffsetPln: offset,
      subjectiveUtilityWeightPct: 20,
      tier: isFamily ? "family" : "individual",
      spouseCopayMonthlyPln: isFamily ? 0 : 200,
      linkedExternalProviderCategory: "Medicine",
    });
  }

  // 2. Sport package
  const sportBd = ceilings.breakdowns.sport;
  if (sportBd && sportBd.monthlyAveragePln > 0) {
    items.push({
      id: "benefit-sport",
      name: "MultiSport Plus Card",
      category: "sport",
      nominalValuePln: 180,
      monthlyBudgetOffsetPln: sportBd.coveredPrimaryMonthlyPln,
      subjectiveUtilityWeightPct: 40,
      tier: "individual",
      linkedExternalProviderCategory: "Sport",
    });
  }

  // 3. Learning stipend
  const learningBd = ceilings.breakdowns.learning;
  if (learningBd && learningBd.monthlyAveragePln > 0) {
    items.push({
      id: "benefit-learning",
      name: "Annual Education / Conference Budget",
      category: "learning",
      nominalValuePln: 500,
      monthlyBudgetOffsetPln: learningBd.coveredPrimaryMonthlyPln,
      subjectiveUtilityWeightPct: 50,
      tier: "individual",
      linkedExternalProviderCategory: "Learning",
    });
  }

  return items;
}
