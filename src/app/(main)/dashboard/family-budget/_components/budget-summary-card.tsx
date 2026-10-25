"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { format, startOfMonth, subMonths } from "date-fns";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpToLine,
  GripVertical,
  MoreHorizontal,
  PiggyBank,
  Receipt,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

import { getBudgetSelection } from "./external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  detectExpenseCategoryDisplacement,
  filterAndClassifyCategories,
  formatMoney,
  getCategoryCurrencyTier,
  isArchivedCategoryName,
  isExpenseCategory,
  type LastTransactionSummary,
  organizeExpenseCategoriesByCurrencyTier,
  type StatCategoryPoint,
  type StatPingData,
} from "./external-provider-data";
import type { CategoryComparisonDelta, ExpenseSlice } from "./expense-transforms";
import { LastTransactionBadge } from "./last-transaction-badge";
import { SectionShell } from "./section-shell";
import { parsePointDate } from "./yoy-transforms";

export type BudgetPeriodMonth = "current" | "previous";
export type BudgetSortMode = "custom" | "percent";
export type BudgetViewMode = "active" | "all";

export interface BudgetSummaryItem {
  id: string;
  name: string;
  limit: number;
  current: number;
  percent: number;
  rawPercent: number;
  isOverrun: boolean;
}

export interface ComputeBudgetSummaryItemsOptions {
  includeAll?: boolean;
  includeDeleted?: boolean;
  includeArchivedInactive?: boolean;
  categoryTypeMap?: Map<string, number>;
  categoryDeletedMap?: Map<string, boolean>;
  deletedCategoryIds?: Set<string>;
}

