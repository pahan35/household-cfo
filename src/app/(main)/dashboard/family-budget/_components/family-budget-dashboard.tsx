"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AccountLiquidityStrip } from "./account-liquidity-strip";
import { AccountsCard } from "./accounts-card";
import {
  getCategories,
  getCurrencies,
  getSettings,
  getTransactionPage,
  updateCategoriesOrder,
} from "./external-provider-client";
import {
  archiveAccountCategory,
  buildLastTransactionMap,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  computeAccountLiquiditySummary,
  moveAccountsAboveArchived,
  reorderCategoriesSubset,
  unarchiveAccountCategory,
} from "./external-provider-data";
import { RecentTransactionsCard } from "./recent-transactions-card";

export function FamilyBudgetDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [baseDataError, setBaseDataError] = useState<Error | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadBaseData = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setIsLoadingBaseData(true);
    setBaseDataError(null);
    try {
      const [settingsRes, categoriesRes, currenciesRes, recentTxRes] = await Promise.allSettled([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
        getCurrencies({ signal, forceRefresh }),
        getTransactionPage({ skip: 0, take: 300, signal, forceRefresh }),
      ]);
      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value);
      } else if (!signal?.aborted) {
        setBaseDataError(
          settingsRes.reason instanceof Error ? settingsRes.reason : new Error("Failed to load settings"),
        );
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value);
      } else if (!signal?.aborted && settingsRes.status === "fulfilled") {
        setBaseDataError(
          categoriesRes.reason instanceof Error ? categoriesRes.reason : new Error("Failed to load categories"),
        );
      }
      if (currenciesRes.status === "fulfilled") {
        setCurrencies(currenciesRes.value);
      }
      if (recentTxRes.status === "fulfilled") {
        setRecentTransactions(recentTxRes.value.transactions ?? []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setBaseDataError(err instanceof Error ? err : new Error("Failed to load base data"));
    } finally {
      setIsLoadingBaseData(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBaseData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBaseData]);

  const defaultCurrency = settings?.defaultCurrency ?? "PLN";

  const liquiditySummary = useMemo(
    () => computeAccountLiquiditySummary(categories, currencies, defaultCurrency),
    [categories, currencies, defaultCurrency],
  );

  const selectedAccount = useMemo(
    () => (selectedAccountId ? (categories.find((c) => c.id === selectedAccountId) ?? null) : null),
    [categories, selectedAccountId],
  );

  const lastTransactionByCategoryId = useMemo(
    () => buildLastTransactionMap(recentTransactions, categories),
    [recentTransactions, categories],
  );

  const handleReorderCategories = useCallback(
    async (reorderedVisibleIds: string[], isSameGroup?: (cat: ExternalProviderCategory) => boolean) => {
      const prevCategories = categories;
      const { updatedCategories, modifiedCategories } = reorderCategoriesSubset(
        categories,
        reorderedVisibleIds,
        isSameGroup,
      );

      if (modifiedCategories.length === 0) {
        return;
      }

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to update category order");
        throw err;
      }
    },
    [categories],
  );

  const handleArchiveAccount = useCallback(
    async (accountId: string) => {
      const prevCategories = categories;
      const target = categories.find((c) => c.id === accountId);
      const { updatedCategories, modifiedCategories } = archiveAccountCategory(categories, accountId);

      if (modifiedCategories.length === 0) return;

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
        toast.success(`Archived "${target?.name ?? "account"}"`);
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to archive account");
        throw err;
      }
    },
    [categories],
  );

  const handleUnarchiveAccount = useCallback(
    async (accountId: string) => {
      const prevCategories = categories;
      const target = categories.find((c) => c.id === accountId);
      const { updatedCategories, modifiedCategories } = unarchiveAccountCategory(categories, accountId);

      if (modifiedCategories.length === 0) return;

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
        const unarchivedName = target?.name.replace(/^_+/, "").trim() || "account";
        toast.success(`Unarchived "${unarchivedName}"`);
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to unarchive account");
        throw err;
      }
    },
    [categories],
  );

  const handleMoveAccountsAboveArchived = useCallback(
    async (accountIds?: string[]) => {
      const prevCategories = categories;
      const { updatedCategories, modifiedCategories } = moveAccountsAboveArchived(categories, accountIds);

      if (modifiedCategories.length === 0) return;

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
        toast.success(
          accountIds && accountIds.length === 1
            ? "Account moved above archived"
            : "Moved active accounts above archived",
        );
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to reposition accounts");
        throw err;
      }
    },
    [categories],
  );

  function handleRefreshAll() {
    void loadBaseData(undefined, true);
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-normal">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Live External API Data
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-muted-foreground text-xs font-medium">Default: {defaultCurrency}</span>
        </div>

        <Button size="sm" variant="outline" onClick={handleRefreshAll} className="gap-1.5 text-xs">
          <RotateCw className={cn("size-3.5", isLoadingBaseData && "animate-spin")} />
          <span>Refresh Data</span>
        </Button>
      </div>

      <AccountLiquidityStrip
        summary={liquiditySummary}
        currency={defaultCurrency}
        selectedAccount={selectedAccount}
        isLoading={isLoadingBaseData}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <AccountsCard
            categories={categories}
            currency={defaultCurrency}
            currencies={currencies}
            isLoading={isLoadingBaseData}
            error={baseDataError}
            onRetry={() => void loadBaseData(undefined, true)}
            onReorderCategories={handleReorderCategories}
            onArchiveAccount={handleArchiveAccount}
            onUnarchiveAccount={handleUnarchiveAccount}
            onMoveAccountsAboveArchived={handleMoveAccountsAboveArchived}
            lastTransactionByCategoryId={lastTransactionByCategoryId}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
          />
        </div>
        <div className="xl:col-span-7">
          <RecentTransactionsCard
            key={refreshKey}
            defaultCurrency={defaultCurrency}
            categories={categories}
            selectedAccountId={selectedAccountId}
            onClearAccountFilter={() => setSelectedAccountId(null)}
          />
        </div>
      </div>
    </div>
  );
}
