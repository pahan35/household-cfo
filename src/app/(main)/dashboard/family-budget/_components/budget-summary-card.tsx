"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { format, startOfMonth, subMonths } from "date-fns";
import { AlertTriangle, Archive, GripVertical, PiggyBank } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { getBudgetSelection } from "./external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  filterAndClassifyCategories,
  formatMoney,
  type LastTransactionSummary,
  type StatCategoryPoint,
  type StatPingData,
} from "./external-provider-data";
import type { CategoryComparisonDelta } from "./expense-transforms";
import { LastTransactionBadge } from "./last-transaction-badge";
import { SectionShell } from "./section-shell";
import { parsePointDate } from "./yoy-transforms";

export type BudgetPeriodMonth = "current" | "previous";
export type BudgetSortMode = "custom" | "percent";

export interface BudgetSummaryItem {
  id: string;
  name: string;
  limit: number;
  current: number;
  percent: number;
  rawPercent: number;
  isOverrun: boolean;
}

export function computeBudgetSummaryItems(
  statData: StatPingData | null | undefined,
  fromDate: string,
  categoryNameMap: Map<string, string>,
  categoryTypeMapOrOptions?: Map<string, number> | { includeAll?: boolean; categoryTypeMap?: Map<string, number> },
  options?: { includeAll?: boolean },
): BudgetSummaryItem[] {
  let categoryTypeMap: Map<string, number> | undefined;
  let includeAll = false;

  if (categoryTypeMapOrOptions instanceof Map) {
    categoryTypeMap = categoryTypeMapOrOptions;
    includeAll = options?.includeAll ?? false;
  } else if (categoryTypeMapOrOptions && typeof categoryTypeMapOrOptions === "object") {
    categoryTypeMap = categoryTypeMapOrOptions.categoryTypeMap;
    includeAll = categoryTypeMapOrOptions.includeAll ?? false;
  } else {
    includeAll = options?.includeAll ?? false;
  }

  const points = statData?.selection?.points ?? [];
  if (points.length === 0) return [];

  // Find point matching selected month fromDate or default to latest point (points[0])
  const activePoint = points.find((p) => p.id === fromDate || parsePointDate(p)?.dateStr === fromDate) ?? points[0];

  if (!activePoint?.categories) return [];

  return activePoint.categories
    .filter((cat: StatCategoryPoint) => {
      if (categoryTypeMap) {
        const type = categoryTypeMap.get(cat.id);
        if (type !== undefined && type !== CategoryType.Expense) {
          return false;
        }
      }
      if (includeAll) return true;
      const limit = Number(cat.limitAmount) || 0;
      const rawSpend = cat.value ?? cat.amount ?? cat.currentAmount;
      const current = Math.max(0, Number(rawSpend) || 0);
      return limit > 0 || current > 0;
    })
    .map((cat: StatCategoryPoint) => {
      const limit = Number(cat.limitAmount) || 0;
      const rawSpend = cat.value ?? cat.amount ?? cat.currentAmount;
      const current = Math.max(0, Number(rawSpend) || 0);
      const rawTitle = typeof cat.title === "string" ? cat.title.trim() : "";
      const rawName = typeof cat.name === "string" ? cat.name.trim() : "";
      const name = rawTitle || rawName || categoryNameMap.get(cat.id) || "Category";
      let percent = 0;
      if (limit > 0) {
        percent = Math.round((current / limit) * 100);
      } else if (current > 0) {
        percent = 100;
      }
      const isOverrun = limit > 0 && current > limit;
      return {
        id: cat.id,
        name,
        limit,
        current,
        percent: Math.min(100, percent),
        rawPercent: percent,
        isOverrun,
      };
    })
    .sort((a, b) => b.rawPercent - a.rawPercent);
}

interface BudgetSummaryCardProps {
  categories?: ExternalProviderCategory[];
  defaultCurrency?: string;
  activeMonthDateStr?: string;
  periodMonth?: BudgetPeriodMonth;
  customFromDate?: string | null;
  statData?: StatPingData | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onReorderCategories?: (reorderedVisibleIds: string[]) => Promise<void>;
  lastTransactionByCategoryId?: Map<string, LastTransactionSummary>;
  categoryDeltaMap?: Map<string, CategoryComparisonDelta>;
}

