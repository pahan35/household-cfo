"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AccountsCard } from "./accounts-card";
import { type BudgetPeriodMonth, BudgetSummaryCard } from "./budget-summary-card";
import { getCategories, getSettings } from "./external-provider-client";
import type { ExternalProviderCategory, ExternalProviderSettings } from "./external-provider-data";
import { RecentTransactionsCard } from "./recent-transactions-card";

export function FamilyBudgetDashboard() {
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [periodMonth, setPeriodMonth] = useState<BudgetPeriodMonth>("current");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadBaseData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [settingsRes, categoriesRes] = await Promise.allSettled([
        getSettings({ signal }),
        getCategories({ signal }),
      ]);
      if (settingsRes.status === "fulfilled") {
        setSettings(settingsRes.value);
      }
      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value);
      }
    } catch {
      // Ignored: Individual sections handle their own error/retry states
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

  const periodFilter = useMemo(() => {
    const now = new Date();
    if (periodMonth === "previous") {
      const target = subMonths(now, 1);
      return {
        from: format(startOfMonth(target), "yyyy-MM-dd"),
        to: format(endOfMonth(target), "yyyy-MM-dd"),
      };
    }
    return {
      from: format(startOfMonth(now), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  }, [periodMonth]);

  function handleRefreshAll() {
    setRefreshKey((k) => k + 1);
    void loadBaseData();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 font-normal text-xs">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Live External API Data
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="font-medium text-muted-foreground text-xs">Default: {defaultCurrency}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefreshAll} className="gap-1.5 text-xs">
            <RotateCw className="size-3.5" />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      <div key={`overview-grid-${refreshKey}`} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <AccountsCard currency={defaultCurrency} />
        </div>
        <div className="xl:col-span-7">
          <BudgetSummaryCard
            categories={categories}
            defaultCurrency={defaultCurrency}
            periodMonth={periodMonth}
            onPeriodMonthChange={setPeriodMonth}
          />
        </div>
      </div>

      <div key={`tx-grid-${refreshKey}`} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <RecentTransactionsCard defaultCurrency={defaultCurrency} periodFilter={periodFilter} />
        </div>
      </div>
    </div>
  );
}
