"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { AlertCircle, PieChart as PieChartIcon, ShieldCheck } from "lucide-react";
import { Cell, Label, Pie, PieChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Label as FieldLabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { type ExternalProviderCategory, formatMoney, type StatCategoryPoint } from "./external-provider-data";
import {
  assignChartColors,
  type ExpenseSlice,
  groupSmartSlices,
  isTaxiCategory,
  type PeriodComparisonResult,
  transformExpenses,
} from "./expense-transforms";
import { SectionShell } from "./section-shell";
import { useExclusionPresets } from "./use-exclusion-presets";

export type CategorySortMode = "spend" | "increase" | "decrease";

interface ExpensePieCardProps {
  statCategories?: StatCategoryPoint[];
  categories?: ExternalProviderCategory[];
  defaultCurrency?: string;
  rawGrossIncome?: number;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  // Optional shared presets hook instance
  presetController?: ReturnType<typeof useExclusionPresets>;
  comparison?: PeriodComparisonResult | null;
  onSelectCategory?: (category: ExpenseSlice) => void;
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

  return (
    <div className="border-border/60 bg-popover/95 text-popover-foreground flex min-w-44 flex-col gap-1.5 rounded-lg border p-2.5 text-xs shadow-lg backdrop-blur-xs">
      <div className="flex items-center gap-2 font-medium">
        <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: slice.fill ?? "var(--chart-1)" }} />
        <span className="truncate">{slice.name}</span>
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
  presetController: externalPresetController,
  comparison = null,
  onSelectCategory,
}: ExpensePieCardProps) {
  const [sortMode, setSortMode] = useState<CategorySortMode>("spend");
  const internalPresetController = useExclusionPresets(categories);
  const {
    presets,
    activePreset,
    activePresetId,
    setActivePresetId,
    isRentExcluded,
    toggleRentExclusion,
    detectedRentCategoryIds,
  } = externalPresetController ?? internalPresetController;

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

  // Chart slices: smart group Transport & Taxi and group small slices (< 3%) into "Other"
  const chartSlices = useMemo(() => {
    const grouped = groupSmartSlices(controllableCategories, 3);
    return assignChartColors(grouped);
  }, [controllableCategories]);

  const smartTransportGroup = useMemo(() => {
    return chartSlices.find((s) => s.isSmartGroup);
  }, [chartSlices]);

  const displayedCategories = useMemo(() => {
    let items: ExpenseSlice[];

    if (smartTransportGroup && sortMode === "spend") {
      const childIds = new Set(smartTransportGroup.children?.map((c) => c.id) ?? []);
      const nonGrouped = controllableCategories.filter((c) => !childIds.has(c.id));
      items = [...nonGrouped, smartTransportGroup].sort((a, b) => b.amount - a.amount);
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
  }, [controllableCategories, comparison, sortMode, smartTransportGroup]);

  // Construct chartConfig for shadcn ChartContainer
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      amount: { label: "Spent Amount" },
    };
    for (const slice of chartSlices) {
      config[slice.id] = {
        label: slice.name,
        color: slice.fill,
      };
    }
    return config;
  }, [chartSlices]);

  const hasRentCategory = detectedRentCategoryIds.length > 0;
  const currency = defaultCurrency;

  return (
    <SectionShell
      title="Expenses Breakdown"
      description={`Active preset: ${activePreset.name} • ${controllableCategories.length} categories`}
      action={
        <div className="flex flex-wrap items-center gap-3">
          {hasRentCategory && (
            <div className="flex items-center gap-1.5">
              <Switch
                id="exclude-rent-toggle"
                size="sm"
                checked={isRentExcluded}
                onCheckedChange={toggleRentExclusion}
              />
              <FieldLabel
                htmlFor="exclude-rent-toggle"
                className="text-muted-foreground cursor-pointer text-xs font-normal select-none"
              >
                Exclude Rent
              </FieldLabel>
            </div>
          )}

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
              Rent Excluded: {formatMoney(excludedExpenseSum, currency)}
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

              return (
                <div key={cat.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(cat)}
                    title="Click to trace category expenses"
                    className="border-border/40 bg-muted/20 hover:bg-muted/50 group focus-visible:ring-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors select-none focus-visible:ring-1 focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: colorVar }} />
                      <span className="group-hover:text-foreground truncate font-medium">{cat.name}</span>
                      {cat.isSmartGroup && (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal">
                          Group
                        </Badge>
                      )}
                      {cat.isOverrun && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px] font-normal">
                          Over
                        </Badge>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
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
                      <span className="font-semibold tabular-nums">{formatMoney(cat.amount, currency)}</span>
                      <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                        {cat.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </button>

                  {/* Render child sub-items for smart groups (Transport & Taxi breakdown) */}
                  {cat.isSmartGroup && cat.children && cat.children.length > 0 && (
                    <div className="border-border/40 bg-muted/10 ml-4 flex flex-col gap-1 border-l-2 py-0.5 pl-2.5 text-xs">
                      {cat.children.map((child) => {
                        const isTaxi = isTaxiCategory(child.name);
                        const childDelta = comparison?.categoryDeltaMap.get(child.id);
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
                                className="text-muted-foreground h-3.5 px-1 text-[8px] font-normal"
                              >
                                {isTaxi ? "Taxi / Ride-hailing" : "Transit"}
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
  );
}