export function BudgetSummaryCard({
  categories = [],
  defaultCurrency = "PLN",
  activeMonthDateStr,
  periodMonth = "current",
  customFromDate,
  statData: controlledStatData,
  isLoading: controlledIsLoading,
  error: controlledError,
  onRetry: controlledOnRetry,
  onReorderCategories,
  lastTransactionByCategoryId,
  categoryDeltaMap,
}: BudgetSummaryCardProps) {
  const [sortMode, setSortMode] = useState<BudgetSortMode>("custom");
  const [showArchived, setShowArchived] = useState(false);

  const [internalStatData, setInternalStatData] = useState<StatPingData | null>(null);
  const [internalIsLoading, setInternalIsLoading] = useState(true);
  const [internalError, setInternalError] = useState<Error | null>(null);

  const isControlled = controlledStatData !== undefined;
  const statData = isControlled ? controlledStatData : internalStatData;
  const isLoading = isControlled ? (controlledIsLoading ?? false) : internalIsLoading;
  const error = isControlled ? (controlledError ?? null) : internalError;

  const fromDate = useMemo(() => {
    if (activeMonthDateStr) {
      return activeMonthDateStr;
    }
    if (customFromDate) {
      return customFromDate;
    }
    const now = new Date();
    if (periodMonth === "previous") {
      return format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    }
    return format(startOfMonth(now), "yyyy-MM-dd");
  }, [activeMonthDateStr, periodMonth, customFromDate]);

  const fetchBudget = useCallback(
    async (signal?: AbortSignal, forceRefresh?: boolean) => {
      setInternalIsLoading(true);
      setInternalError(null);
      try {
        const data = await getBudgetSelection({ from: fromDate, signal, forceRefresh });
        setInternalStatData(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setInternalError(err instanceof Error ? err : new Error("Failed to load budget data"));
      } finally {
        setInternalIsLoading(false);
      }
    },
    [fromDate],
  );

  useEffect(() => {
    if (isControlled) return;
    const controller = new AbortController();
    void fetchBudget(controller.signal);
    return () => {
      controller.abort();
    };
  }, [isControlled, fetchBudget]);

  const handleRetry = useCallback(() => {
    if (controlledOnRetry) {
      controlledOnRetry();
    } else {
      void fetchBudget(undefined, true);
    }
  }, [controlledOnRetry, fetchBudget]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) {
      map.set(c.id, typeof c.order === "number" ? c.order : 0);
    }
    return map;
  }, [categories]);

  const categoryTypeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) {
      if (typeof c.categoryType === "number") {
        map.set(c.id, c.categoryType);
      }
    }
    return map;
  }, [categories]);

  const currency = statData?.selection?.params?.currency ?? defaultCurrency;

  // Raw budget items computed from stats
  const allBudgetItems = useMemo(
    () => computeBudgetSummaryItems(statData, fromDate, categoryNameMap, categoryTypeMap, { includeAll: showArchived }),
    [statData, fromDate, categoryNameMap, categoryTypeMap, showArchived],
  );

  // Filter archived items
  const classifiedItems = useMemo(() => {
    return filterAndClassifyCategories(allBudgetItems, { showArchived });
  }, [allBudgetItems, showArchived]);

  // Count hidden inactive archived items
  const hiddenArchivedCount = useMemo(() => {
    const all = computeBudgetSummaryItems(statData, fromDate, categoryNameMap, categoryTypeMap, { includeAll: true });
    return all.filter((it) => {
      const isArchived = typeof it.name === "string" && it.name.trim().startsWith("_");
      const isInactive = it.current === 0 && it.limit === 0;
      return isArchived && isInactive;
    }).length;
  }, [statData, fromDate, categoryNameMap, categoryTypeMap]);

  // Sorted items based on sortMode ("custom" vs "percent")
  const sortedItems = useMemo(() => {
    if (sortMode === "percent") {
      return [...classifiedItems].sort((a, b) => b.item.rawPercent - a.item.rawPercent);
    }
    // "custom" mode sorts by ExternalProvider order ascending, tie-breaking by id
    return [...classifiedItems].sort((a, b) => {
      const orderA = categoryOrderMap.get(a.item.id) ?? 0;
      const orderB = categoryOrderMap.get(b.item.id) ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.item.id.localeCompare(b.item.id);
    });
  }, [classifiedItems, sortMode, categoryOrderMap]);

  const canReorder = sortMode === "custom" && Boolean(onReorderCategories);

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation;

    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
      return;
    }

    const visibleIds = sortedItems.map((c) => c.item.id);
    const [moved] = visibleIds.splice(source.initialIndex, 1);
    visibleIds.splice(source.index, 0, moved);

    if (onReorderCategories) {
      void onReorderCategories(visibleIds);
    }
  }

  return (
    <SectionShell
      title="Budget Spent vs Limit"
      description={`Reporting currency: ${currency}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Order vs % Spent Sort Mode Switch */}
          <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                sortMode === "custom"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSortMode("custom")}
            >
              Custom Order
            </button>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                sortMode === "percent"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSortMode("percent")}
            >
              % Spent
            </button>
          </div>

          {/* Archived Toggle */}
          {(hiddenArchivedCount > 0 || showArchived) && (
            <Button
              type="button"
              variant={showArchived ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setShowArchived((prev) => !prev)}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Archive className="text-muted-foreground size-3" />
              <span>{showArchived ? "Hide archived" : `Show archived (${hiddenArchivedCount})`}</span>
            </Button>
          )}
        </div>
      }
      isLoading={isLoading}
      error={error}
      onRetry={handleRetry}
      isEmpty={sortedItems.length === 0}
      emptyTitle="No budget limits defined"
      emptyDescription="No categories with active budget limits or spending found for this period."
      emptyIcon={<PiggyBank className="text-muted-foreground size-6" />}
      skeletonCount={4}
      skeletonHeight="h-14"
    >
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4">
          {sortedItems.map(({ item, isArchived }, index) => {
            const lastTx = lastTransactionByCategoryId?.get(item.id);
            const delta = categoryDeltaMap?.get(item.id);

            return (
              <SortableBudgetCategoryRow
                key={item.id}
                id={item.id}
                index={index}
                item={item}
                currency={currency}
                isArchived={isArchived}
                lastTx={lastTx}
                canReorder={canReorder}
                delta={delta}
              />
            );
          })}
        </div>
      </DragDropProvider>
    </SectionShell>
  );
}

function formatCategoryDelta(delta: CategoryComparisonDelta, currency: string): string {
  const sign = delta.deltaAbs > 0 ? "+" : "";
  const money = formatMoney(delta.deltaAbs, currency);
  if (delta.isNew) {
    return `${sign}${money} (New)`;
  }
  if (delta.deltaPercent !== null) {
    const pctSign = delta.deltaPercent > 0 ? "+" : "";
    return `${sign}${money} (${pctSign}${delta.deltaPercent.toFixed(0)}%)`;
  }
  return `${sign}${money}`;
}

interface SortableBudgetCategoryRowProps {
  id: string;
  index: number;
  item: BudgetSummaryItem;
  currency: string;
  isArchived: boolean;
  lastTx?: LastTransactionSummary | null;
  canReorder: boolean;
  delta?: CategoryComparisonDelta;
}

function SortableBudgetCategoryRow({
  id,
  index,
  item,
  currency,
  isArchived,
  lastTx,
  canReorder,
  delta,
}: SortableBudgetCategoryRowProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    type: "budget-category-row",
    accept: "budget-category-row",
    group: "budget-categories",
    modifiers: [RestrictToVerticalAxis],
    disabled: !canReorder,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "group/row flex flex-col gap-1.5 transition-opacity",
        isDragging && "bg-muted/40 relative z-10 rounded-lg p-2 opacity-50",
        isArchived && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          {canReorder && (
            <Button
              ref={handleRef}
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground/40 hover:text-foreground -ml-1 cursor-grab opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
              aria-label={`Reorder ${item.name}`}
            >
              <GripVertical className="size-3.5" />
            </Button>
          )}

          <span className="truncate">{item.name}</span>

          {item.isOverrun && (
            <Badge variant="destructive" className="h-4 gap-1 px-1 text-[10px] font-normal">
              <AlertTriangle className="size-2.5" />
              Overrun
            </Badge>
          )}

          {isArchived && (
            <Badge variant="secondary" className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal">
              Archived
            </Badge>
          )}

          {lastTx && <LastTransactionBadge summary={lastTx} />}
        </div>

        <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 pl-2">
          {delta && delta.deltaAbs !== 0 && (
            <span
              className={cn(
                "mr-0.5 text-[10px] font-medium tabular-nums",
                delta.deltaAbs > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {formatCategoryDelta(delta, currency)}
            </span>
          )}
          <span className={item.isOverrun ? "text-destructive font-semibold" : "text-foreground font-medium"}>
            {formatMoney(item.current, currency)}
          </span>
          <span>/</span>
          <span>{formatMoney(item.limit, currency)}</span>
          <span className="ml-1 text-[11px]">({item.rawPercent}%)</span>
        </div>
      </div>
      <Progress value={item.percent} className={cn("h-2", item.isOverrun && "[&>div]:bg-destructive")} />
    </div>
  );
}
