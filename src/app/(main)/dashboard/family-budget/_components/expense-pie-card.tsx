"use client";

import { useMemo } from "react";

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
import { assignChartColors, type ExpenseSlice, groupSmallSlices, transformExpenses } from "./expense-transforms";
import { SectionShell } from "./section-shell";
import { useExclusionPresets } from "./use-exclusion-presets";

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
}: ExpensePieCardProps) {
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
  } = transformed;

  // Chart slices: group very small slices (< 3%) into "Other"
  const chartSlices = useMemo(() => {
    const grouped = groupSmallSlices(controllableCategories, 3);
    return assignChartColors(grouped);
  }, [controllableCategories]);

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
      title="Controllable Expenses Breakdown"
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
      emptyTitle="No controllable expenses"
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
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                        return null;
                      }

                      return (
                        <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                          <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 10}>
                            Controllable
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
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              Top Categories ({controllableCategories.length})
            </div>

            {controllableCategories.map((cat, index) => {
              const colorIndex = (index % 5) + 1;
              const colorVar = `var(--chart-${colorIndex})`;

              return (
                <div
                  key={cat.id}
                  className="border-border/40 bg-muted/20 hover:bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: colorVar }} />
                    <span className="truncate font-medium">{cat.name}</span>
                    {cat.isOverrun && (
                      <Badge variant="destructive" className="h-4 px-1 text-[9px] font-normal">
                        Over
                      </Badge>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatMoney(cat.amount, currency)}</span>
                    <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
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
