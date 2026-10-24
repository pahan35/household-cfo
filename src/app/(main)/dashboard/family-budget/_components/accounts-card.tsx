"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CreditCard, Landmark, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { getCategories } from "./external-provider-client";
import { CategoryType, type ExternalProviderCategory, formatMoney } from "./external-provider-data";
import { SectionShell } from "./section-shell";

interface AccountsCardProps {
  currency?: string;
}

export function AccountsCard({ currency = "PLN" }: AccountsCardProps) {
  const [categories, setCategories] = useState<ExternalProviderCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCategories({ signal });
      setCategories(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err : new Error("Failed to load accounts"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAccounts(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchAccounts]);

  const accountCategories = useMemo(() => {
    return categories.filter((c) => {
      if (c.deleted) return false;
      const t = Number(c.categoryType);
      return t === CategoryType.Account || t === CategoryType.BankAccount || t === CategoryType.DebtAccount;
    });
  }, [categories]);

  const totalBalance = useMemo(() => {
    return accountCategories.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [accountCategories]);

  function getCategoryTypeName(type: number): string {
    switch (type) {
      case CategoryType.BankAccount:
        return "Bank Account";
      case CategoryType.Account:
        return "Cash / Wallet";
      case CategoryType.DebtAccount:
        return "Debt Account";
      default:
        return "Account";
    }
  }

  function getAccountIcon(type: number) {
    switch (type) {
      case CategoryType.BankAccount:
        return <Landmark className="size-4 text-primary" />;
      case CategoryType.Account:
        return <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <CreditCard className="size-4 text-muted-foreground" />;
    }
  }

  return (
    <SectionShell
      title="Accounts & Cards"
      description="Active accounts, cards, and liquid balances"
      action={
        !isLoading && !error && accountCategories.length > 0 ? (
          <div className="text-right">
            <span className="text-muted-foreground text-xs">Total: </span>
            <span className="font-semibold text-sm">{formatMoney(totalBalance, currency)}</span>
          </div>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        void fetchAccounts();
      }}
      isEmpty={accountCategories.length === 0}
      emptyTitle="No accounts found"
      emptyDescription="No account-type categories found in ExternalProvider. Add accounts in ExternalProvider to see them here."
      emptyIcon={<Wallet className="size-6 text-muted-foreground" />}
      skeletonCount={4}
    >
      <div className="flex flex-col divide-y divide-border/60">
        {accountCategories.map((acc) => {
          const typeNum = Number(acc.categoryType);
          const balance = Number(acc.amount) || 0;
          return (
            <div key={acc.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                  {getAccountIcon(typeNum)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm leading-none">{acc.name}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="px-1.5 py-0 font-normal text-[10px]">
                      {getCategoryTypeName(typeNum)}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={
                    balance < 0 ? "font-medium text-destructive text-sm" : "font-medium text-foreground text-sm"
                  }
                >
                  {formatMoney(balance, acc.currencyId || currency)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
