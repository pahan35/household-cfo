"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import {
  getCategories,
  getCurrencies,
  getSettings,
  getTransactionPage,
  updateTransactionTags,
} from "../_components/external-provider-client";
import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
  ExternalProviderTransaction,
} from "../_components/external-provider-data";

export interface LifestyleDataContextValue {
  settings: ExternalProviderSettings | null;
  categories: ExternalProviderCategory[];
  categoryMap: Map<string, ExternalProviderCategory>;
  currencies: ExternalProviderCurrency[];
  transactions: ExternalProviderTransaction[];
  defaultCurrency: string;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateTxTags: (tx: ExternalProviderTransaction, newTags: string[]) => Promise<void>;
}

const LifestyleDataContext = createContext<LifestyleDataContextValue | undefined>(undefined);

const BATCH_SIZE = 500;
const MAX_PAGES = 10; // Load up to 5,000 transactions

export function LifestyleDataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [currencies, setCurrencies] = useState<ExternalProviderCurrency[]>([]);
  const [transactions, setTransactions] = useState<ExternalProviderTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExternalProviderCategory>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const defaultCurrency = useMemo(() => {
    return settings?.defaultCurrency?.toUpperCase() || "PLN";
  }, [settings]);

  const loadAllData = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const [settingsRes, categoriesRes, currenciesRes] = await Promise.all([
        getSettings({ signal, forceRefresh }),
        getCategories({ signal, forceRefresh }),
        getCurrencies({ signal, forceRefresh }),
      ]);

      setSettings(settingsRes);
      setCategories(categoriesRes);
      setCurrencies(currenciesRes);

      // Paged load for all-time transactions
      let skip = 0;
      let allLoadedTx: ExternalProviderTransaction[] = [];
      let pageIndex = 0;

      while (pageIndex < MAX_PAGES) {
        if (signal?.aborted) return;
        const pageRes = await getTransactionPage({
          skip,
          take: BATCH_SIZE,
          signal,
          forceRefresh,
        });

        const txs = pageRes.transactions ?? [];
        allLoadedTx = [...allLoadedTx, ...txs];

        if (!pageRes.hasMoreData || txs.length === 0) {
          break;
        }

        skip += txs.length;
        pageIndex++;
      }

      setTransactions(allLoadedTx);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err : new Error(String(err)));
      toast.error("Failed to load lifestyle data", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAllData(controller.signal);
    return () => controller.abort();
  }, [loadAllData]);

  const refresh = useCallback(async () => {
    await loadAllData(undefined, true);
  }, [loadAllData]);

  const updateTxTags = useCallback(async (tx: ExternalProviderTransaction, newTags: string[]) => {
    try {
      await updateTransactionTags(tx, newTags);
      setTransactions((prev) => prev.map((item) => (item.id === tx.id ? { ...item, tags: newTags } : item)));
      toast.success("Transaction tags updated");
    } catch (err) {
      toast.error("Failed to update transaction tags", {
        description: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }, []);

  const value = useMemo<LifestyleDataContextValue>(() => {
    return {
      settings,
      categories,
      categoryMap,
      currencies,
      transactions,
      defaultCurrency,
      isLoading,
      error,
      refresh,
      updateTxTags,
    };
  }, [
    settings,
    categories,
    categoryMap,
    currencies,
    transactions,
    defaultCurrency,
    isLoading,
    error,
    refresh,
    updateTxTags,
  ]);

  return <LifestyleDataContext.Provider value={value}>{children}</LifestyleDataContext.Provider>;
}

export function useLifestyleData(): LifestyleDataContextValue {
  const ctx = useContext(LifestyleDataContext);
  if (!ctx) {
    throw new Error("useLifestyleData must be used within a LifestyleDataProvider");
  }
  return ctx;
}
