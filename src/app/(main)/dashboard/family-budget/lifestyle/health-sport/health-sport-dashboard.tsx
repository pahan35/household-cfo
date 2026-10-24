"use client";

import { useMemo, useState } from "react";

import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Brain,
  Calendar,
  Check,
  Dumbbell,
  HeartPulse,
  Sparkles,
  Stethoscope,
  Tag,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatMoney } from "../../_components/external-provider-data";
import {
  computeWellnessMetrics,
  getConvertedTransactionAmount,
  getTransactionDate,
  type WellnessAuditItem,
  type WellnessStreamId,
  type WellnessStreamMetric,
} from "../../_components/lifestyle-transforms";
import { SectionShell } from "../../_components/section-shell";
import { useLifestyleData } from "../use-lifestyle-data";

function getStreamIcon(streamId: WellnessStreamId) {
  switch (streamId) {
    case "massage":
      return <Sparkles className="size-4" />;
    case "physiotherapy":
      return <Activity className="size-4" />;
    case "mental-health":
      return <Brain className="size-4" />;
    case "pilates":
      return <Zap className="size-4" />;
    case "medical":
      return <Stethoscope className="size-4" />;
    case "sport":
      return <Dumbbell className="size-4" />;
    default:
      return <HeartPulse className="size-4" />;
  }
}

function getStreamColorClass(streamId: WellnessStreamId) {
  switch (streamId) {
    case "massage":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "physiotherapy":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400";
    case "mental-health":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "pilates":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "medical":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "sport":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    default:
      return "bg-primary/10 text-primary";
  }
}

