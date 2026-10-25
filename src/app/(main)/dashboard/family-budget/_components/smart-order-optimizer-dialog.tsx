"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowUpDown, Calendar, Loader2, Minus, Sparkles } from "lucide-react";
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
  buildSmartOrderPreviewItems,
  type CategoryActivityLookbackScope,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  computeCategoryActivityScores,
  formatMoney,
  isExpenseCategory,
  optimizeCategoryOrderByActivity,
} from "./external-provider-data";

export interface SmartOrderOptimizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExternalProviderCategory[];
  transactions?: ExternalProviderTransaction[];
  defaultCurrency?: string;
  onApplied?: (updatedCategories: ExternalProviderCategory[]) => void;
}

const TIER_BADGES = {
  primary: { label: "Default", variant: "secondary" as const },
  foreign: { label: "Foreign", variant: "outline" as const },
  archived: { label: "Archived", variant: "outline" as const },
};

export function SmartOrderOptimizerDialog({
  open,
  onOpenChange,
  categories,
  transactions = [],
  defaultCurrency = "PLN",
  onApplied,
}: SmartOrderOptimizerDialogProps) {
  const [scope, setScope] = useState<CategoryActivityLookbackScope>("180-days");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Calculate time-decayed scores for the chosen lookback scope
  const activityScores = useMemo(
    () =>
      computeCategoryActivityScores(categories, transactions, {
        lookbackScope: scope,
      }),
    [categories, transactions, scope],
  );

  // 2. Compute the tier-preserved optimal order
  const optimizationResult = useMemo(
    () =>
      optimizeCategoryOrderByActivity(categories, activityScores, {
        defaultCurrency,
        isSameGroup: isExpenseCategory,
      }),
    [categories, activityScores, defaultCurrency],
  );

  // 3. Build preview rows with rank delta and stats
  const previewItems = useMemo(
    () =>
      buildSmartOrderPreviewItems(categories, optimizationResult.updatedCategories, activityScores, {
        defaultCurrency,
        isSameGroup: isExpenseCategory,
      }),
    [categories, optimizationResult.updatedCategories, activityScores, defaultCurrency],
  );

  const modifiedCount = optimizationResult.modifiedCategories.length;
  const hasChanges = modifiedCount > 0;

  const handleApply = async () => {
    if (!hasChanges || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateCategoriesOrder(optimizationResult.modifiedCategories, {
        allUpdatedCategories: optimizationResult.updatedCategories,
      });

      toast.success(
        `Optimized order for ${modifiedCount} ${modifiedCount === 1 ? "category" : "categories"} by activity`,
      );
      onApplied?.(optimizationResult.updatedCategories);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category order in ExternalProvider");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border/60 border-b px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" />
            <DialogTitle className="text-base font-semibold">Smart Order Optimizer</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Reorders active expense categories according to transaction frequency and recency using exponential
            half-life decay (&tau; = 30 days). Primary PLN categories precede foreign categories, while soft-archived
            and deleted categories remain securely anchored at the bottom.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/20 border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground size-4" />
            <span className="text-xs font-medium">Lookback Scope:</span>
          </div>
          <Tabs value={scope} onValueChange={(val) => setScope(val as CategoryActivityLookbackScope)}>
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground grid grid-cols-12 items-center px-3 py-1 text-[11px] font-medium">
              <span className="col-span-2">New Rank</span>
              <span className="col-span-5">Category</span>
              <span className="col-span-2 text-center">Rank Delta</span>
              <span className="col-span-3 text-right">Activity &amp; Volume</span>
            </div>

            {previewItems.map((item) => {
              const tierBadge = TIER_BADGES[item.tier];
              return (
                <div
                  key={item.category.id}
                  className="bg-card hover:bg-muted/30 border-border/60 grid grid-cols-12 items-center rounded-md border p-2.5 text-xs transition-colors"
                >
                  {/* New Rank */}
                  <div className="col-span-2 flex items-center gap-1.5 font-mono">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      #{item.newOrder + 1}
                    </Badge>
                  </div>

                  {/* Category Name & Tier */}
                  <div className="col-span-5 flex min-w-0 items-center gap-1.5 pr-2">
                    <span className="truncate font-medium">{item.category.name}</span>
                    <Badge variant={tierBadge.variant} className="h-4 px-1 text-[9px]">
                      {tierBadge.label}
                    </Badge>
                  </div>

                  {/* Rank Delta */}
                  <div className="col-span-2 flex items-center justify-center">
                    {item.rankDelta > 0 ? (
                      <span className="flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <ArrowUp className="size-3" />
                        <span>+{item.rankDelta}</span>
                      </span>
                    ) : item.rankDelta < 0 ? (
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        <ArrowDown className="size-3" />
                        <span>{item.rankDelta}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 flex items-center gap-0.5">
                        <Minus className="size-3" />
                        <span>0</span>
                      </span>
                    )}
                  </div>

                  {/* Activity Stats */}
                  <div className="col-span-3 flex flex-col items-end gap-0.5 text-right text-[11px]">
                    <span className="font-medium tabular-nums">
                      {item.score.toFixed(1)} pts · {item.transactionCount} tx
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {item.lastActiveDate ? item.lastActiveDate.toLocaleDateString() : "No transactions"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-border/60 border-t px-6 py-3">
          <div className="flex w-full items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {hasChanges
                ? `${modifiedCount} category positions will change`
                : "Category positions are already optimal"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleApply()}
                disabled={!hasChanges || isSubmitting}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpDown className="size-3.5" />
                    <span>Apply Smart Order ({modifiedCount})</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
