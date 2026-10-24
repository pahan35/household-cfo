"use client";

import { AlertTriangle, Coins, Landmark, Scale, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { type AccountLiquiditySummary, type ExternalProviderCategory, formatMoney } from "./external-provider-data";

interface AccountLiquidityStripProps {
  summary: AccountLiquiditySummary;
  currency: string;
  selectedAccount?: ExternalProviderCategory | null;
  isLoading?: boolean;
}

export function AccountLiquidityStrip({
  summary,
  currency,
  selectedAccount,
  isLoading = false,
}: AccountLiquidityStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {["l-1", "l-2", "l-3"].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const selectedBalance = Number(selectedAccount?.currentAmount ?? selectedAccount?.amount) || 0;
  const selectedCurrency = selectedAccount?.currencyId?.length ? selectedAccount.currencyId : currency;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Total Net Liquid Balance</span>
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatMoney(summary.totalNetLiquid, currency)}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {summary.unconvertedCurrencies.length > 0
                ? `No rate for ${summary.unconvertedCurrencies.join(", ")} (excluded)`
                : `Converted to ${currency}, excl. off-balance accounts`}
            </span>
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <Wallet className="size-4" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs font-normal">Native Currency Breakdown</span>
            {summary.byCurrency.length === 0 ? (
              <span className="text-muted-foreground text-sm">No accounts</span>
            ) : (
              <div className="flex flex-col gap-0.5">
                {summary.byCurrency.map(({ currency: code, balance }) => (
                  <span key={code} className="text-foreground text-sm font-medium tabular-nums">
                    {formatMoney(balance, code)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bg-muted text-muted-foreground rounded-lg p-2">
            <Coins className="size-4" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 border shadow-xs">
        <CardContent className="flex items-start justify-between p-4">
          {selectedAccount ? (
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-muted-foreground text-xs font-normal">Filtered Account</span>
              <span className="text-foreground truncate text-sm font-semibold">{selectedAccount.name}</span>
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {formatMoney(selectedBalance, selectedCurrency)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-normal">Debt &amp; Reconciliation</span>
              <span className="text-foreground text-lg font-semibold tabular-nums">
                {formatMoney(summary.debtBalance, currency)}
              </span>
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                {summary.unreconciledCount > 0 && <AlertTriangle className="size-3 text-amber-500" />}
                {summary.unreconciledCount > 0
                  ? `${summary.unreconciledCount} unreconciled archived account(s)`
                  : "Debt accounts total • all reconciled"}
              </span>
            </div>
          )}
          <div className="bg-muted text-muted-foreground rounded-lg p-2">
            {selectedAccount ? <Landmark className="size-4" /> : <Scale className="size-4" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
