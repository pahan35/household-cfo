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
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Receipt,
  Sparkles,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { CategoryOrganizationDialog, type CategoryOrganizationStrategy } from "./category-organization-dialog";
import { getBudgetSelection } from "./external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  detectExpenseCategoryDisplacement,
  evaluateZeroSpendCategories,
  extractCanonicalBaseName,
  filterAndClassifyCategories,
  formatMoney,
  getCategoryCurrencyTier,
  isArchivedCategoryName,
  isExpenseCategory,
  type LastTransactionSummary,
  type StatCategoryPoint,
  type StatPingData,
  type ZeroSpendLookbackScope,
} from "./external-provider-data";
import { type CategoryComparisonDelta, detectSliceCurrency, type ExpenseSlice } from "./expense-transforms";
import { LastTransactionBadge } from "./last-transaction-badge";
import { RenameCategoryDialog } from "./rename-category-dialog";
import { SectionShell } from "./section-shell";
import { normalizeMonthDate, parsePointDate } from "./yoy-transforms";

export type BudgetPeriodMonth = "current" | "previous";
export type BudgetSortMode = "custom" | "percent";
export type BudgetViewMode = "active" | "all" | "zero-spend";

export interface BudgetSummaryItem {
  id: string;
  name: string;
  limit: number;
  current: number;
  percent: number;
  rawPercent: number;
  isOverrun: boolean;
  nativeCurrency?: string;
  isForeign?: boolean;
  convertedCurrent?: number;
  convertedLimit?: number;
  isSmartGroup?: boolean;
  children?: BudgetSummaryItem[];
}

export interface ComputeBudgetSummaryItemsOptions {
  includeAll?: boolean;
  includeDeleted?: boolean;
  includeArchivedInactive?: boolean;
  categoryTypeMap?: Map<string, number>;
  categoryDeletedMap?: Map<string, boolean>;
  deletedCategoryIds?: Set<string>;
  categoryCurrencyMap?: Map<string, string>;
  defaultCurrency?: string;
  currencies?: ExternalProviderCurrency[];
  enableSmartGroups?: boolean;
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

  // Strictly match selected month by normalized month start or point id/date without stale-month fallback
  const normalizedFromDate = normalizeMonthDate(fromDate);
  const activePoint = points.find(
    (p) =>
      p.id === normalizedFromDate ||
      p.id === fromDate ||
      parsePointDate(p)?.dateStr === normalizedFromDate ||
      parsePointDate(p)?.dateStr === fromDate,
  );

  if (!activePoint?.categories) return [];

  const mapped = activePoint.categories
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

      const mappedName = categoryNameMap.get(cat.id)?.trim();
      const rawTitle = typeof cat.title === "string" ? cat.title.trim() : "";
      const rawName = typeof cat.name === "string" ? cat.name.trim() : "";
      const name = mappedName || rawTitle || rawName || "Category";

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
      const reportingSpend = Math.max(0, Number(rawSpend) || 0);
      const mappedName = categoryNameMap.get(cat.id)?.trim();
      const rawTitle = typeof cat.title === "string" ? cat.title.trim() : "";
      const rawName = typeof cat.name === "string" ? cat.name.trim() : "";
      const name = mappedName || rawTitle || rawName || "Category";

      const defaultCurr = mergedOpts.defaultCurrency ?? "PLN";
      const catCurrency = mergedOpts.categoryCurrencyMap?.get(cat.id);
      const det = detectSliceCurrency(name, defaultCurr);
      const nativeCurrency = catCurrency ?? det.currency;
      const isForeign = nativeCurrency.toUpperCase() !== defaultCurr.toUpperCase();
      const currencies = mergedOpts.currencies ?? [];

      let current: number;
      let convertedCurrent: number;
      let convertedLimit = 0;

