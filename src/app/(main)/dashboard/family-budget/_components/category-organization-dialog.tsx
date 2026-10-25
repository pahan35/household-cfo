"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowDown, ArrowUp, Calendar, CheckCircle2, Filter, Layers, Loader2, Minus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { updateCategoriesOrder } from "./external-provider-client";
import {
  buildCategoryOrderDiffItems,
  type CategoryActivityLookbackScope,
  type CategoryCurrencyTier,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  computeCategoryActivityScores,
  isExpenseCategory,
  optimizeCategoryOrderByActivity,
  organizeExpenseCategoriesByCurrencyTier,
} from "./external-provider-data";

export type CategoryOrganizationStrategy = "smart-order" | "tier-cleanup";

export interface CategoryOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExternalProviderCategory[];
  transactions?: ExternalProviderTransaction[];
  defaultCurrency?: string;
  onApplied?: (updatedCategories: ExternalProviderCategory[]) => void;
  initialStrategy?: CategoryOrganizationStrategy;
}

const TIER_BADGES: Record<CategoryCurrencyTier, { label: string; variant: "secondary" | "outline" }> = {
  primary: { label: "Default", variant: "secondary" },
  foreign: { label: "Foreign", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
};

function renderRankDelta(delta: number) {
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <ArrowUp className="size-3" />
        <span>+{delta}</span>
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="text-muted-foreground flex items-center gap-0.5 font-semibold">
        <ArrowDown className="size-3" />
        <span>{delta}</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground/60 flex items-center gap-0.5">
      <Minus className="size-3" />
      <span>0</span>
    </span>
  );
}

