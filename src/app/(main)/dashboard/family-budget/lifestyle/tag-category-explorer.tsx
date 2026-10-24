"use client";

import { useMemo, useState } from "react";

import { format } from "date-fns";
import { ArrowLeft, ChevronRight, Filter, PieChart as PieChartIcon, Tag as TagIcon, TrendingUp, X } from "lucide-react";
import { CartesianGrid, Cell, Label, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";

import { formatMoney } from "../_components/external-provider-data";
import {
  aggregateDonutData,
  buildMonthlyTrendSeries,
  type DonutSlice,
  type DonutViewMode,
  getConvertedTransactionAmount,
  getTransactionDate,
  normalizeLifestyleTag,
  normalizeUnifiedCategory,
  type TransactionFlow,
} from "../_components/lifestyle-transforms";
import { SectionShell } from "../_components/section-shell";
import { useLifestyleData } from "./use-lifestyle-data";

const DONUT_COLORS = [
  "var(--chart-1, #3b82f6)",
  "var(--chart-2, #10b981)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #ef4444)",
  "var(--chart-5, #8b5cf6)",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
];

export function TagCategoryExplorer() {
  const { categories, categoryMap, currencies, transactions, defaultCurrency, isLoading } = useLifestyleData();

  // Donut view controls
  const [flow, setFlow] = useState<TransactionFlow>("expenses");
  const [viewMode, setViewMode] = useState<DonutViewMode>("by-category");
  const [drillDownCatId, setDrillDownCatId] = useState<string | null>(null);

  // Historical trend filter
  const [trendFilterType, setTrendFilterType] = useState<"all" | "category" | "unified-category" | "tag">("all");
  const [trendFilterValue, setTrendFilterValue] = useState<string | null>(null);
  const [trendFlow, setTrendFlow] = useState<"expenses" | "income" | "both">("expenses");

  // Transaction feed search query
  const [txSearch, setTxSearch] = useState("");

  // Aggregate Donut dataset
  const donutData = useMemo(() => {
    return aggregateDonutData({
      transactions,
      categories,
      currencies,
      defaultCurrency,
      flow,
      viewMode,
      drillDownCategoryId: drillDownCatId,
    });
  }, [transactions, categories, currencies, defaultCurrency, flow, viewMode, drillDownCatId]);

  // Slices with assigned colors
  const coloredSlices = useMemo(() => {
    return donutData.slices.map((slice, index) => ({
      ...slice,
      color: slice.isUntagged ? "#94a3b8" : DONUT_COLORS[index % DONUT_COLORS.length],
    }));
  }, [donutData.slices]);

  // Chart config for recharts container
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      amount: { label: "Amount" },
    };
    coloredSlices.forEach((slice, i) => {
      config[`slice_${i}`] = {
        label: slice.label,
        color: slice.color,
      };
    });
    return config;
  }, [coloredSlices]);

  // Build monthly trend series
  const trendSeries = useMemo(() => {
    return buildMonthlyTrendSeries({
      transactions,
      categories,
      currencies,
      defaultCurrency,
      filterType: trendFilterType,
      filterValue: trendFilterValue,
    });
  }, [transactions, categories, currencies, defaultCurrency, trendFilterType, trendFilterValue]);

  // Filtered transactions for the feed
  const matchingTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (tx.deleted) return false;

        // Trend filter application
        if (trendFilterType === "tag" && trendFilterValue) {
          const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];
          const cleanTags = rawTags.map(normalizeLifestyleTag);
          if (!cleanTags.includes(normalizeLifestyleTag(trendFilterValue))) return false;
        } else if (trendFilterType === "category" && trendFilterValue) {
          const catId = flow === "expenses" ? tx.destinationId : tx.sourceId;
          const cat = catId ? categoryMap.get(catId) : undefined;
          if (catId !== trendFilterValue && cat?.name !== trendFilterValue) return false;
        } else if (trendFilterType === "unified-category" && trendFilterValue) {
          const catId = flow === "expenses" ? tx.destinationId : tx.sourceId;
          const cat = catId ? categoryMap.get(catId) : undefined;
          if (normalizeUnifiedCategory(cat?.name ?? "") !== trendFilterValue) return false;
        }

        // Search text filter
        if (txSearch.trim().length > 0) {
          const q = txSearch.toLowerCase();
          const comment = (tx.comment ?? "").toLowerCase();
          const tags = (tx.tags ?? []).join(" ").toLowerCase();
          const catId = tx.destinationId ?? tx.sourceId;
          const cat = catId ? categoryMap.get(catId) : undefined;
          const catName = (cat?.name ?? "").toLowerCase();
          if (!comment.includes(q) && !tags.includes(q) && !catName.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .slice(0, 50); // Show top 50 recent matching
  }, [transactions, trendFilterType, trendFilterValue, txSearch, flow, categoryMap]);

  // Handlers
  const handleCategoryClick = (slice: DonutSlice) => {
    if (slice.hasTags && !donutData.isDrillDown && viewMode !== "by-tag") {
      setDrillDownCatId(slice.id);
    }
    // Also update trend filter
    if (viewMode === "unified-category") {
      setTrendFilterType("unified-category");
      setTrendFilterValue(slice.label);
    } else if (viewMode === "by-tag" || slice.id.startsWith("tag-")) {
      const tag = slice.tagNames?.[0] ?? slice.label.replace(/^#/, "");
      setTrendFilterType("tag");
      setTrendFilterValue(tag);
    } else {
      setTrendFilterType("category");
      setTrendFilterValue(slice.id);
    }
  };

  const handleClearDrillDown = () => {
    setDrillDownCatId(null);
  };

  const handleClearTrendFilter = () => {
    setTrendFilterType("all");
    setTrendFilterValue(null);
  };

  const centerLabelSubtitle = useMemo(() => {
    if (donutData.isDrillDown) {
      return `${donutData.drillDownTargetLabel} tags`;
    }
    return flow === "expenses" ? "Total Expenses" : "Total Income";
  }, [donutData.isDrillDown, donutData.drillDownTargetLabel, flow]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Donut Composition & Ranked Breakdown Card */}
      <SectionShell
        title="Tag & Category Composition"
        description="ExternalProvider Mobile-style Proportional Donut with Category-to-Tag drill-down and global tag aggregations"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Expenses vs Income Switcher */}
            <div className="inline-flex rounded-md border bg-muted/60 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setFlow("expenses");
                  setDrillDownCatId(null);
                }}
                className={`rounded px-2.5 py-1 transition-colors ${
                  flow === "expenses"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Expenses
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlow("income");
                  setDrillDownCatId(null);
                }}
                className={`rounded px-2.5 py-1 transition-colors ${
                  flow === "income"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Income
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex rounded-md border bg-muted/60 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setViewMode("by-category");
                  setDrillDownCatId(null);
                }}
                className={`rounded px-2.5 py-1 transition-colors ${
                  viewMode === "by-category"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                By Category
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("unified-category");
                  setDrillDownCatId(null);
                }}
                className={`rounded px-2.5 py-1 transition-colors ${
                  viewMode === "unified-category"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unified Category
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("by-tag");
                  setDrillDownCatId(null);
                }}
                className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
                  viewMode === "by-tag"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TagIcon className="size-3" />
                <span>By Tag</span>
              </button>
            </div>
          </div>
        }
      >
        {donutData.isDrillDown && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDrillDown}
              className="h-6 gap-1 px-2 text-xs text-primary"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to all categories</span>
            </Button>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">Drill-down:</span>
            <span className="font-semibold text-foreground">{donutData.drillDownTargetLabel}</span>
          </div>
        )}

        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Donut Chart */}
          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <div className="relative size-64">
              <ChartContainer config={chartConfig} className="size-full">
                <PieChart>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const slice = payload[0].payload as DonutSlice & { color: string };
                      return (
                        <div className="flex min-w-40 flex-col gap-1 rounded-lg border bg-popover/95 p-2 text-xs shadow-md">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="size-2 rounded-xs" style={{ backgroundColor: slice.color }} />
                            <span>{slice.label}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Amount:</span>
                            <span className="font-semibold text-foreground">
                              {formatMoney(slice.amount, defaultCurrency)}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Share:</span>
                            <span className="font-medium text-foreground">{slice.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Transactions:</span>
                            <span className="text-foreground">{slice.transactionCount}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={coloredSlices}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                  >
                    {coloredSlices.map((entry, index) => (
                      <Cell key={`cell-${entry.id}-${index}`} fill={entry.color} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) - 8}
                                className="fill-foreground font-bold font-mono text-xl"
                              >
                                {formatMoney(donutData.totalAmount, defaultCurrency)}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 14}
                                className="fill-muted-foreground font-medium text-xs uppercase tracking-wider"
                              >
                                {centerLabelSubtitle}
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </div>

          {/* Ranked Breakdown List */}
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1 lg:col-span-7">
            {coloredSlices.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                No transactions recorded for this selection
              </div>
            ) : (
              coloredSlices.map((slice) => (
                <button
                  key={slice.id}
                  type="button"
                  onClick={() => handleCategoryClick(slice)}
                  className="flex items-center justify-between rounded-lg border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: slice.color }} />
                    <div className="flex flex-col truncate">
                      <span className="truncate font-medium text-xs text-foreground">{slice.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {slice.transactionCount} {slice.transactionCount === 1 ? "transaction" : "transactions"}
                        {slice.tagNames && slice.tagNames.length > 0 && ` • #${slice.tagNames.slice(0, 3).join(", #")}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="font-semibold font-mono text-xs text-foreground">
                        {formatMoney(slice.amount, defaultCurrency)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {slice.percentage.toFixed(1)}%
                      </span>
                    </div>
                    {slice.hasTags && !donutData.isDrillDown && viewMode !== "by-tag" && (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </SectionShell>

      {/* 2. Filtered Historical Trend Chart Card */}
      <SectionShell
        title="Historical Monthly Trend"
        description="Plot spending & income curves over time for any selected category or tag (ExternalProvider Web chart window style)"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Active filter badge & clear */}
            {trendFilterType !== "all" && (
              <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-primary text-xs">
                <span>Filter: {trendFilterValue}</span>
                <button
                  type="button"
                  onClick={handleClearTrendFilter}
                  className="hover:text-primary-foreground focus:outline-hidden"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Flow selection */}
            <div className="inline-flex rounded-md border bg-muted/60 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTrendFlow("expenses")}
                className={`rounded px-2 py-0.5 transition-colors ${
                  trendFlow === "expenses" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Expenses
              </button>
              <button
                type="button"
                onClick={() => setTrendFlow("income")}
                className={`rounded px-2 py-0.5 transition-colors ${
                  trendFlow === "income" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setTrendFlow("both")}
                className={`rounded px-2 py-0.5 transition-colors ${
                  trendFlow === "both" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Both
              </button>
            </div>
          </div>
        }
      >
        <div className="h-64 w-full">
          {trendSeries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No trend data available for this selection
            </div>
          ) : (
            <ChartContainer
              config={{
                expenses: { label: "Expenses", color: "var(--chart-1, #ef4444)" },
                income: { label: "Income", color: "var(--chart-2, #10b981)" },
              }}
              className="size-full"
            >
              <LineChart data={trendSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} textAnchor="middle" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  width={35}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload as (typeof trendSeries)[number];
                    return (
                      <div className="flex min-w-36 flex-col gap-1 rounded-lg border bg-popover/95 p-2 text-xs shadow-md">
                        <span className="font-semibold text-foreground">{pt.monthLabel}</span>
                        {(trendFlow === "expenses" || trendFlow === "both") && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Expenses:</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              {formatMoney(pt.expenses, defaultCurrency)}
                            </span>
                          </div>
                        )}
                        {(trendFlow === "income" || trendFlow === "both") && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Income:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(pt.income, defaultCurrency)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-muted-foreground">
                          <span>Transactions:</span>
                          <span className="text-foreground">{pt.transactionCount}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {(trendFlow === "expenses" || trendFlow === "both") && (
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {(trendFlow === "income" || trendFlow === "both") && (
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </SectionShell>

      {/* 3. Matching Transaction Feed */}
      <SectionShell
        title="Matching Transactions"
        description={
          trendFilterType !== "all"
            ? `Transactions matching active filter: ${trendFilterValue}`
            : "Recent transactions across the portfolio"
        }
        action={
          <div className="w-56">
            <Input
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Search comment, tag, category..."
              className="h-7 text-xs"
            />
          </div>
        }
      >
        <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
          {matchingTransactions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs">No matching transactions found</div>
          ) : (
            matchingTransactions.map((tx) => {
              const txDate = getTransactionDate(tx);
              const { nativeAmount, currency, convertedAmount } = getConvertedTransactionAmount(
                tx,
                defaultCurrency,
                currencies,
              );
              const catId = tx.destinationId ?? tx.sourceId;
              const cat = catId ? categoryMap.get(catId) : undefined;
              const catName = cat?.name ?? "Unknown";
              const rawTags = Array.isArray(tx.tags) ? tx.tags.filter((t): t is string => typeof t === "string") : [];

              return (
                <div key={tx.id} className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {format(txDate, "yyyy-MM-dd")}
                    </span>
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                        <span>{catName}</span>
                        {tx.comment && (
                          <span className="text-muted-foreground truncate font-normal">({tx.comment})</span>
                        )}
                      </div>
                      {rawTags.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {rawTags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="cursor-pointer px-1.5 py-0 text-[10px]"
                              onClick={() => {
                                setTrendFilterType("tag");
                                setTrendFilterValue(normalizeLifestyleTag(tag));
                              }}
                            >
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-bold font-mono text-foreground">
                      {formatMoney(convertedAmount, defaultCurrency)}
                    </span>
                    {currency !== defaultCurrency && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatMoney(nativeAmount, currency)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionShell>
    </div>
  );
}
