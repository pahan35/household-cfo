"use client";

import { cn } from "cn";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Calendar, Clock, MessageSquare, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { formatMoney, type LastTransactionSummary } from "./external-provider-data";

interface LastTransactionBadgeProps {
  summary?: LastTransactionSummary | null;
  className?: string;
  showDateInline?: boolean;
  defaultCurrency?: string;
}

export function LastTransactionBadge({
  summary,
  className,
  showDateInline = true,
  defaultCurrency = "PLN",
}: LastTransactionBadgeProps) {
  if (!summary) {
    return null;
  }

  let directionColor = "text-foreground";
  if (summary.direction === "income") {
    directionColor = "text-emerald-600 dark:text-emerald-400";
  } else if (summary.direction === "transfer") {
    directionColor = "text-primary";
  }

  let sign = "";
  if (summary.direction === "income") {
    sign = "+";
  } else if (summary.direction === "expense") {
    sign = "-";
  }

  function renderDirectionIcon() {
    if (!summary) return null;
    switch (summary.direction) {
      case "income":
        return <ArrowDownLeft className="size-3 text-emerald-600 dark:text-emerald-400" />;
      case "transfer":
        return <ArrowLeftRight className="text-primary size-3" />;
      default:
        return <ArrowUpRight className="text-muted-foreground size-3" />;
    }
  }

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/badge text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-left text-[11px] transition-colors focus-visible:ring-1 focus-visible:outline-hidden",
            className,
          )}
          aria-label={`Last transaction on ${summary.formattedDate}: ${summary.counterpartLabel} ${summary.counterpartName}`}
        >
          <Clock className="text-muted-foreground/70 group-hover/badge:text-foreground size-3 transition-colors" />
          {showDateInline && <span>{summary.formattedDate}</span>}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-72 p-3 text-xs shadow-lg" sideOffset={6}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2 border-b pb-2">
            <div className="flex items-center gap-1.5">
              <div className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-md">
                {renderDirectionIcon()}
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Last Transaction
                </span>
                <span className="text-foreground text-xs font-semibold">
                  {summary.counterpartLabel}: {summary.counterpartName}
                </span>
              </div>
            </div>
            <div className="text-right">
              {(() => {
                const nativeAmt = summary.originalAmount ?? summary.amount;
                const nativeCurr = summary.originalCurrency ?? summary.currency;
                const isForeign =
                  Boolean(nativeCurr && nativeCurr.toUpperCase() !== defaultCurrency.toUpperCase()) ||
                  Boolean(summary.currency && summary.currency.toUpperCase() !== defaultCurrency.toUpperCase());
                const displayAmount = summary.normalizedAmount ?? summary.amount;

                return (
                  <>
                    <span className={cn("text-xs font-semibold tabular-nums", directionColor)}>
                      {sign}
                      {formatMoney(displayAmount, defaultCurrency)}
                    </span>
                    {isForeign && (
                      <span className="text-muted-foreground block text-[10px] tabular-nums">
                        orig. {formatMoney(nativeAmt, nativeCurr)}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Calendar className="size-3" />
            <span>{summary.formattedDate}</span>
          </div>

          {summary.comment && (
            <div className="bg-muted/60 text-foreground/90 flex items-start gap-1.5 rounded-md p-2 text-xs">
              <MessageSquare className="text-muted-foreground mt-0.5 size-3 shrink-0" />
              <span className="leading-tight break-words">{summary.comment}</span>
            </div>
          )}

          {summary.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <Tag className="text-muted-foreground size-3" />
              {summary.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
