"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowUpToLine,
  Coins,
  GripVertical,
  MoreHorizontal,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  archiveIncomeSource,
  getCategories,
  reorderIncomeCategories,
  unarchiveIncomeSource,
} from "./external-provider-client";
import {
  CategoryType,
  type ClassifiedIncomeSource,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  filterAndClassifyIncomeSources,
  findIncomeSourcesBelowArchived,
  formatMoney,
  isArchivedCategoryName,
  type LastTransactionSummary,
  moveIncomeSourcesAboveArchived,
} from "./external-provider-data";
import { ExternalProviderIcon } from "./external-provider-icons";
import { LastTransactionBadge } from "./last-transaction-badge";
import { SectionShell } from "./section-shell";

export interface IncomeSourcesCardProps {
  categories?: ExternalProviderCategory[];
  currency?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onReorderSources?: (reorderedVisibleIds: string[]) => Promise<void>;
  onArchiveSource?: (sourceId: string) => Promise<void>;
  onUnarchiveSource?: (sourceId: string) => Promise<void>;
  onMoveSourcesAboveArchived?: (sourceIds?: string[]) => Promise<void>;
  lastTransactionByCategoryId?: Map<string, LastTransactionSummary>;
  currencies?: ExternalProviderCurrency[];
  selectedSourceId?: string | null;
  onSelectSource?: (sourceId: string | null) => void;
  incomeBySourceId?: Map<string, number>;
}