export function CategoryOrganizationDialog({
  open,
  onOpenChange,
  categories,
  transactions = [],
  defaultCurrency = "PLN",
  onApplied,
  initialStrategy = "smart-order",
}: CategoryOrganizationDialogProps) {
  const [strategy, setStrategy] = useState<CategoryOrganizationStrategy>(initialStrategy);
  const [lookbackScope, setLookbackScope] = useState<CategoryActivityLookbackScope>("180-days");
  const [onlyShowMoved, setOnlyShowMoved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Calculate time-decayed scores when in smart-order mode
  const activityScores = useMemo(() => {
    return computeCategoryActivityScores(categories, transactions, {
      lookbackScope,
    });
  }, [categories, transactions, lookbackScope]);

  // 2. Compute organization result based on selected strategy
  const reorderResult = useMemo(() => {
    if (strategy === "smart-order") {
      return optimizeCategoryOrderByActivity(categories, activityScores, {
        defaultCurrency,
        isSameGroup: isExpenseCategory,
      });
    }
    return organizeExpenseCategoriesByCurrencyTier(categories, defaultCurrency);
  }, [strategy, categories, activityScores, defaultCurrency]);

  // 3. Build diff items comparing original vs projected ranks
  const diffItems = useMemo(() => {
    return buildCategoryOrderDiffItems(categories, reorderResult.updatedCategories, {
      defaultCurrency,
      scores: activityScores,
      strategy,
      isSameGroup: isExpenseCategory,
    });
  }, [categories, reorderResult.updatedCategories, defaultCurrency, activityScores, strategy]);

  const modifiedCount = reorderResult.modifiedCategories.length;
  const hasChanges = modifiedCount > 0;

  const displayItems = useMemo(() => {
    if (onlyShowMoved) {
      return diffItems.filter((it) => it.hasMoved);
    }
    return diffItems;
  }, [diffItems, onlyShowMoved]);

  const handleApply = async () => {
    if (!hasChanges || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateCategoriesOrder(reorderResult.modifiedCategories, {
        allUpdatedCategories: reorderResult.updatedCategories,
      });

      const label = strategy === "smart-order" ? "by activity" : "by currency & lifecycle tiers";
      toast.success(
        `Updated sequence for ${modifiedCount} ${modifiedCount === 1 ? "category" : "categories"} (${label})`,
      );
      onApplied?.(reorderResult.updatedCategories);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category order in ExternalProvider");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col sm:max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border/60 border-b px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" />
            <DialogTitle className="text-base font-semibold">Organize Expense Categories</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Preview and verify order changes before persisting to ExternalProvider. Choose an organization strategy below to
            optimize category sequence.
          </DialogDescription>
        </DialogHeader>

        {/* Strategy Selector & Controls Bar */}
        <div className="bg-muted/30 border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium">Strategy:</span>
            <Tabs value={strategy} onValueChange={(val) => setStrategy(val as CategoryOrganizationStrategy)}>
              <TabsList className="h-8">
                <TabsTrigger value="smart-order" className="gap-1.5 text-xs">
                  <Sparkles className="size-3 text-primary" />
                  <span>Smart Order</span>
                </TabsTrigger>
                <TabsTrigger value="tier-cleanup" className="gap-1.5 text-xs">
                  <Layers className="size-3" />
                  <span>Tier Cleanup</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {strategy === "smart-order" && (
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground size-3.5" />
              <Tabs
                value={lookbackScope}
                onValueChange={(val) => setLookbackScope(val as CategoryActivityLookbackScope)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="90-days" className="text-xs">
                    90 Days
                  </TabsTrigger>
                  <TabsTrigger value="180-days" className="text-xs">
                    180 Days
                  </TabsTrigger>
                  <TabsTrigger value="all-time" className="text-xs">
                    All-Time
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        {/* Diff Summary Bar */}
        <div className="bg-muted/15 border-border/40 flex items-center justify-between border-b px-6 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            {hasChanges ? (
              <>
                <Badge variant="outline" className="h-5 gap-1 border-primary/30 px-1.5 font-medium text-primary">
                  {modifiedCount} {modifiedCount === 1 ? "category" : "categories"} to move
                </Badge>
                <span className="text-muted-foreground text-[11px]">
                  {strategy === "smart-order"
                    ? "Ranked by activity decay score"
                    : "Aligned to primary → foreign → archived → removed tiers"}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span className="font-medium text-[11px]">All categories already in canonical order</span>
              </div>
            )}
          </div>

          {hasChanges && (
            <Button
              type="button"
              variant={onlyShowMoved ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setOnlyShowMoved((prev) => !prev)}
              className="h-6 gap-1 px-2 text-[11px]"
            >
              <Filter className="size-3" />
              <span>{onlyShowMoved ? "Show all" : `Only moving (${modifiedCount})`}</span>
            </Button>
          )}
        </div>

        {/* Diff Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground grid grid-cols-12 items-center px-3 py-1 text-[11px] font-medium">
              <span className="col-span-2">New Rank</span>
              <span className="col-span-4">Category</span>
              <span className="col-span-2 text-center">Rank Delta</span>
              <span className="col-span-4 text-right">Reason / Details</span>
            </div>

            {displayItems.map((item) => {
              const tierBadge = TIER_BADGES[item.tier];
              return (
                <div
                  key={item.category.id}
                  className={cn(
                    "grid grid-cols-12 items-center rounded-md border p-2 text-xs transition-colors",
                    item.hasMoved
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                      : "bg-card hover:bg-muted/30 border-border/50",
                  )}
                >
                  {/* New Rank */}
                  <div className="col-span-2 flex items-center gap-1.5 font-mono">
                    <Badge variant={item.hasMoved ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">
                      #{item.newOrder + 1}
                    </Badge>
                  </div>

                  {/* Category Name & Tier */}
                  <div className="col-span-4 flex min-w-0 items-center gap-1.5 pr-2">
                    <span className="truncate font-medium">{item.category.name}</span>
                    <Badge variant={tierBadge.variant} className="h-4 px-1 text-[9px]">
                      {tierBadge.label}
                    </Badge>
                  </div>

                  {/* Rank Delta */}
                  <div className="col-span-2 flex items-center justify-center">{renderRankDelta(item.rankDelta)}</div>

                  {/* Reason & Details */}
                  <div className="col-span-4 flex flex-col items-end gap-0.5 text-right text-[11px]">
                    <span className="text-muted-foreground truncate">{item.reason}</span>
                    {item.previousOrder !== item.newOrder && (
                      <span className="text-muted-foreground/60 text-[10px] font-mono">
                        was #{item.previousOrder + 1}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-border/60 bg-muted/20 border-t px-6 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={!hasChanges || isSubmitting}
            className="gap-1.5 text-xs font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Applying changes...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>{hasChanges ? `Apply Changes (${modifiedCount})` : "No Changes Needed"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
