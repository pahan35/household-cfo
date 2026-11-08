import "server-only";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  isAccountType,
  type StatCategoryPoint,
  type StatPoint,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import type { ExternalProviderSnapshot, ExternalProviderSyncConfig } from "@/server/external-provider/db";

export const MOCK_SEED_IDS = {
  SETTINGS_USER_ID: "mock-user-e2e",
  CURRENCY_PLN: "currency-pln",
  CURRENCY_EUR: "currency-eur",
  CURRENCY_USD: "currency-usd",
  CAT_INC_SALARY: "cat-inc-salary",
  CAT_INC_SIDEGIG: "cat-inc-sidegig",
  CAT_ACC_MAIN: "cat-acc-main",
  CAT_ACC_SAVINGS: "cat-acc-savings",
  CAT_DEBT_FRIEND: "cat-debt-friend",
  CAT_EXP_GROCERIES: "cat-exp-groceries",
  CAT_EXP_HOUSING: "cat-exp-housing",
  CAT_EXP_LIFESTYLE: "cat-exp-lifestyle",
  CAT_EXP_WELLNESS: "cat-exp-wellness",
  CAT_EXP_FEES: "cat-exp-fees",
} as const;

/** Baseline account balances before applying seed transactions */
export const BASE_ACCOUNT_BALANCES: Record<string, number> = {
  [MOCK_SEED_IDS.CAT_ACC_MAIN]: 15000,
  [MOCK_SEED_IDS.CAT_ACC_SAVINGS]: 5000,
  [MOCK_SEED_IDS.CAT_DEBT_FRIEND]: -2500,
};

export function msToDotNetTicks(ms: number): number {
  return ms * 10000 + 621355968000000000;
}

export function buildMockSettings(): ExternalProviderSettings {
  return {
    defaultCurrency: MOCK_SEED_IDS.CURRENCY_PLN,
    durationOfPeriod: 0,
    language: "en",
    userId: MOCK_SEED_IDS.SETTINGS_USER_ID,
    email: "e2e-tester@example.com",
    periodStartsAt: "2026-01-01T00:00:00",
  };
}

export function buildMockCurrencies(): ExternalProviderCurrency[] {
  return [
    { id: MOCK_SEED_IDS.CURRENCY_PLN, name: "PLN", symbol: "zł", rate: 1.0 },
    { id: MOCK_SEED_IDS.CURRENCY_EUR, name: "EUR", symbol: "€", rate: 0.23 },
    { id: MOCK_SEED_IDS.CURRENCY_USD, name: "USD", symbol: "$", rate: 0.25 },
  ];
}

export function buildMockSeedCategories(): ExternalProviderCategory[] {
  return [
    // Income
    {
      id: MOCK_SEED_IDS.CAT_INC_SALARY,
      name: "Salary",
      categoryType: CategoryType.Income,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      order: 0,
    },
    {
      id: MOCK_SEED_IDS.CAT_INC_SIDEGIG,
      name: "Side Gig",
      categoryType: CategoryType.Income,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      order: 1,
    },

    // Accounts
    {
      id: MOCK_SEED_IDS.CAT_ACC_MAIN,
      name: "Main Account PLN",
      categoryType: CategoryType.Account,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      amount: BASE_ACCOUNT_BALANCES[MOCK_SEED_IDS.CAT_ACC_MAIN],
      currentAmount: BASE_ACCOUNT_BALANCES[MOCK_SEED_IDS.CAT_ACC_MAIN],
      order: 0,
    },
    {
      id: MOCK_SEED_IDS.CAT_ACC_SAVINGS,
      name: "Savings EUR",
      categoryType: CategoryType.Account,
      currencyId: MOCK_SEED_IDS.CURRENCY_EUR,
      amount: BASE_ACCOUNT_BALANCES[MOCK_SEED_IDS.CAT_ACC_SAVINGS],
      currentAmount: BASE_ACCOUNT_BALANCES[MOCK_SEED_IDS.CAT_ACC_SAVINGS],
      order: 1,
    },
    {
      id: MOCK_SEED_IDS.CAT_DEBT_FRIEND,
      name: "Friend Loan",
      categoryType: CategoryType.DebtAccount,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      amount: BASE_ACCOUNT_BALANCES[MOCK_SEED_IDS.CAT_DEBT_FRIEND],
      currentAmount: BASE_ACCOUNT_BALANCES[MOCK_SEED_IDS.CAT_DEBT_FRIEND],
      order: 2,
    },

    // Expenses with budget limits
    {
      id: MOCK_SEED_IDS.CAT_EXP_GROCERIES,
      name: "Groceries",
      categoryType: CategoryType.Expense,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      limitAmount: 2500,
      order: 0,
    },
    {
      id: MOCK_SEED_IDS.CAT_EXP_HOUSING,
      name: "Housing & Utilities",
      categoryType: CategoryType.Expense,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      limitAmount: 4000,
      order: 1,
    },
    {
      id: MOCK_SEED_IDS.CAT_EXP_LIFESTYLE,
      name: "Lifestyle & Trips",
      categoryType: CategoryType.Expense,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      limitAmount: 2000,
      order: 2,
    },
    {
      id: MOCK_SEED_IDS.CAT_EXP_WELLNESS,
      name: "Wellness & Learning",
      categoryType: CategoryType.Expense,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      limitAmount: 1000,
      order: 3,
    },
    {
      id: MOCK_SEED_IDS.CAT_EXP_FEES,
      name: "Fees / Commissions",
      categoryType: CategoryType.Expense,
      currencyId: MOCK_SEED_IDS.CURRENCY_PLN,
      limitAmount: 300,
      order: 4,
    },
  ];
}