export function computeBudgetSummaryItems(
  statData: StatPingData | null | undefined,
  fromDate: string,
  categoryNameMap: Map<string, string>,
  categoryTypeMapOrOptions?: Map<string, number> | ComputeBudgetSummaryItemsOptions,
  options?: ComputeBudgetSummaryItemsOptions,
): BudgetSummaryItem[] {
  const mergedOpts: ComputeBudgetSummaryItemsOptions =
    categoryTypeMapOrOptions instanceof Map
      ? { ...options, categoryTypeMap: categoryTypeMapOrOptions }
      : { ...categoryTypeMapOrOptions, ...options };

  const categoryTypeMap = mergedOpts.categoryTypeMap;
  const categoryDeletedMap = mergedOpts.categoryDeletedMap;
  const deletedCategoryIds = mergedOpts.deletedCategoryIds;
  const includeAll = mergedOpts.includeAll ?? false;
  const includeDeleted = mergedOpts.includeDeleted ?? false;
  const includeArchivedInactive = mergedOpts.includeArchivedInactive ?? false;

  const points = statData?.selection?.points ?? [];
  if (points.length === 0) return [];

  // Find point matching selected month fromDate or default to latest point (points[0])
  const activePoint = points.find((p) => p.id === fromDate || parsePointDate(p)?.dateStr === fromDate) ?? points[0];

  if (!activePoint?.categories) return [];

  return activePoint.categories
    .filter((cat: StatCategoryPoint) => {
      if (!includeDeleted) {
        if ((cat as { deleted?: boolean }).deleted === true) return false;
        if (deletedCategoryIds?.has(cat.id)) return false;
        if (categoryDeletedMap?.get(cat.id) === true) return false;
      }

      if (categoryTypeMap) {
        const type = categoryTypeMap.get(cat.id);
        if (type !== undefined && type !== CategoryType.Expense) {
          return false;
        }
      }

      const rawTitle = typeof cat.title === "string" ? cat.title.trim() : "";
      const rawName = typeof cat.name === "string" ? cat.name.trim() : "";
      const name = rawTitle || rawName || categoryNameMap.get(cat.id) || "Category";

      if (includeAll) return true;

      const limit = Number(cat.limitAmount) || 0;
      const rawSpend = cat.value ?? cat.amount ?? cat.currentAmount;
      const current = Math.max(0, Number(rawSpend) || 0);

      if (limit > 0 || current > 0) return true;

      if (includeArchivedInactive && isArchivedCategoryName(name)) {
        return true;
      }

      return false;
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
  onSelectCategory?: (slice: ExpenseSlice) => void;
  onArchiveCategory?: (categoryId: string) => Promise<void> | void;
  onUnarchiveCategory?: (categoryId: string) => Promise<void> | void;
  onMoveCategoriesAboveArchived?: (categoryIds?: string[]) => Promise<void> | void;
  onMoveCategoriesToBottom?: (categoryIds?: string[]) => Promise<void> | void;
  onOrganizeByCurrencyTier?: () => Promise<void> | void;
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
  onSelectCategory,
  onArchiveCategory,
  onUnarchiveCategory,
  onMoveCategoriesAboveArchived,
  onMoveCategoriesToBottom,
  onOrganizeByCurrencyTier,
}: BudgetSummaryCardProps) {
  const [sortMode, setSortMode] = useState<BudgetSortMode>("custom");
  const [viewMode, setViewMode] = useState<BudgetViewMode>("active");
  const [showArchived, setShowArchived] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

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

  const deletedCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) {
      if (c.deleted) set.add(c.id);
    }
    return set;
  }, [categories]);

  const currency = statData?.selection?.params?.currency ?? defaultCurrency;

  // Raw budget items computed from stats: strictly active items + inactive archived when toggled, never unarchived zero-spend, never soft-deleted
  const allBudgetItems = useMemo(
    () =>
      computeBudgetSummaryItems(statData, fromDate, categoryNameMap, {
        categoryTypeMap,
        deletedCategoryIds,
        includeArchivedInactive: showArchived,
      }),
    [statData, fromDate, categoryNameMap, categoryTypeMap, deletedCategoryIds, showArchived],
  );

  // Active/non-deleted expense categories for full directory view
  const activeExpenseCategories = useMemo(
    () => categories.filter((c) => !c.deleted && isExpenseCategory(c)),
    [categories],
  );
  const removedExpenseCategories = useMemo(
    () => (showRemoved ? categories.filter((c) => c.deleted && isExpenseCategory(c)) : []),
    [categories, showRemoved],
  );
  const removedCategoriesCount = useMemo(
    () => categories.filter((c) => c.deleted && isExpenseCategory(c)).length,
    [categories],
  );

  // Three-tier placement: active -> archived -> removed
  const expenseCategories = useMemo(
    () => [...activeExpenseCategories, ...removedExpenseCategories],
    [activeExpenseCategories, removedExpenseCategories],
  );

  const allCategoryItems = useMemo(() => {
    const statItems = new Map(
      computeBudgetSummaryItems(statData, fromDate, categoryNameMap, {
        categoryTypeMap,
        includeDeleted: true,
        includeAll: true,
      }).map((it) => [it.id, it]),
    );
    return expenseCategories.map<BudgetSummaryItem>(
      (c) =>
        statItems.get(c.id) ?? {
          id: c.id,
          name: c.name,
          limit: 0,
          current: 0,
          percent: 0,
          rawPercent: 0,
          isOverrun: false,
        },
    );
  }, [statData, fromDate, categoryNameMap, categoryTypeMap, expenseCategories]);

  const displacement = useMemo(() => detectExpenseCategoryDisplacement(categories), [categories]);
  const categoriesBelowArchived = displacement.activeBelow;
  const categoriesArchivedAbove = displacement.archivedAbove;
  const belowArchivedIds = useMemo(() => new Set(categoriesBelowArchived.map((c) => c.id)), [categoriesBelowArchived]);
  const archivedAboveIds = useMemo(() => new Set(categoriesArchivedAbove.map((c) => c.id)), [categoriesArchivedAbove]);

  const canOrganizeByTier = useMemo(
    () => organizeExpenseCategoriesByCurrencyTier(categories, defaultCurrency).modifiedCategories.length > 0,
    [categories, defaultCurrency],
  );

  // Filter archived items
  const classifiedItems = useMemo(() => {
    if (viewMode === "all") {
      return allCategoryItems.map((item) => ({
        item,
        isArchived: isArchivedCategoryName(item.name),
        isRemoved: deletedCategoryIds.has(item.id),
        isActive: true,
      }));
    }
    const classified = filterAndClassifyCategories(allBudgetItems, { showArchived });
    const result = classified.map((c) => ({
      ...c,
      isRemoved: deletedCategoryIds.has(c.item.id),
    }));
    if (showRemoved && removedExpenseCategories.length > 0) {
      const removedMap = new Map(
        computeBudgetSummaryItems(statData, fromDate, categoryNameMap, {
          categoryTypeMap,
          includeDeleted: true,
          includeAll: true,
        }).map((it) => [it.id, it]),
      );
      for (const r of removedExpenseCategories) {
        const item = removedMap.get(r.id) ?? {
          id: r.id,
          name: r.name,
          limit: 0,
          current: 0,
          percent: 0,
          rawPercent: 0,
          isOverrun: false,
        };
        result.push({
          item,
          isArchived: isArchivedCategoryName(r.name),
          isRemoved: true,
          isActive: false,
        });
      }
    }
    return result;
  }, [
    viewMode,
    allCategoryItems,
    deletedCategoryIds,
    allBudgetItems,
    showArchived,
    showRemoved,
    removedExpenseCategories,
    statData,
    fromDate,
    categoryNameMap,
    categoryTypeMap,
  ]);

  // Count hidden inactive archived items
  const hiddenArchivedCount = useMemo(() => {
    const all = computeBudgetSummaryItems(statData, fromDate, categoryNameMap, {
      categoryTypeMap,
      deletedCategoryIds,
      includeAll: true,
    });
    return all.filter((it) => {
      const isArchived = typeof it.name === "string" && isArchivedCategoryName(it.name);
      const isInactive = it.current === 0 && it.limit === 0;
      return isArchived && isInactive;
    }).length;
  }, [statData, fromDate, categoryNameMap, categoryTypeMap, deletedCategoryIds]);

  // Sorted items based on sortMode ("custom" vs "percent") with strict hierarchy: active/archived -> removed
  const sortedItems = useMemo(() => {
    return [...classifiedItems].sort((a, b) => {
      if (Boolean(a.isRemoved) !== Boolean(b.isRemoved)) {
        return a.isRemoved ? 1 : -1;
      }
      if (viewMode !== "all" && sortMode === "percent") {
        return b.item.rawPercent - a.item.rawPercent;
      }
      // "custom" mode sorts by ExternalProvider order ascending, tie-breaking by id
      const orderA = categoryOrderMap.get(a.item.id) ?? 0;
      const orderB = categoryOrderMap.get(b.item.id) ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.item.id.localeCompare(b.item.id);
    });
  }, [classifiedItems, sortMode, viewMode, categoryOrderMap]);

  const canReorder = (viewMode === "all" || sortMode === "custom") && Boolean(onReorderCategories);

  function handleSelect(item: BudgetSummaryItem) {
    onSelectCategory?.({ id: item.id, name: item.name, amount: item.current, percentage: item.rawPercent });
  }

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
          {/* Active in Month vs All Categories view */}
          <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
            <button
              type="button"
              aria-pressed={viewMode === "active"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                viewMode === "active"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("active")}
            >
              Active in Month
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "all"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                viewMode === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("all")}
            >
              All Categories ({expenseCategories.length})
            </button>
          </div>

          {/* Custom Order vs % Spent Sort Mode Switch */}
          <div
            className={cn(
              "bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs",
              viewMode === "all" && "hidden",
            )}
          >
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

          {/* Foreign / legacy currency tier ordering */}
          {onOrganizeByCurrencyTier && canOrganizeByTier && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void onOrganizeByCurrencyTier()}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <ArrowUpToLine className="size-3" />
              <span>Foreign currency above archived</span>
            </Button>
          )}

          {/* Archived Toggle */}
          {viewMode === "active" && (hiddenArchivedCount > 0 || showArchived) && (
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

          {/* Removed Toggle */}
          {(removedCategoriesCount > 0 || showRemoved) && (
            <Button
              type="button"
              variant={showRemoved ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setShowRemoved((prev) => !prev)}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Trash2 className="text-muted-foreground size-3" />
              <span>{showRemoved ? "Hide removed" : `Show removed (${removedCategoriesCount})`}</span>
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
      {displacement.direction === "move-archived-to-bottom" && onMoveCategoriesToBottom && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <span className="text-foreground font-medium">
              {categoriesArchivedAbove.length === 1
                ? "1 archived expense category is positioned above active categories"
                : `${categoriesArchivedAbove.length} archived expense categories are positioned above active categories`}
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void onMoveCategoriesToBottom()}
            className="h-7 gap-1.5 border-amber-500/30 text-xs font-medium hover:bg-amber-500/15"
          >
            <ArrowDownToLine className="size-3.5" />
            <span>Move archived to bottom</span>
          </Button>
        </div>
      )}

      {displacement.direction === "move-active-above-archived" && onMoveCategoriesAboveArchived && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <span className="text-foreground font-medium">
              {categoriesBelowArchived.length === 1
                ? "1 active expense category is positioned below archived categories"
                : `${categoriesBelowArchived.length} active expense categories are positioned below archived categories`}
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void onMoveCategoriesAboveArchived()}
            className="h-7 gap-1.5 border-amber-500/30 text-xs font-medium hover:bg-amber-500/15"
          >
            <ArrowUpToLine className="size-3.5" />
            <span>Move above archived</span>
          </Button>
        </div>
      )}

      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4">
          {sortedItems.map(({ item, isArchived, isRemoved }, index) => {
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
                isRemoved={isRemoved}
                lastTx={lastTx}
                canReorder={canReorder}
                delta={delta}
                order={categoryOrderMap.get(item.id)}
                isForeign={getCategoryCurrencyTier(item.name, defaultCurrency) === "foreign"}
                isBelowArchived={belowArchivedIds.has(item.id)}
                isArchivedAbove={archivedAboveIds.has(item.id)}
                onSelect={onSelectCategory ? () => handleSelect(item) : undefined}
                onArchive={onArchiveCategory}
                onUnarchive={onUnarchiveCategory}
                onMoveAboveArchived={onMoveCategoriesAboveArchived}
                onMoveToBottom={onMoveCategoriesToBottom}
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
  isRemoved?: boolean;
  lastTx?: LastTransactionSummary | null;
  canReorder: boolean;
  delta?: CategoryComparisonDelta;
  order?: number;
  isForeign?: boolean;
  isBelowArchived?: boolean;
  isArchivedAbove?: boolean;
  onSelect?: () => void;
  onArchive?: (categoryId: string) => Promise<void> | void;
  onUnarchive?: (categoryId: string) => Promise<void> | void;
  onMoveAboveArchived?: (categoryIds?: string[]) => Promise<void> | void;
  onMoveToBottom?: (categoryIds?: string[]) => Promise<void> | void;
}

function SortableBudgetCategoryRow({
  id,
  index,
  item,
  currency,
  isArchived,
  isRemoved,
  lastTx,
  canReorder,
  delta,
  order,
  isForeign,
  isBelowArchived,
  isArchivedAbove,
  onSelect,
  onArchive,
  onUnarchive,
  onMoveAboveArchived,
  onMoveToBottom,
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
        isRemoved && "bg-muted/20 rounded-md p-1 opacity-60",
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

          {order !== undefined && (
            <Badge variant="outline" className="h-4 px-1 font-mono text-[10px] font-normal">
              #{order}
            </Badge>
          )}

          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              aria-label={`Inspect transactions for ${item.name}`}
              className="focus-visible:ring-ring cursor-pointer truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-2"
            >
              {item.name}
            </button>
          ) : (
            <span className="truncate">{item.name}</span>
          )}

          {isForeign && !isArchived && !isRemoved && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
              Foreign
            </Badge>
          )}

          {isBelowArchived && !isArchived && !isRemoved && onMoveAboveArchived && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => void onMoveAboveArchived([id])}
              className="size-4 text-amber-500 hover:text-amber-600"
              aria-label={`Move ${item.name} above archived`}
              title="Positioned below archived categories. Click to move up."
            >
              <AlertTriangle className="size-3.5" />
            </Button>
          )}

          {isArchivedAbove && !isRemoved && onMoveToBottom && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => void onMoveToBottom([id])}
              className="size-4 text-amber-500 hover:text-amber-600"
              aria-label={`Move ${item.name} to bottom`}
              title="Positioned above active categories. Click to move to bottom."
            >
              <AlertTriangle className="size-3.5" />
            </Button>
          )}

          {item.isOverrun && (
            <Badge variant="destructive" className="h-4 gap-1 px-1 text-[10px] font-normal">
              <AlertTriangle className="size-2.5" />
              Overrun
            </Badge>
          )}

          {isArchived && !isRemoved && (
            <Badge variant="secondary" className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal">
              Archived
            </Badge>
          )}

          {isRemoved && (
            <Badge
              variant="outline"
              className="text-muted-foreground/80 border-dashed px-1.5 py-0 text-[10px] font-normal"
            >
              Removed
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

          {Boolean(onSelect ?? onArchive ?? onUnarchive ?? onMoveAboveArchived ?? onMoveToBottom) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground/60 hover:text-muted-foreground size-6 shrink-0"
                  aria-label={`Actions for ${item.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {onSelect && (
                  <DropdownMenuItem onClick={onSelect}>
                    <Receipt className="mr-2 size-4" />
                    <span>Inspect Transactions</span>
                  </DropdownMenuItem>
                )}
                {isBelowArchived && !isArchived && !isRemoved && onMoveAboveArchived && (
                  <DropdownMenuItem onClick={() => void onMoveAboveArchived([id])}>
                    <ArrowUpToLine className="mr-2 size-4" />
                    <span>Move above archived</span>
                  </DropdownMenuItem>
                )}
                {onMoveToBottom && (isArchived || isRemoved === true || isArchivedAbove === true) && (
                  <DropdownMenuItem onClick={() => void onMoveToBottom([id])}>
                    <ArrowDownToLine className="mr-2 size-4" />
                    <span>Move to bottom</span>
                  </DropdownMenuItem>
                )}
                {!isRemoved &&
                  (isArchived
                    ? onUnarchive && (
                        <DropdownMenuItem onClick={() => void onUnarchive(id)}>
                          <ArchiveRestore className="mr-2 size-4" />
                          <span>Unarchive</span>
                        </DropdownMenuItem>
                      )
                    : onArchive && (
                        <DropdownMenuItem onClick={() => void onArchive(id)}>
                          <Archive className="mr-2 size-4" />
                          <span>Archive</span>
                        </DropdownMenuItem>
                      ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <Progress value={item.percent} className={cn("h-2", item.isOverrun && "[&>div]:bg-destructive")} />
    </div>
  );
}
