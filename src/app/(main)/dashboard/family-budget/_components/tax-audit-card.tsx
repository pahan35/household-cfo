"use client";

import { useCallback, useState } from "react";

import { AlertCircle, Check, Loader2, ShieldCheck, Tag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { updateTransactionTags } from "./external-provider-client";
import {
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  formatMoney,
  formatTransactionDate,
} from "./external-provider-data";
import { SectionShell } from "./section-shell";
import { KNOWN_TAX_BUCKETS } from "./tax-transforms";

export interface TaxAuditCardProps {
  untaggedTransactions: ExternalProviderTransaction[];
  categories?: ExternalProviderCategory[];
  currency?: string;
  onTagAssigned?: (transaction: ExternalProviderTransaction, tag: string) => Promise<void>;
  isLoading?: boolean;
}

export function TaxAuditCard({
  untaggedTransactions,
  categories = [],
  currency = "PLN",
  onTagAssigned,
  isLoading = false,
}: TaxAuditCardProps) {
  const [selectedTags, setSelectedTags] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const handleSelectTag = (txId: string, tag: string) => {
    setSelectedTags((prev) => ({ ...prev, [txId]: tag }));
  };

  const handleSaveTag = useCallback(
    async (tx: ExternalProviderTransaction) => {
      const chosenTag = selectedTags[tx.id];
      if (!chosenTag) {
        toast.error("Please select a tax tag first");
        return;
      }

      setSavingId(tx.id);
      try {
        if (onTagAssigned) {
          await onTagAssigned(tx, chosenTag);
        } else {
          const existingTags = Array.isArray(tx.tags) ? tx.tags : [];
          const updatedTags = [...existingTags, chosenTag];
          await updateTransactionTags(tx, updatedTags);
        }
        toast.success(`Tag #${chosenTag} assigned to tax transaction`);
      } catch (err) {
        toast.error("Failed to assign tax tag", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setSavingId(null);
      }
    },
    [selectedTags, onTagAssigned],
  );

  return (
    <SectionShell
      title="Missing Tax Tag Audit"
      description="Tax transactions lacking recognized tags (#PPE, #zus, #health, #VAT-7, #belka)"
      action={
        !isLoading ? (
          untaggedTransactions.length > 0 ? (
            <Badge variant="destructive" className="font-mono text-xs">
              {untaggedTransactions.length} untagged
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
              All tagged
            </Badge>
          )
        ) : undefined
      }
      isLoading={isLoading}
      isEmpty={untaggedTransactions.length === 0}
      emptyTitle="Audit Passed: All Taxes Tagged"
      emptyDescription="All outgoing tax payments carry recognized tags and are properly distributed."
      emptyIcon={<ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400" />}
      skeletonCount={2}
    >
      <div className="flex flex-col gap-2">
        {untaggedTransactions.map((tx) => {
          const isSaving = savingId === tx.id;
          const chosenTag = selectedTags[tx.id] || "";
          const amount = Math.abs(Number(tx.destinationAmount ?? tx.sourceAmount ?? tx.defaultAmount) || 0);
          const txCurrency = tx.destinationCurrencyId ?? tx.sourceCurrencyId ?? currency;
          const sourceName = tx.sourceName ?? (tx.sourceId ? categoryMap.get(tx.sourceId)?.name : "Account");
          const formattedDate = tx.dateTimestampISO
            ? formatTransactionDate(tx.dateTimestampISO)
            : tx.dateTimestamp
              ? new Date(tx.dateTimestamp).toLocaleDateString()
              : "Unknown date";

          return (
            <div
              key={tx.id}
              className="border-amber-500/20 bg-card/60 hover:bg-card/90 flex flex-col justify-between gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4 shrink-0" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-xs font-semibold">{sourceName}</span>
                    <span className="text-muted-foreground text-[11px]">{formattedDate}</span>
                  </div>
                  {tx.comment && (
                    <span className="text-muted-foreground truncate text-[11px] italic">"{tx.comment}"</span>
                  )}
                  {Array.isArray(tx.tags) && tx.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {tx.tags.map((t) => (
                        <span key={t} className="text-muted-foreground font-mono text-[10px]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Amount, Inline Select, and Save Button */}
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  -{formatMoney(amount, txCurrency)}
                </span>

                <Select value={chosenTag} onValueChange={(val) => handleSelectTag(tx.id, val)}>
                  <SelectTrigger size="sm" className="h-7 w-32 text-xs">
                    <SelectValue placeholder="Assign tag..." />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
                    {KNOWN_TAX_BUCKETS.map((b) => (
                      <SelectItem key={b.canonicalTag} value={b.canonicalTag} className="text-xs">
                        #{b.canonicalTag} ({b.id === "vat" ? "VAT-7" : b.id.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!chosenTag || isSaving}
                  onClick={() => void handleSaveTag(tx)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                  <span>Save</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