export function buildMockSeedTransactions(): ExternalProviderTransaction[] {
  // Deterministic timestamps anchored in March 2026
  const baseDate = new Date("2026-03-01T10:00:00.000Z");
  const time = (offsetDays: number, hour = 10) => {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  const txData: Array<{
    id: string;
    date: Date;
    sourceId: string;
    sourceType: number;
    sourceAmount: number;
    destinationId: string;
    destinationType: number;
    destinationAmount: number;
    comment?: string;
    tags?: string[];
  }> = [
    {
      id: "tx-seed-1",
      date: time(0, 9),
      sourceId: MOCK_SEED_IDS.CAT_INC_SALARY,
      sourceType: CategoryType.Income,
      sourceAmount: 12000,
      destinationId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      destinationType: CategoryType.Account,
      destinationAmount: 12000,
      comment: "Monthly Salary",
    },
    {
      id: "tx-seed-2",
      date: time(1, 11),
      sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      sourceType: CategoryType.Account,
      sourceAmount: 3200,
      destinationId: MOCK_SEED_IDS.CAT_EXP_HOUSING,
      destinationType: CategoryType.Expense,
      destinationAmount: 3200,
      comment: "Apartment Rent & Utilities",
    },
    {
      id: "tx-seed-3",
      date: time(2, 14),
      sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      sourceType: CategoryType.Account,
      sourceAmount: 650,
      destinationId: MOCK_SEED_IDS.CAT_EXP_GROCERIES,
      destinationType: CategoryType.Expense,
      destinationAmount: 650,
      comment: "Supermarket weekly haul",
      tags: ["food"],
    },
    {
      id: "tx-seed-4",
      date: time(3, 19),
      sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      sourceType: CategoryType.Account,
      sourceAmount: 220,
      destinationId: MOCK_SEED_IDS.CAT_EXP_LIFESTYLE,
      destinationType: CategoryType.Expense,
      destinationAmount: 220,
      comment: "Dinner with friends",
      tags: ["dining", "fun"],
    },
    {
      id: "tx-seed-5",
      date: time(4, 12),
      sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      sourceType: CategoryType.Account,
      sourceAmount: 150,
      destinationId: MOCK_SEED_IDS.CAT_EXP_WELLNESS,
      destinationType: CategoryType.Expense,
      destinationAmount: 150,
      comment: "Gym monthly subscription",
      tags: ["fitness"],
    },
    {
      id: "tx-seed-6",
      date: time(5, 16),
      sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      sourceType: CategoryType.Account,
      sourceAmount: 500,
      destinationId: MOCK_SEED_IDS.CAT_DEBT_FRIEND,
      destinationType: CategoryType.DebtAccount,
      destinationAmount: 500,
      comment: "Partial loan repayment",
    },
    {
      id: "tx-seed-7",
      date: time(6, 17),
      sourceId: MOCK_SEED_IDS.CAT_ACC_MAIN,
      sourceType: CategoryType.Account,
      sourceAmount: 1000,
      destinationId: MOCK_SEED_IDS.CAT_ACC_SAVINGS,
      destinationType: CategoryType.Account,
      destinationAmount: 230,
      comment: "Savings transfer to EUR vault",
    },
  ];

  return txData.map((tx) => {
    const ms = tx.date.getTime();
    return {
      id: tx.id,
      dateTimestamp: ms,
      dateTimestampISO: tx.date.toISOString(),
      createdTimestamp: ms,
      timestamp: msToDotNetTicks(ms),
      sourceId: tx.sourceId,
      sourceType: tx.sourceType,
      sourceAmount: tx.sourceAmount,
      destinationId: tx.destinationId,
      destinationType: tx.destinationType,
      destinationAmount: tx.destinationAmount,
      defaultAmount: tx.sourceAmount,
      comment: tx.comment,
      tags: tx.tags ?? [],
      deleted: false,
    };
  });
}

export interface RecomputeMockOptions {
  baseAccountBalances?: Record<string, number>;
}

/**
 * Recomputes account balances and monthly StatPoint structures from transactions and categories.
 */
export function recomputeMockStatPointsAndBalances(
  categories: ExternalProviderCategory[],
  transactions: ExternalProviderTransaction[],
  options?: RecomputeMockOptions,
): {
  updatedCategories: ExternalProviderCategory[];
  statPoints: StatPoint[];
} {
  const activeTransactions = transactions.filter((tx) => !tx.deleted);
  const updatedCategories = categories.map((cat) => ({ ...cat }));
  const catMap = new Map<string, ExternalProviderCategory>();
  for (const cat of updatedCategories) {
    catMap.set(cat.id, cat);
  }

  // 1. Recompute account balances
  for (const cat of updatedCategories) {
    if (isAccountType(cat.categoryType)) {
      const baseBalance = options?.baseAccountBalances?.[cat.id] ?? BASE_ACCOUNT_BALANCES[cat.id] ?? cat.amount ?? 0;
      let balance = baseBalance;

      for (const tx of activeTransactions) {
        if (tx.sourceId === cat.id) {
          balance -= tx.sourceAmount ?? 0;
        }
        if (tx.destinationId === cat.id) {
          balance += tx.destinationAmount ?? 0;
        }
      }

      cat.amount = balance;
      cat.currentAmount = balance;
    }
  }

  // 2. Discover unique months from active transactions
  const monthKeysSet = new Set<string>();
  for (const tx of activeTransactions) {
    if (tx.dateTimestampISO) {
      monthKeysSet.add(`${tx.dateTimestampISO.slice(0, 7)}-01`);
    } else if (tx.dateTimestamp) {
      const d = new Date(tx.dateTimestamp);
      if (!Number.isNaN(d.getTime())) {
        monthKeysSet.add(`${d.toISOString().slice(0, 7)}-01`);
      }
    }
  }

  if (monthKeysSet.size === 0) {
    const now = new Date();
    monthKeysSet.add(`${now.toISOString().slice(0, 7)}-01`);
  }

  const sortedMonthKeys = Array.from(monthKeysSet).sort();
  const expenseCategories = updatedCategories.filter(
    (c) => Number(c.categoryType) === CategoryType.Expense && !c.deleted,
  );

  const statPoints: StatPoint[] = sortedMonthKeys.map((monthKey) => {
    const monthPrefix = monthKey.slice(0, 7); // e.g. "2026-03"

    const statCategoryPoints: StatCategoryPoint[] = expenseCategories.map((cat) => {
      let spent = 0;
      for (const tx of activeTransactions) {
        const txMonth = tx.dateTimestampISO
          ? tx.dateTimestampISO.slice(0, 7)
          : tx.dateTimestamp
            ? new Date(tx.dateTimestamp).toISOString().slice(0, 7)
            : "";

        if (txMonth === monthPrefix && tx.destinationId === cat.id) {
          spent += tx.destinationAmount ?? tx.sourceAmount ?? 0;
        }
      }

      return {
        id: cat.id,
        title: cat.name,
        name: cat.name,
        amount: spent,
        value: spent,
        limitAmount: cat.limitAmount ?? 0,
        currentAmount: spent,
      };
    });

    return {
      id: monthKey,
      date: `${monthKey}T00:00:00`,
      categories: statCategoryPoints,
    };
  });

  return { updatedCategories, statPoints };
}

/**
 * Builds a deterministic initial snapshot for mock adapter mode.
 */
export function buildMockSeedSnapshot(): ExternalProviderSnapshot {
  const settings = buildMockSettings();
  const currencies = buildMockCurrencies();
  const seedCategories = buildMockSeedCategories();
  const seedTransactions = buildMockSeedTransactions();
  const { updatedCategories, statPoints } = recomputeMockStatPointsAndBalances(seedCategories, seedTransactions);

  const maxTicks = seedTransactions.reduce((acc, t) => Math.max(acc, t.timestamp ?? 0), 0);

  const syncConfig: ExternalProviderSyncConfig = {
    id: "default",
    sync_version: 1,
    sync_status: "idle",
    last_synced_at: new Date().toISOString(),
    last_warm_reconcile_at: new Date().toISOString(),
    last_full_reconcile_at: new Date().toISOString(),
    last_cron_run_at: null,
    last_error: null,
    watermark_tx_ticks: maxTicks,
    hot_pull_months: 3,
    auto_poll_interval_minutes: 0,
    settings_json: settings,
    currencies_json: currencies,
    updated_at: new Date().toISOString(),
  };

  return {
    syncConfig,
    settings,
    currencies,
    categories: updatedCategories,
    transactions: seedTransactions,
    statPoints,
  };
}