export function HealthSportDashboard() {
  const { categoryMap, currencies, transactions, defaultCurrency, updateTxTags } = useLifestyleData();

  const [savingTxId, setSavingTxId] = useState<string | null>(null);

  // Compute metrics and audit queue
  const { streams, auditQueue } = useMemo(() => {
    return computeWellnessMetrics({
      transactions,
      categories: categoryMap,
      currencies,
      defaultCurrency,
    });
  }, [transactions, categoryMap, currencies, defaultCurrency]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalCost = streams.reduce((acc, s) => acc + s.totalCost, 0);
    const totalSessions = streams.reduce((acc, s) => acc + s.totalSessions, 0);
    const avgCostPerSession = totalSessions > 0 ? Math.round((totalCost / totalSessions) * 100) / 100 : 0;
    return {
      totalCost,
      totalSessions,
      avgCostPerSession,
      auditCount: auditQueue.length,
    };
  }, [streams, auditQueue]);

  const handleApplyTag = async (item: WellnessAuditItem, tagToAdd: string) => {
    setSavingTxId(item.transaction.id);
    try {
      const existingTags = Array.isArray(item.transaction.tags)
        ? item.transaction.tags.filter((t): t is string => typeof t === "string")
        : [];
      const newTags = Array.from(new Set([...existingTags, tagToAdd]));
      await updateTxTags(item.transaction, newTags);
    } catch {
      // Error handled in updateTxTags
    } finally {
      setSavingTxId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <HeartPulse className="size-3.5 text-rose-500" />
            <span>Wellness &amp; Sport Spend</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">
            {formatMoney(kpis.totalCost, defaultCurrency)}
          </div>
          <span className="text-[10px] text-muted-foreground">Multi-currency unified</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Zap className="size-3.5 text-amber-500" />
            <span>Total Sessions</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">{kpis.totalSessions}</div>
          <span className="text-[10px] text-muted-foreground">Factoring pass multipliers</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Activity className="size-3.5 text-emerald-500" />
            <span>Avg Cost / Session</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-foreground">
            {formatMoney(kpis.avgCostPerSession, defaultCurrency)}
          </div>
          <span className="text-[10px] text-muted-foreground">Effective session efficiency</span>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <AlertTriangle className="size-3.5 text-amber-500" />
            <span>Audit Queue</span>
          </div>
          <div className="mt-1 font-bold font-mono text-lg text-amber-600 dark:text-amber-400">{kpis.auditCount}</div>
          <span className="text-[10px] text-muted-foreground">Untagged &amp; package outliers</span>
        </div>
      </div>

      {/* 2. Wellness Stream Cards */}
      <SectionShell
        title="Wellness &amp; Sport Streams"
        description="Unified multi-currency streams, Pilates 10-session pass multiplier, and session cadence"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream) => {
            const colorClass = getStreamColorClass(stream.streamId);
            const Icon = getStreamIcon(stream.streamId);

            return (
              <div
                key={stream.streamId}
                className="flex flex-col justify-between rounded-lg border bg-card p-4 shadow-xs"
              >
                <div>
                  {/* Stream Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex size-9 items-center justify-center rounded-lg ${colorClass}`}>{Icon}</div>
                      <div>
                        <span className="font-semibold text-foreground text-sm">{stream.label}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {stream.transactionCount} payments • {stream.totalSessions} estimated sessions
                        </span>
                      </div>
                    </div>

                    {stream.streamId === "pilates" && (
                      <Badge variant="outline" className="text-[10px]">
                        10x pass default
                      </Badge>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Total Spend:</span>
                      <span className="block font-bold font-mono text-foreground text-sm">
                        {formatMoney(stream.totalCost, defaultCurrency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground">Effective Cost / Session:</span>
                      <span className="block font-bold font-mono text-emerald-600 text-sm dark:text-emerald-400">
                        {formatMoney(stream.effectiveCostPerSession, defaultCurrency)}
                      </span>
                    </div>

                    <div className="border-t pt-1.5">
                      <span className="text-[10px] text-muted-foreground">Cadence Gap:</span>
                      <span className="block font-medium text-foreground">
                        {stream.daysBetweenSessions ? `~${stream.daysBetweenSessions} days` : "Single visit"}
                      </span>
                    </div>

                    <div className="border-t pt-1.5">
                      <span className="text-[10px] text-muted-foreground">Monthly Frequency:</span>
                      <span className="block font-medium text-foreground">{stream.monthlyCadence} visits / mo</span>
                    </div>
                  </div>
                </div>

                {/* Recent transaction preview */}
                <div className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
                  Latest:{" "}
                  {stream.transactions.length > 0
                    ? format(getTransactionDate(stream.transactions[stream.transactions.length - 1]), "MMM d, yyyy")
                    : "No transactions"}
                </div>
              </div>
            );
          })}
        </div>
      </SectionShell>

      {/* 3. Inline Wellness Tag & Pass Audit Queue */}
      <SectionShell
        title="Wellness Tag &amp; Pass Audit Queue"
        description="Untagged medicine/sport transactions and detected package outliers (>= 4x median single visit cost)"
      >
        {auditQueue.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border bg-card p-6 text-center text-muted-foreground text-xs">
            <div className="flex flex-col items-center gap-1.5">
              <Check className="size-5 text-emerald-500" />
              <span>All wellness and sport transactions are properly tagged and audited!</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border bg-card">
            {auditQueue.map((item) => {
              const tx = item.transaction;
              const txDate = format(getTransactionDate(tx), "yyyy-MM-dd");
              const isSaving = savingTxId === tx.id;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col justify-between gap-3 p-3 text-xs sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                        item.isOutlierPackage ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.isOutlierPackage ? <AlertTriangle className="size-3.5" /> : <Tag className="size-3.5" />}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <span>{tx.destinationName ?? "Expense"}</span>
                        {tx.comment && <span className="text-muted-foreground font-normal">({tx.comment})</span>}
                        {item.isOutlierPackage && (
                          <Badge className="bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-300">
                            Package Outlier
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {txDate} • {item.reason}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-foreground text-sm">
                      {formatMoney(item.convertedAmount, defaultCurrency)}
                    </span>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1.5">
                      {item.suggestedTags.map((tag) => (
                        <Button
                          key={tag}
                          variant="outline"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => void handleApplyTag(item, tag)}
                          className="h-7 px-2 text-[11px]"
                        >
                          +{tag.endsWith("x") ? `Pass #${tag}` : `#${tag}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionShell>
    </div>
  );
}
