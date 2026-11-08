"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
  PieChart as PieChartIcon,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Cell, Label, Pie, PieChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  assignChartColors,
  detectSliceCurrency,
  type ExpenseSlice,
  groupSmartSlices,
  isTaxiCategory,
  isTransportOrTaxi,
  type PeriodComparisonResult,
  transformExpenses,
} from "./expense-transforms";
import {
  type ExternalProviderCategory,
  extractCanonicalBaseName,
  formatMoney,
  type StatCategoryPoint,
} from "./external-provider-data";
import { getMonthIncompleteDescription, type MonthIncompleteReason } from "./month-completeness";
import { PresetDialog } from "./preset-dialog";
import { SectionShell } from "./section-shell";
import type { useExclusionPresets } from "./use-exclusion-presets";

export type CategorySortMode = "spend" | "increase" | "decrease";

interface ExpensePieCardProps {
  statCategories?: StatCategoryPoint[];
  categories?: ExternalProviderCategory[];
  defaultCurrency?: string;
  rawGrossIncome?: number;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  presetController: ReturnType<typeof useExclusionPresets>;
  comparison?: PeriodComparisonResult | null;
  onSelectCategory?: (category: ExpenseSlice) => void;
  isIncomplete?: boolean;
  incompleteReason?: MonthIncompleteReason | null;
}

function formatCategoryDelta(
  delta: NonNullable<PeriodComparisonResult["categoryDeltas"][number]>,
  currency: string,
): string {
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

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: ExpenseSlice & { fill?: string; colorKey?: string };
}

function CustomPieTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  currency: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const slice = item.payload;
  if (!slice) return null;

  const displayName = extractCanonicalBaseName(slice.name, currency);

  return (
    <div className="border-border/60 bg-popover/95 text-popover-foreground flex min-w-48 flex-col gap-1.5 rounded-lg border p-2.5 text-xs shadow-lg backdrop-blur-xs">
      <div className="flex items-center gap-2 font-medium">
        <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: slice.fill ?? "var(--chart-1)" }} />
        <span className="truncate">{displayName}</span>
        {slice.hasForeignCurrency && <Globe className="size-3 text-blue-500 shrink-0" />}
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px]">
        <span className="text-muted-foreground">Spent:</span>
        <span className="text-foreground text-right font-semibold tabular-nums">
          {formatMoney(slice.amount, currency)}
        </span>

        <span className="text-muted-foreground">Share:</span>
        <span className="text-foreground text-right font-medium tabular-nums">{slice.percentage.toFixed(1)}%</span>

        {slice.limitAmount && slice.limitAmount > 0 && (
          <>
            <span className="text-muted-foreground">Limit:</span>
            <span className="text-muted-foreground text-right tabular-nums">
              {formatMoney(slice.limitAmount, currency)}
            </span>
          </>
        )}
      </div>

      {slice.hasForeignCurrency && (
        <div className="border-border/40 mt-1 border-t pt-1.5 flex flex-col gap-1 text-[10px]">
          <span className="text-muted-foreground font-medium">Currency Breakdown:</span>
          {slice.children && slice.children.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {slice.children.map((child) => (
                <div key={child.id} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate max-w-32">{child.name}</span>
                  <span className="text-foreground font-medium tabular-nums">
                    {formatMoney(child.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">Includes {slice.foreignCurrencies?.join(", ")} spend</div>
          )}
        </div>
      )}

      {slice.isOverrun && (
        <div className="bg-destructive/10 text-destructive mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
          <AlertCircle className="size-3" />
          <span>Over budget</span>
        </div>
      )}
    </div>
  );
}

export function ExpensePieCard({
  statCategories = [],
  categories = [],
  defaultCurrency = "PLN",
  rawGrossIncome = 0,
  isLoading = false,
  error = null,
  onRetry,
  presetController,
  comparison = null,
  onSelectCategory,
  isIncomplete = false,
  incompleteReason = null,
}: ExpensePieCardProps) {
  const [sortMode, setSortMode] = useState<CategorySortMode>("spend");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const { presets, activePreset, activePresetId, setActivePresetId } = presetController;

  const transformed = useMemo(() => {
    return transformExpenses({
      statCategories,
      categories,
      activePreset,
      rawGrossIncome,
    });
  }, [statCategories, categories, activePreset, rawGrossIncome]);

  const {
    controllableCategories,
    excludedCategories,
    taxDeductionCategories,
    totalControllableExpense,
    totalTaxDeductions,
    excludedExpenseSum,
    controllableCashLeft,
  } = transformed;

  // Chart slices: smart group multi-currency categories & Transport/Taxi, and group small slices (< 3%) into "Other"
  const chartSlices = useMemo(() => {
    const grouped = groupSmartSlices(controllableCategories, 3, defaultCurrency);
    return assignChartColors(grouped);
  }, [controllableCategories, defaultCurrency]);

  const smartGroups = useMemo(() => {
    return chartSlices.filter((s) => s.isSmartGroup);
  }, [chartSlices]);

  const displayedCategories = useMemo(() => {
    let items: ExpenseSlice[];

    if (sortMode === "spend") {
      const allChildIds = new Set(smartGroups.flatMap((g) => g.children?.map((c) => c.id) ?? []));
      const nonGrouped = controllableCategories.filter((c) => !allChildIds.has(c.id));
      items = [...nonGrouped, ...smartGroups].sort((a, b) => b.amount - a.amount);
    } else {
      items = [...controllableCategories];
    }

    if (!comparison) return items;

    if (sortMode === "increase") {
      return items.sort((a, b) => {
        const deltaA = comparison.categoryDeltaMap.get(a.id)?.deltaAbs ?? 0;
        const deltaB = comparison.categoryDeltaMap.get(b.id)?.deltaAbs ?? 0;
        return deltaB - deltaA;
      });
    }

    if (sortMode === "decrease") {
      return items.sort((a, b) => {
        const deltaA = comparison.categoryDeltaMap.get(a.id)?.deltaAbs ?? 0;
        const deltaB = comparison.categoryDeltaMap.get(b.id)?.deltaAbs ?? 0;
        return deltaA - deltaB;
      });
    }

    return items;
  }, [controllableCategories, comparison, sortMode, smartGroups]);

  // Construct chartConfig for shadcn ChartContainer
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      amount: { label: "Spent Amount" },
    };
    for (const slice of chartSlices) {
      config[slice.id] = {
        label: extractCanonicalBaseName(slice.name, defaultCurrency),
        color: slice.fill,
      };
    }
    return config;
  }, [chartSlices, defaultCurrency]);

  const currency = defaultCurrency;

  return (
    <>
      <SectionShell
        title={
          <div className="flex items-center gap-2">
            <span>Expenses Breakdown</span>
            {isIncomplete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1 font-normal text-[11px] cursor-help"
                    >
                      <AlertTriangle className="size-3" />
                      Incomplete month
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {getMonthIncompleteDescription(incompleteReason)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        }
        description={`Active preset: ${activePreset.name} • ${controllableCategories.length} categories`}
        action={
          <div className="flex items-center gap-2">
            <Select value={activePresetId} onValueChange={setActivePresetId}>
              <SelectTrigger size="sm" className="h-7 min-w-36 text-xs">
                <SelectValue placeholder="Preset" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectLabel>Exclusion Presets</SelectLabel>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id} className="text-xs">
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon-xs"
              className="size-7"
              title="Configure exclusion presets and fixed obligations"
              onClick={() => setPresetDialogOpen(true)}
            >
              <Settings2 className="size-3.5" />
              <span className="sr-only">Configure Presets</span>
            </Button>
          </div>
        }
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={controllableCategories.length === 0}
        emptyTitle="No expenses"
        emptyDescription="No spending activity matching the active preset criteria was found for this period."
        emptyIcon={<PieChartIcon className="text-muted-foreground size-6" />}
        skeletonCount={3}
        skeletonHeight="h-16"
      >
        <div className="flex flex-col gap-5">
          {/* Adjusted metrics summary strip */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs">
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              <ShieldCheck className="text-primary size-3" />
              <span>Controllable: {formatMoney(totalControllableExpense, currency)}</span>
            </Badge>

            {totalTaxDeductions > 0 && (
              <Badge variant="outline" className="text-muted-foreground text-[11px] font-normal">
                Tax Deducted: {formatMoney(totalTaxDeductions, currency)}
              </Badge>
            )}

            {excludedExpenseSum > 0 && (
              <Badge variant="outline" className="text-muted-foreground text-[11px] font-normal">
                {excludedCategories.length > 1 ? "Fixed Obligations: " : "Excluded: "}
                {formatMoney(excludedExpenseSum, currency)}
              </Badge>
            )}

            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium tabular-nums",
                controllableCashLeft >= 0
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/20 bg-destructive/10 text-destructive",
              )}
            >
              Cash Left: {controllableCashLeft >= 0 ? "+" : ""}
              {formatMoney(controllableCashLeft, currency)}
            </Badge>
          </div>

          {/* Donut chart + Legend container */}
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex justify-center">
              <ChartContainer config={chartConfig} className="mx-auto aspect-square h-56 w-56">
                <PieChart>
                  <ChartTooltip cursor={false} content={<CustomPieTooltip currency={currency} />} />
                  <Pie
                    data={chartSlices}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={2}
                    cornerRadius={4}
                    strokeWidth={2}
                    stroke="var(--background)"
                    className={cn(onSelectCategory && "cursor-pointer")}
                    onClick={(entry) => {
                      if (onSelectCategory && entry && "id" in entry) {
                        onSelectCategory(entry as unknown as ExpenseSlice);
                      }
                    }}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                          return null;
                        }

                        return (
                          <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                            <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 10}>
                              Expenses
                            </tspan>
                            <tspan
                              className="fill-foreground text-base font-semibold tabular-nums"
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 12}
                            >
                              {formatMoney(totalControllableExpense, currency)}
                            </tspan>
                          </text>
                        );
                      }}
                    />
                    {chartSlices.map((entry) => (
                      <Cell key={entry.id} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>

            {/* Breakdown legend list */}
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-muted-foreground text-xs font-medium">
                  Top Categories ({controllableCategories.length})
                </div>
                {comparison && (
                  <div className="bg-muted/40 flex items-center rounded-md border p-0.5 text-[10px]">
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors",
                        sortMode === "spend"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setSortMode("spend")}
                    >
                      By Spend
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors",
                        sortMode === "increase"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setSortMode("increase")}
                    >
                      Biggest +
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors",
                        sortMode === "decrease"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setSortMode("decrease")}
                    >
                      Biggest -
                    </button>
                  </div>
                )}
              </div>

              {displayedCategories.map((cat, index) => {
                const colorIndex = (index % 5) + 1;
                const colorVar = `var(--chart-${colorIndex})`;
                const catDelta = comparison?.categoryDeltaMap.get(cat.id);
                const displayName = extractCanonicalBaseName(cat.name, currency);
                const isCollapsed = collapsedGroupIds.has(cat.id);

                return (
                  <div key={cat.id} className="flex flex-col gap-1">
                    <div className="border-border/40 bg-muted/20 hover:bg-muted/50 group focus-within:ring-ring flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors select-none focus-within:ring-1">
                      <button
                        type="button"
                        onClick={() => onSelectCategory?.(cat)}
                        title="Click to trace category expenses"
                        className="flex min-w-0 flex-1 items-center gap-2 cursor-pointer text-left focus:outline-none"
                      >
                        <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: colorVar }} />
                        <span className="group-hover:text-foreground truncate font-medium">{displayName}</span>
                        {cat.isSmartGroup && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal">
                            Group
                          </Badge>
                        )}
                        {cat.hasForeignCurrency && (
                          <div className="flex items-center gap-1" title="Includes foreign currency spend">
                            <Globe className="size-3 text-blue-500 shrink-0" />
                            {cat.foreignCurrencies?.map((curr) => (
                              <Badge
                                key={curr}
                                variant="outline"
                                className="h-3.5 px-1 text-[8px] font-medium border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              >
                                +{curr}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {cat.isOverrun && (
                          <Badge variant="destructive" className="h-4 px-1 text-[9px] font-normal">
                            Over
                          </Badge>
                        )}
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        {cat.isSmartGroup && cat.children && cat.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCollapsedGroupIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat.id)) next.delete(cat.id);
                                else next.add(cat.id);
                                return next;
                              });
                            }}
                            className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer p-0.5 rounded transition-colors"
                            title={isCollapsed ? "Expand group items" : "Collapse group items"}
                            aria-label={isCollapsed ? `Expand ${displayName} items` : `Collapse ${displayName} items`}
                          >
                            {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                          </button>
                        )}
                        {catDelta && catDelta.deltaAbs !== 0 && (
                          <span
                            className={cn(
                              "text-[10px] font-medium tabular-nums",
                              catDelta.deltaAbs > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {formatCategoryDelta(catDelta, currency)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectCategory?.(cat)}
                          title="Click to trace category expenses"
                          className="cursor-pointer font-semibold tabular-nums hover:underline focus:outline-none"
                        >
                          {formatMoney(cat.amount, currency)}
                        </button>
                        <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                          {cat.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Render child sub-items for smart groups */}
                    {cat.isSmartGroup && cat.children && cat.children.length > 0 && !isCollapsed && (
                      <div className="border-border/40 bg-muted/10 ml-4 flex flex-col gap-1 border-l-2 py-0.5 pl-2.5 text-xs">
                        {cat.children.map((child) => {
                          const isTaxi = isTaxiCategory(child.name);
                          const isTransport = isTransportOrTaxi(child.name);
                          const childDelta = comparison?.categoryDeltaMap.get(child.id);
                          const childCurr = detectSliceCurrency(child.name, currency);
                          const childBadge =
                            isTransport && isTaxi
                              ? "Taxi / Ride-hailing"
                              : isTransport
                                ? "Transit"
                                : childCurr.isForeign
                                  ? childCurr.currency
                                  : currency;

                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCategory?.(child);
                              }}
                              title="Click to trace category expenses"
                              className="hover:bg-muted/40 group focus-visible:ring-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-0.5 text-left text-[11px] transition-colors select-none focus-visible:ring-1 focus-visible:outline-none"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="text-muted-foreground size-1.5 rounded-full bg-current" />
                                <span className="text-foreground/90 group-hover:text-foreground truncate">
                                  {child.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "h-3.5 px-1 text-[8px] font-normal",
                                    childCurr.isForeign && "border-blue-500/30 text-blue-700 dark:text-blue-400",
                                  )}
                                >
                                  {childBadge}
                                </Badge>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {childDelta && childDelta.deltaAbs !== 0 && (
                                  <span
                                    className={cn(
                                      "text-[9px] font-medium tabular-nums",
                                      childDelta.deltaAbs > 0
                                        ? "text-destructive"
                                        : "text-emerald-600 dark:text-emerald-400",
                                    )}
                                  >
                                    {formatCategoryDelta(childDelta, currency)}
                                  </span>
                                )}
                                <span className="text-muted-foreground tabular-nums">
                                  {formatMoney(child.amount, currency)}
                                </span>
                                <span className="text-muted-foreground w-9 text-right text-[10px] tabular-nums">
                                  {child.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Inactive/Excluded categories subtle note */}
              {(excludedCategories.length > 0 || taxDeductionCategories.length > 0) && (
                <div className="text-muted-foreground mt-2 flex flex-col gap-1 border-t pt-2 text-[11px]">
                  <span className="font-medium">Omitted from controllable pie:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {excludedCategories.map((c) => (
                      <span key={c.id} className="bg-muted rounded px-1.5 py-0.5">
                        {c.name}: {formatMoney(c.amount, currency)} (Excluded)
                      </span>
                    ))}
                    {taxDeductionCategories.map((c) => (
                      <span key={c.id} className="bg-muted rounded px-1.5 py-0.5">
                        {c.name}: {formatMoney(c.amount, currency)} (Tax Deduction)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      <PresetDialog
        open={presetDialogOpen}
        onOpenChange={setPresetDialogOpen}
        categories={categories}
        statCategories={statCategories}
        defaultCurrency={defaultCurrency}
        presetController={presetController}
      />
    </>
  );
}
