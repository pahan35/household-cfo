"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AccountLiquidityStrip } from "./account-liquidity-strip";
import { AccountsCard } from "./accounts-card";
import { parseLedgerCategoryIds } from "./category-expense-trace-helpers";
import {
  createTransaction,
  getCategories,
  getCurrencies,
  getSettings,
  getTransactionPage,
  updateCategoriesOrder,
} from "./external-provider-client";
import {
  archiveAccountCategory,
  buildLastTransactionMap,
  buildNewDebtAccountCategory,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderSettings,
  type ExternalProviderTransaction,
  computeAccountLiquiditySummary,
  isThrowawayDebtAccount,
  moveAccountsAboveArchived,
  type NewDebtAccountInput,
  reorderCategoriesSubset,
  unarchiveAccountCategory,
} from "./external-provider-data";
import { useExternalProviderSync } from "./external-provider-sync-toolbar";
import { DebtAccountInitDialog } from "./debt-account-init-dialog";
import { DebtClearingPanel } from "./debt-clearing-panel";
import { RecentTransactionsCard } from "./recent-transactions-card";

export function FamilyBudgetDashboard() {
  const { syncVersion } = useExternalProviderSync();
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [baseDataError, setBaseDataError] = useState<Error | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isInitDebtDialogOpen, setIsInitDebtDialogOpen] = useState(false);

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
    if (syncVersion < 0) return;
    const controller = new AbortController();
    void loadBaseData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBaseData, syncVersion]);

  // Read ?categoryId (comma-separated) and ?accountId from the URL on mount and browser Back/Forward
  useEffect(() => {
    function syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const ids = parseLedgerCategoryIds(params.get("categoryId"));
      setSelectedCategoryIds((prev) => (prev.join(",") === ids.join(",") ? prev : ids));
      const accountId = params.get("accountId");
      if (accountId) setSelectedAccountId(accountId);
    }
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const handleClearCategoryFilter = useCallback(() => {
    setSelectedCategoryIds([]);
    const url = new URL(window.location.href);
    url.searchParams.delete("categoryId");
    url.searchParams.delete("accountId");
    window.history.replaceState(null, "", url.toString());
  }, []);

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
    () => buildLastTransactionMap(recentTransactions, categories, defaultCurrency, currencies),
    [recentTransactions, categories, defaultCurrency, currencies],
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
    async (accountId: string, options?: { exceptFromBalance?: boolean }) => {
      const prevCategories = categories;
      const target = categories.find((c) => c.id === accountId);
      const { updatedCategories, modifiedCategories } = archiveAccountCategory(categories, accountId, options);

      if (modifiedCategories.length === 0) return;

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
        toast.success(`Archived "${target?.name ?? "account"}"`);
        void loadBaseData(undefined, true);
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to archive account");
        throw err;
      }
    },
    [categories, loadBaseData],
  );

  const handleCreateDebtAccount = useCallback(
    async (input: NewDebtAccountInput) => {
      const prevCategories = categories;
      const { newAccount, updatedCategories, modifiedCategories } = buildNewDebtAccountCategory(categories, input);

      setCategories(updatedCategories);

      try {
        await updateCategoriesOrder(modifiedCategories, {
          allUpdatedCategories: updatedCategories,
        });
        setSelectedAccountId(newAccount.id);
        toast.success(`Created "${newAccount.name}"`);
        void loadBaseData(undefined, true);
      } catch (err) {
        setCategories(prevCategories);
        toast.error(err instanceof Error ? err.message : "Failed to create debt account");
        throw err;
      }
    },
    [categories, loadBaseData],
  );

  const handleCreateClearingTransaction = useCallback(
    async (tx: ExternalProviderTransaction) => {
      await createTransaction(tx);
      void loadBaseData(undefined, true);
    },
    [loadBaseData],
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

  return (
    <div className="flex flex-col gap-4">
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
            onOpenNewDebtDialog={() => setIsInitDebtDialogOpen(true)}
          />
        </div>
        <div className="xl:col-span-7 flex flex-col gap-4">
          {selectedAccount && isThrowawayDebtAccount(selectedAccount) && (
            <DebtClearingPanel
              debtAccount={selectedAccount}
              allCategories={categories}
              currencies={currencies}
              defaultCurrency={defaultCurrency}
              onClose={() => setSelectedAccountId(null)}
              onCreateTransaction={handleCreateClearingTransaction}
              onArchiveSettledAccount={handleArchiveAccount}
            />
          )}
          <RecentTransactionsCard
            defaultCurrency={defaultCurrency}
            categories={categories}
            selectedAccountId={selectedAccountId}
            onClearAccountFilter={() => setSelectedAccountId(null)}
            selectedCategoryIds={selectedCategoryIds}
            onClearCategoryFilter={handleClearCategoryFilter}
          />
        </div>
      </div>

      <DebtAccountInitDialog
        open={isInitDebtDialogOpen}
        onOpenChange={setIsInitDebtDialogOpen}
        defaultCurrency={defaultCurrency}
        currencies={currencies}
        onSubmit={handleCreateDebtAccount}
      />
    </div>
  );
}