      if (isForeign) {
        current = convertCurrencyAmount(reportingSpend, defaultCurr, nativeCurrency, currencies) ?? reportingSpend;
        convertedCurrent = reportingSpend;
        if (limit > 0) {
          convertedLimit = convertCurrencyAmount(limit, nativeCurrency, defaultCurr, currencies) ?? limit;
        }
      } else {
        current = reportingSpend;
        convertedCurrent = reportingSpend;
        convertedLimit = limit;
      }

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
        nativeCurrency,
        isForeign,
        convertedCurrent,
        convertedLimit,
      };
    });

  if (mergedOpts.enableSmartGroups) {
    const defaultCurr = mergedOpts.defaultCurrency ?? "PLN";
    const canonicalGroups = new Map<string, BudgetSummaryItem[]>();
    for (const item of mapped) {
      const base = extractCanonicalBaseName(item.name, defaultCurr);
      const existing = canonicalGroups.get(base) ?? [];
      existing.push(item);
      canonicalGroups.set(base, existing);
    }

    const groupedItems: BudgetSummaryItem[] = [];
    for (const [canonicalBase, groupItems] of canonicalGroups.entries()) {
      if (groupItems.length >= 2) {
        const combinedCurrent = groupItems.reduce((acc, it) => acc + (it.convertedCurrent ?? it.current), 0);
        const combinedLimit = groupItems.reduce((acc, it) => acc + (it.convertedLimit ?? it.limit), 0);
        let combinedPercent = 0;
        if (combinedLimit > 0) {
          combinedPercent = Math.round((combinedCurrent / combinedLimit) * 100);
        } else if (combinedCurrent > 0) {
          combinedPercent = 100;
        }
        const hasOverrun =
          groupItems.some((it) => it.isOverrun) || (combinedLimit > 0 && combinedCurrent > combinedLimit);

        groupedItems.push({
          id: `group-${canonicalBase.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: canonicalBase,
          limit: combinedLimit,
          current: combinedCurrent,
          percent: Math.min(100, combinedPercent),
          rawPercent: combinedPercent,
          isOverrun: hasOverrun,
          isSmartGroup: true,
          nativeCurrency: defaultCurr,
          isForeign: false,
          convertedCurrent: combinedCurrent,
          convertedLimit: combinedLimit,
          children: groupItems,
        });
      } else {
        groupedItems.push(groupItems[0]);
      }
    }
    return groupedItems.sort((a, b) => b.rawPercent - a.rawPercent);
  }

  return mapped.sort((a, b) => b.rawPercent - a.rawPercent);
}

export interface BudgetSummaryCardProps {
  categories?: ExternalProviderCategory[];
  currencies?: ExternalProviderCurrency[];
  periodTransactions?: ExternalProviderTransaction[];
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
  onCategoriesUpdated?: (updatedCategories: ExternalProviderCategory[]) => void;
}

export function BudgetSummaryCard({
  categories = [],
  currencies = [],
  periodTransactions: _periodTransactions = [],
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
  onOrganizeByCurrencyTier: _onOrganizeByCurrencyTier,
  onCategoriesUpdated,
}: BudgetSummaryCardProps) {
  const [sortMode, setSortMode] = useState<BudgetSortMode>("custom");
  const [viewMode, setViewMode] = useState<BudgetViewMode>("active");
  const [showArchived, setShowArchived] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<ExternalProviderCategory | null>(null);
  const [isOrganizeDialogOpen, setIsOrganizeDialogOpen] = useState(false);
  const [initialOrgStrategy, setInitialOrgStrategy] = useState<CategoryOrganizationStrategy>("smart-order");
  const [zeroSpendScope, setZeroSpendScope] = useState<ZeroSpendLookbackScope>("current-month");

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

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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

  const categoryCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      if (c.currencyId) {
        map.set(c.id, c.currencyId);
      }
    }
    return map;
  }, [categories]);

  const currency = statData?.selection?.params?.currency ?? defaultCurrency;

  // Raw budget items computed from stats: strictly active items + inactive archived when toggled, never unarchived zero-spend, never soft-deleted
  const allBudgetItems = useMemo(
    () =>
      computeBudgetSummaryItems(statData, fromDate, categoryNameMap, {
        categoryTypeMap,
        deletedCategoryIds,
        includeArchivedInactive: showArchived,
        categoryCurrencyMap,
        defaultCurrency,
        currencies,
        enableSmartGroups: viewMode === "active",
      }),
    [
      statData,
      fromDate,
      categoryNameMap,
      categoryTypeMap,
      deletedCategoryIds,
      showArchived,
      categoryCurrencyMap,
      defaultCurrency,
      currencies,
      viewMode,
    ],
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
        categoryCurrencyMap,
        defaultCurrency,
        currencies,
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
          nativeCurrency: c.currencyId ?? detectSliceCurrency(c.name, defaultCurrency).currency,
          isForeign:
            (c.currencyId ?? detectSliceCurrency(c.name, defaultCurrency).currency).toUpperCase() !==
            defaultCurrency.toUpperCase(),
        },
    );
  }, [
    statData,
    fromDate,
    categoryNameMap,
    categoryTypeMap,
    expenseCategories,
    categoryCurrencyMap,
    defaultCurrency,
    currencies,
  ]);

  const displacement = useMemo(() => detectExpenseCategoryDisplacement(categories), [categories]);
  const categoriesBelowArchived = displacement.activeBelow;
  const categoriesArchivedAbove = displacement.archivedAbove;
  const belowArchivedIds = useMemo(() => new Set(categoriesBelowArchived.map((c) => c.id)), [categoriesBelowArchived]);
  const archivedAboveIds = useMemo(() => new Set(categoriesArchivedAbove.map((c) => c.id)), [categoriesArchivedAbove]);

  const zeroSpendEvals = useMemo(() => {
    return evaluateZeroSpendCategories(categories, statData?.selection?.points ?? [], zeroSpendScope, {
      activeMonthDateStr: fromDate,
      transactions: _periodTransactions,
      defaultCurrency,
    });
  }, [categories, statData, zeroSpendScope, fromDate, _periodTransactions, defaultCurrency]);

  const zeroSpendCount = useMemo(() => {
    return allCategoryItems.filter((item) => {
      if (isArchivedCategoryName(item.name)) return false;
      if (deletedCategoryIds.has(item.id)) return false;
      const evaluation = zeroSpendEvals.get(item.id);
      return evaluation ? evaluation.isZeroSpend : item.current === 0;
    }).length;
  }, [allCategoryItems, deletedCategoryIds, zeroSpendEvals]);

  // Filter archived items
  const classifiedItems = useMemo(() => {
    if (viewMode === "zero-spend") {
      return allCategoryItems
        .filter((item) => {
          const evaluation = zeroSpendEvals.get(item.id);
          const isZero = evaluation ? evaluation.isZeroSpend : item.current === 0;
          if (!isZero) return false;
          if (!showArchived && isArchivedCategoryName(item.name)) return false;
          if (!showRemoved && deletedCategoryIds.has(item.id)) return false;
          return true;
        })
        .map((item) => {
          const evaluation = zeroSpendEvals.get(item.id);
          return {
            item,
            isArchived: isArchivedCategoryName(item.name),
            isRemoved: deletedCategoryIds.has(item.id),
            isActive: false,
            isLifetimeDormant: evaluation?.isLifetimeDormant ?? false,
          };
        });
    }
    if (viewMode === "all") {
      return allCategoryItems.map((item) => ({
        item,
        isArchived: isArchivedCategoryName(item.name),
        isRemoved: deletedCategoryIds.has(item.id),
        isActive: true,
        isLifetimeDormant: false,
      }));
    }
    const classified = filterAndClassifyCategories(allBudgetItems, { showArchived });
    const result = classified.map((c) => ({
      ...c,
      isRemoved: deletedCategoryIds.has(c.item.id),
      isLifetimeDormant: false,
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
          isLifetimeDormant: false,
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
    zeroSpendEvals,
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

  const canReorder =
    viewMode !== "zero-spend" && (viewMode === "all" || sortMode === "custom") && Boolean(onReorderCategories);

  function handleSelect(item: BudgetSummaryItem) {
    onSelectCategory?.({
      id: item.id,
      name: item.name,
      amount: item.current,
      percentage: item.rawPercent,
      isSmartGroup: item.isSmartGroup,
      children: item.children?.map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.current,
        percentage: c.rawPercent,
      })),
    });
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
          {/* Active in Month vs Zero Spend vs All Categories view */}
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
              aria-pressed={viewMode === "zero-spend"}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                viewMode === "zero-spend"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("zero-spend")}
            >
              Zero Spend ({zeroSpendCount})
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
              viewMode !== "active" && "hidden",
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

          {/* Zero Spend Lookback Scope Selector */}
          {viewMode === "zero-spend" && (
            <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs">
              <button
                type="button"
                aria-pressed={zeroSpendScope === "current-month"}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  zeroSpendScope === "current-month"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setZeroSpendScope("current-month")}
              >
                Current Month
              </button>
              <button
                type="button"
                aria-pressed={zeroSpendScope === "3-months"}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  zeroSpendScope === "3-months"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setZeroSpendScope("3-months")}
              >
                3 Months
              </button>
              <button
                type="button"
                aria-pressed={zeroSpendScope === "6-months"}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  zeroSpendScope === "6-months"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setZeroSpendScope("6-months")}
              >
                6 Months
              </button>
              <button
                type="button"
                aria-pressed={zeroSpendScope === "12-months"}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  zeroSpendScope === "12-months"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setZeroSpendScope("12-months")}
              >
                12 Months
              </button>
              <button
                type="button"
                aria-pressed={zeroSpendScope === "all-time"}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  zeroSpendScope === "all-time"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setZeroSpendScope("all-time")}
              >
                All-Time / Lifetime
              </button>
            </div>
          )}

          {/* Unified Organize Categories Action */}
          <Button
            type="button"
            variant={displacement.direction !== "none" ? "secondary" : "outline"}
            size="xs"
            onClick={() => {
              if (displacement.direction !== "none") {
                setInitialOrgStrategy("tier-cleanup");
              } else {
                setInitialOrgStrategy("smart-order");
              }
              setIsOrganizeDialogOpen(true);
            }}
            className={cn(
              "h-7 gap-1.5 px-2 text-[11px]",
              displacement.direction !== "none" &&
                "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
            )}
          >
            <Sparkles className="size-3 text-primary" />
            <span>Organize Categories...</span>
            {displacement.direction !== "none" && (
              <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full px-1 text-[9px] font-semibold">
                {displacement.direction === "move-archived-to-bottom"
                  ? `${categoriesArchivedAbove.length} displaced`
                  : `${categoriesBelowArchived.length} displaced`}
              </span>
            )}
          </Button>

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
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4">
          {sortedItems.map(({ item, isArchived, isRemoved, isLifetimeDormant }, index) => {
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
                isLifetimeDormant={isLifetimeDormant}
                lastTx={lastTx}
                canReorder={canReorder}
                delta={delta}
                order={categoryOrderMap.get(item.id)}
                isForeign={getCategoryCurrencyTier(item.name, defaultCurrency) === "foreign"}
                isBelowArchived={belowArchivedIds.has(item.id)}
                isArchivedAbove={archivedAboveIds.has(item.id)}
                onSelect={onSelectCategory ? () => handleSelect(item) : undefined}
                onSelectChild={
                  onSelectCategory
                    ? (child) =>
                        onSelectCategory({
                          id: child.id,
                          name: child.name,
                          amount: child.current,
                          percentage: child.rawPercent,
                        })
                    : undefined
                }
                onArchive={onArchiveCategory}
                onUnarchive={onUnarchiveCategory}
                onMoveAboveArchived={onMoveCategoriesAboveArchived}
                onMoveToBottom={onMoveCategoriesToBottom}
                onRename={(catId) => {
                  const cat = categoryById.get(catId);
                  if (cat) setRenamingCategory(cat);
                }}
              />
            );
          })}
        </div>
      </DragDropProvider>

      <RenameCategoryDialog
        open={Boolean(renamingCategory)}
        onOpenChange={(open) => {
          if (!open) setRenamingCategory(null);
        }}
        category={renamingCategory}
        allCategories={categories}
        onSuccess={(_updatedCat, allUpdated) => {
          onCategoriesUpdated?.(allUpdated);
        }}
      />

      <CategoryOrganizationDialog
        open={isOrganizeDialogOpen}
        onOpenChange={setIsOrganizeDialogOpen}
        categories={categories}
        transactions={_periodTransactions}
        defaultCurrency={defaultCurrency}
        initialStrategy={initialOrgStrategy}
        onApplied={(updatedCats) => {
          onCategoriesUpdated?.(updatedCats);
        }}
      />
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
  isLifetimeDormant?: boolean;
  lastTx?: LastTransactionSummary | null;
  canReorder: boolean;
  delta?: CategoryComparisonDelta;
  order?: number;
  isForeign?: boolean;
  isBelowArchived?: boolean;
  isArchivedAbove?: boolean;
  onSelect?: () => void;
  onSelectChild?: (child: BudgetSummaryItem) => void;
  onArchive?: (categoryId: string) => Promise<void> | void;
  onUnarchive?: (categoryId: string) => Promise<void> | void;
  onMoveAboveArchived?: (categoryIds?: string[]) => Promise<void> | void;
  onMoveToBottom?: (categoryIds?: string[]) => Promise<void> | void;
  onRename?: (categoryId: string) => void;
}

function SortableBudgetCategoryRow({
  id,
  index,
  item,
  currency,
  isArchived,
  isRemoved,
  isLifetimeDormant,
  lastTx,
  canReorder,
  delta,
  order,
  isForeign,
  isBelowArchived,
  isArchivedAbove,
  onSelect,
  onSelectChild,
  onArchive,
  onUnarchive,
  onMoveAboveArchived,
  onMoveToBottom,
  onRename,
}: SortableBudgetCategoryRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    type: "budget-category-row",
    accept: "budget-category-row",
    group: "budget-categories",
    modifiers: [RestrictToVerticalAxis],
    disabled: !canReorder,
  });

  const hasForeignCurrency = Boolean(item.nativeCurrency && item.nativeCurrency !== currency);
  const isStandaloneForeign = !item.isSmartGroup && (item.isForeign ? true : hasForeignCurrency);
  const nativeCurr = item.nativeCurrency ?? currency;

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
          {item.isSmartGroup && item.children && item.children.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded((prev) => !prev);
              }}
              className="text-muted-foreground hover:text-foreground size-5 shrink-0 p-0"
              aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </Button>
          )}

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

          {item.isSmartGroup && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
              Smart Group
            </Badge>
          )}

          {!item.isSmartGroup && isForeign && !isArchived && !isRemoved && (
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

          {isLifetimeDormant && !isArchived && !isRemoved && (
            <Badge
              variant="outline"
              className="border-amber-500/30 text-amber-600 dark:text-amber-400 px-1 py-0 text-[10px] font-normal"
            >
              Dormant
            </Badge>
          )}

          {lastTx ? (
            <LastTransactionBadge summary={lastTx} defaultCurrency={currency} showLabel />
          ) : (
            <span className="text-muted-foreground/60 text-[10px]">No transactions</span>
          )}
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

          {isStandaloneForeign && nativeCurr !== currency ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex cursor-help items-center gap-1">
                    <span className={item.isOverrun ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                      {formatMoney(item.current, nativeCurr)}
                    </span>
                    <span>/</span>
                    <span>{formatMoney(item.limit, nativeCurr)}</span>
                    <span className="ml-1 text-[11px]">({item.rawPercent}%)</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <span>
                    Converted: ~{formatMoney(item.convertedCurrent ?? item.current, currency)} / ~
                    {formatMoney(item.convertedLimit ?? item.limit, currency)}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <>
              <span className={item.isOverrun ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                {formatMoney(item.current, currency)}
              </span>
              <span>/</span>
              <span>{formatMoney(item.limit, currency)}</span>
              <span className="ml-1 text-[11px]">({item.rawPercent}%)</span>
            </>
          )}

          {Boolean(onSelect ?? onRename ?? onArchive ?? onUnarchive ?? onMoveAboveArchived ?? onMoveToBottom) && (
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
                {onRename && (
                  <DropdownMenuItem onClick={() => onRename(id)}>
                    <Pencil className="mr-2 size-4" />
                    <span>Rename category...</span>
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

      {item.isSmartGroup && item.children && item.children.length > 0 && isExpanded && (
        <div className="border-border/40 bg-muted/10 mt-1 ml-4 flex flex-col gap-1 border-l-2 py-1 pl-3 text-xs">
          {item.children.map((child) => {
            const childCurr = child.nativeCurrency ?? currency;
            const isChildForeign = child.isForeign || childCurr !== currency;
            return (
              <button
                type="button"
                key={child.id}
                onClick={() => onSelectChild?.(child)}
                className="hover:bg-muted/30 group flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors select-none"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-muted-foreground size-1.5 shrink-0 rounded-full bg-current" />
                  <span className="text-foreground/90 group-hover:text-foreground truncate font-medium">
                    {child.name}
                  </span>
                  {isChildForeign && (
                    <Badge
                      variant="outline"
                      className="h-3.5 border-blue-500/30 px-1 text-[8px] font-normal text-blue-700 dark:text-blue-400"
                    >
                      {childCurr}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums">
                  <span className={child.isOverrun ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                    {formatMoney(child.current, childCurr)}
                  </span>
                  <span>/</span>
                  <span>{formatMoney(child.limit, childCurr)}</span>
                  <span className="text-[10px]">({child.rawPercent}%)</span>
                  {isChildForeign && (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground/70 hover:text-foreground ml-1 cursor-help underline decoration-dotted underline-offset-2">
                            (~{formatMoney(child.convertedCurrent ?? child.current, currency)})
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          <span>
                            Converted: ~{formatMoney(child.convertedCurrent ?? child.current, currency)} / ~
                            {formatMoney(child.convertedLimit ?? child.limit, currency)}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