export function IncomeSourcesCard({
  categories: controlledCategories,
  currency = "PLN",
  isLoading: controlledIsLoading,
  error: controlledError,
  onRetry: controlledOnRetry,
  onReorderSources,
  onArchiveSource,
  onUnarchiveSource,
  onMoveSourcesAboveArchived,
  lastTransactionByCategoryId,
  selectedSourceId = null,
  onSelectSource,
  incomeBySourceId,
}: IncomeSourcesCardProps) {
  const [internalCategories, setInternalCategories] = useState<ExternalProviderCategory[]>([]);
  const [internalIsLoading, setInternalIsLoading] = useState(true);
  const [internalError, setInternalError] = useState<Error | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sourceToArchive, setSourceToArchive] = useState<ExternalProviderCategory | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const isControlled = controlledCategories !== undefined;
  const categories = isControlled ? controlledCategories : internalCategories;
  const isLoading = isControlled ? (controlledIsLoading ?? false) : internalIsLoading;
  const error = isControlled ? (controlledError ?? null) : internalError;

  const fetchSources = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setInternalIsLoading(true);
    setInternalError(null);
    try {
      const data = await getCategories({ signal, forceRefresh });
      setInternalCategories(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setInternalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setInternalIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isControlled) {
      const controller = new AbortController();
      void fetchSources(controller.signal);
      return () => controller.abort();
    }
  }, [isControlled, fetchSources]);

  const handleRetry = useCallback(() => {
    if (controlledOnRetry) {
      controlledOnRetry();
    } else {
      void fetchSources(undefined, true);
    }
  }, [controlledOnRetry, fetchSources]);

  const classifiedSources = useMemo(
    () => filterAndClassifyIncomeSources(categories, { showArchived }),
    [categories, showArchived],
  );

  const allIncomeSources = useMemo(
    () => filterAndClassifyIncomeSources(categories, { showArchived: true }),
    [categories],
  );

  const hiddenArchivedCount = useMemo(() => allIncomeSources.filter((s) => s.isArchived).length, [allIncomeSources]);

  const sourcesBelowArchived = useMemo(() => findIncomeSourcesBelowArchived(categories), [categories]);

  const totalPeriodIncome = useMemo(() => {
    if (!incomeBySourceId) return 0;
    let sum = 0;
    for (const val of incomeBySourceId.values()) {
      sum += val;
    }
    return sum;
  }, [incomeBySourceId]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { operation } = event;
      if (operation.canceled) return;
      const { source } = operation;
      if (!source || !isSortable(source)) return;

      const sourceId = String(source.id);
      const targetId = String(operation.target?.id);
      if (!targetId || sourceId === targetId) return;

      const fromIndex = classifiedSources.findIndex((s) => s.category.id === sourceId);
      const toIndex = classifiedSources.findIndex((s) => s.category.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const reordered = [...classifiedSources];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const reorderedIds = reordered.map((s) => s.category.id);

      setIsMutating(true);
      try {
        if (onReorderSources) {
          await onReorderSources(reorderedIds);
        } else {
          await reorderIncomeCategories(categories, reorderedIds);
          await fetchSources(undefined, true);
        }
        toast.success("Income sources reordered");
      } catch (err) {
        toast.error("Failed to reorder income sources", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsMutating(false);
      }
    },
    [classifiedSources, onReorderSources, categories, fetchSources],
  );

  const handleArchiveConfirm = useCallback(async () => {
    if (!sourceToArchive) return;
    const cat = sourceToArchive;
    setSourceToArchive(null);
    setIsMutating(true);
    try {
      if (onArchiveSource) {
        await onArchiveSource(cat.id);
      } else {
        await archiveIncomeSource(categories, cat.id);
        await fetchSources(undefined, true);
      }
      toast.success(`Archived "${cat.name}"`);
    } catch (err) {
      toast.error(`Failed to archive "${cat.name}"`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsMutating(false);
    }
  }, [sourceToArchive, onArchiveSource, categories, fetchSources]);

  const handleUnarchive = useCallback(
    async (sourceId: string) => {
      setIsMutating(true);
      try {
        if (onUnarchiveSource) {
          await onUnarchiveSource(sourceId);
        } else {
          await unarchiveIncomeSource(categories, sourceId);
          await fetchSources(undefined, true);
        }
        toast.success("Income source unarchived");
      } catch (err) {
        toast.error("Failed to unarchive income source", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsMutating(false);
      }
    },
    [onUnarchiveSource, categories, fetchSources],
  );

  const handleMoveAboveArchived = useCallback(
    async (sourceId?: string) => {
      setIsMutating(true);
      try {
        if (onMoveSourcesAboveArchived) {
          await onMoveSourcesAboveArchived(sourceId ? [sourceId] : undefined);
        } else {
          const result = moveIncomeSourcesAboveArchived(categories, sourceId ? [sourceId] : undefined);
          await reorderIncomeCategories(
            categories,
            result.updatedCategories.filter((c) => Number(c.categoryType) === 1 && !c.deleted).map((c) => c.id),
          );
          await fetchSources(undefined, true);
        }
        toast.success("Active income sources moved above archived");
      } catch (err) {
        toast.error("Failed to move income sources above archived", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsMutating(false);
      }
    },
    [onMoveSourcesAboveArchived, categories, fetchSources],
  );

  return (
    <TooltipProvider delayDuration={150}>
      <SectionShell
        title="Income Sources"
        description="Manage cash flow sources, payout targets, and active status"
        action={
          !isLoading && !error ? (
            <div className="flex items-center gap-2">
              {(hiddenArchivedCount > 0 || showArchived) && (
                <Button
                  type="button"
                  variant={showArchived ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <Archive className="text-muted-foreground size-3" />
                  <span>{showArchived ? "Hide archived" : `Show archived (${hiddenArchivedCount})`}</span>
                </Button>
              )}
              {totalPeriodIncome > 0 && (
                <div className="text-right">
                  <span className="text-muted-foreground text-xs">Total Inflow: </span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(totalPeriodIncome, currency)}
                  </span>
                </div>
              )}
            </div>
          ) : undefined
        }
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        isEmpty={classifiedSources.length === 0}
        emptyTitle="No income sources found"
        emptyDescription="No income categories found in ExternalProvider. In ExternalProvider, income sources are categories with categoryType: 1."
        emptyIcon={<Coins className="text-muted-foreground size-6" />}
        skeletonCount={3}
      >
        {sourcesBelowArchived.length > 0 && !isLoading && !error && (
          <div className="border-amber-500/20 bg-amber-500/10 mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span className="text-foreground">
                <span className="font-medium">
                  {sourcesBelowArchived.length === 1
                    ? "1 active income source is positioned below archived sources"
                    : `${sourcesBelowArchived.length} active income sources are positioned below archived sources`}
                </span>
              </span>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void handleMoveAboveArchived()}
              disabled={isMutating}
              className="border-amber-500/30 hover:bg-amber-500/15 h-7 gap-1.5 text-xs font-medium"
            >
              <ArrowUpToLine className="size-3.5" />
              <span>Move above archived</span>
            </Button>
          </div>
        )}

        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-0.5">
            {classifiedSources.map(({ category, isArchived }, index) => {
              const lastTx = lastTransactionByCategoryId?.get(category.id);
              const periodAmount = incomeBySourceId?.get(category.id);
              const isBelowArchived = sourcesBelowArchived.some((s) => s.id === category.id);

              return (
                <SortableIncomeRow
                  key={category.id}
                  id={category.id}
                  index={index}
                  category={category}
                  periodAmount={periodAmount}
                  currency={category.currencyId || currency}
                  isArchived={isArchived}
                  isBelowArchived={isBelowArchived}
                  lastTx={lastTx}
                  canReorder={!isArchived && !isMutating}
                  isSelected={selectedSourceId === category.id}
                  disabled={isMutating}
                  onSelect={() => onSelectSource?.(selectedSourceId === category.id ? null : category.id)}
                  onRequestArchive={(cat) => setSourceToArchive(cat)}
                  onUnarchive={(id) => void handleUnarchive(id)}
                  onMoveAboveArchived={(id) => void handleMoveAboveArchived(id)}
                />
              );
            })}
          </div>
        </DragDropProvider>

        {/* Archive Confirmation Dialog */}
        <AlertDialog open={Boolean(sourceToArchive)} onOpenChange={(open) => !open && setSourceToArchive(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive "{sourceToArchive?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Archiving will prepend "_" to this income source and move it to the end of your income list. It will be
                hidden from the active view by default.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleArchiveConfirm();
                }}
              >
                Archive source
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SectionShell>
    </TooltipProvider>
  );
}

interface SortableIncomeRowProps {
  id: string;
  index: number;
  category: ExternalProviderCategory;
  periodAmount?: number;
  currency: string;
  isArchived: boolean;
  isBelowArchived: boolean;
  lastTx?: LastTransactionSummary | null;
  canReorder: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onRequestArchive?: (category: ExternalProviderCategory) => void;
  onUnarchive?: (id: string) => void;
  onMoveAboveArchived?: (id: string) => void;
}

function SortableIncomeRow({
  id,
  index,
  category,
  periodAmount,
  currency,
  isArchived,
  isBelowArchived,
  lastTx,
  canReorder,
  isSelected = false,
  disabled = false,
  onSelect,
  onRequestArchive,
  onUnarchive,
  onMoveAboveArchived,
}: SortableIncomeRowProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    type: "income-row",
    accept: "income-row",
    group: "income",
    modifiers: [RestrictToVerticalAxis],
    disabled: !canReorder,
  });

  const displayName = isArchived ? category.name.replace(/^_+/, "").trim() : category.name;
  const limitAmount = Number(category.limitAmount) || 0;

  return (
    <div
      ref={ref}
      className={cn(
        "group/row relative flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted/50",
        isSelected && "bg-primary/5 ring-1 ring-primary/40",
        isArchived && "opacity-60",
        isDragging && "relative z-10 bg-muted/80 opacity-40 shadow-sm",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Grip handle */}
        {canReorder ? (
          <Button
            ref={handleRef}
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            className="relative z-10 -ml-1 cursor-grab text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
            aria-label={`Reorder ${category.name}`}
          >
            <GripVertical className="size-3.5" />
          </Button>
        ) : (
          <span className="w-5" />
        )}

        {/* Income Icon */}
        <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
          <ExternalProviderIcon icon={category.icon} fallbackType={CategoryType.Income} className="size-4" />
        </div>

        {/* Source Name & Subtitle */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5">
            {onSelect ? (
              <button
                type="button"
                onClick={onSelect}
                aria-pressed={isSelected}
                aria-label={`Filter transactions by ${displayName}`}
                className="cursor-pointer truncate text-left text-sm font-medium leading-none outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <span className={cn(isArchived && "text-muted-foreground line-through")}>{displayName}</span>
              </button>
            ) : (
              <span className={cn("truncate font-medium", isArchived && "text-muted-foreground line-through")}>
                {displayName}
              </span>
            )}
            {isArchived && (
              <Badge variant="outline" className="text-muted-foreground px-1 py-0 text-[10px] font-normal">
                Archived
              </Badge>
            )}
            {isBelowArchived && !isArchived && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveAboveArchived?.(category.id);
                    }}
                    className="relative z-10 h-4 w-4 text-amber-500 hover:text-amber-600"
                  >
                    <AlertTriangle className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Positioned below archived income sources. Click to move up.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {limitAmount > 0 ? (
              <span className="flex items-center gap-1">
                <Target className="size-3" /> Target: {formatMoney(limitAmount, currency)}
              </span>
            ) : (
              <span>No target set</span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Last transaction, amount, and actions */}
      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {lastTx && <LastTransactionBadge summary={lastTx} />}

        <div className="flex flex-col items-end">
          <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {periodAmount !== undefined ? `+${formatMoney(periodAmount, currency)}` : formatMoney(0, currency)}
          </span>
          {limitAmount > 0 && periodAmount !== undefined && (
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {Math.round((periodAmount / limitAmount) * 100)}% of target
            </span>
          )}
        </div>

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground/60 hover:text-muted-foreground size-7 shrink-0"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {isArchived ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onUnarchive?.(category.id);
                }}
              >
                <ArchiveRestore className="mr-2 size-4" />
                <span>Unarchive source</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestArchive?.(category);
                }}
              >
                <Archive className="mr-2 size-4" />
                <span>Archive source</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
