"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { AlertTriangle, Archive, CreditCard, GripVertical, Landmark, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { getCategories } from "./external-provider-client";
import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  computeAccountLiquiditySummary,
  filterAndClassifyAccounts,
  formatMoney,
  type LastTransactionSummary,
} from "./external-provider-data";
import { LastTransactionBadge } from "./last-transaction-badge";
import { SectionShell } from "./section-shell";

interface AccountsCardProps {
  categories?: ExternalProviderCategory[];
  currency?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onReorderCategories?: (reorderedVisibleIds: string[]) => Promise<void>;
  lastTransactionByCategoryId?: Map<string, LastTransactionSummary>;
  currencies?: ExternalProviderCurrency[];
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string | null) => void;
}

export function AccountsCard({
  categories: controlledCategories,
  currency = "PLN",
  isLoading: controlledIsLoading,
  error: controlledError,
  onRetry: controlledOnRetry,
  onReorderCategories,
  lastTransactionByCategoryId,
  currencies = [],
  selectedAccountId = null,
  onSelectAccount,
}: AccountsCardProps) {
  const [internalCategories, setInternalCategories] = useState<ExternalProviderCategory[]>([]);
  const [internalIsLoading, setInternalIsLoading] = useState(true);
  const [internalError, setInternalError] = useState<Error | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const isControlled = controlledCategories !== undefined;
  const categories = isControlled ? controlledCategories : internalCategories;
  const isLoading = isControlled ? (controlledIsLoading ?? false) : internalIsLoading;
  const error = isControlled ? (controlledError ?? null) : internalError;

  const fetchAccounts = useCallback(async (signal?: AbortSignal, forceRefresh?: boolean) => {
    setInternalIsLoading(true);
    setInternalError(null);
    try {
      const data = await getCategories({ signal, forceRefresh });
      setInternalCategories(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setInternalError(err instanceof Error ? err : new Error("Failed to load accounts"));
    } finally {
      setInternalIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isControlled) return;
    const controller = new AbortController();
    void fetchAccounts(controller.signal);
    return () => {
      controller.abort();
    };
  }, [isControlled, fetchAccounts]);

  const handleRetry = useCallback(() => {
    if (controlledOnRetry) {
      controlledOnRetry();
    } else {
      void fetchAccounts(undefined, true);
    }
  }, [controlledOnRetry, fetchAccounts]);

  // Classified accounts respecting archive rules and sorted by order
  const classifiedAccounts = useMemo(() => {
    return filterAndClassifyAccounts(categories, { showArchived });
  }, [categories, showArchived]);

  // Total balance of all non-deleted accounts, converted into the default currency
  const totalBalance = useMemo(() => {
    return computeAccountLiquiditySummary(categories, currencies, currency).totalNetLiquid;
  }, [categories, currencies, currency]);

  // Count hidden archived accounts with zero balance
  const hiddenArchivedCount = useMemo(() => {
    return categories.filter((c) => {
      if (c.deleted) return false;
      const t = Number(c.categoryType);
      const isAccount = t === CategoryType.Account || t === CategoryType.BankAccount || t === CategoryType.DebtAccount;
      if (!isAccount) return false;
      const isArchived = typeof c.name === "string" && c.name.trim().startsWith("_");
      const isZero = Math.abs(Number(c.amount) || 0) < 0.005;
      return isArchived && isZero;
    }).length;
  }, [categories]);

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation;

    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
      return;
    }

    const visibleIds = classifiedAccounts.map((c) => c.account.id);
    const [moved] = visibleIds.splice(source.initialIndex, 1);
    visibleIds.splice(source.index, 0, moved);

    if (onReorderCategories) {
      void onReorderCategories(visibleIds);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <SectionShell
        title="Accounts & Cards"
        description="Active accounts, cards, and liquid balances"
        action={
          !isLoading && !error && classifiedAccounts.length > 0 ? (
            <div className="flex items-center gap-3">
              {(hiddenArchivedCount > 0 || showArchived) && (
                <Button
                  type="button"
                  variant={showArchived ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <Archive className="text-muted-foreground size-3" />
                  <span>{showArchived ? "Hide archived" : `Show archived (${hiddenArchivedCount})`}</span>
                </Button>
              )}
              <div className="text-right">
                <span className="text-muted-foreground text-xs">Total: </span>
                <span className="text-sm font-semibold">{formatMoney(totalBalance, currency)}</span>
              </div>
            </div>
          ) : undefined
        }
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        isEmpty={classifiedAccounts.length === 0}
        emptyTitle="No accounts found"
        emptyDescription="No account-type categories found in ExternalProvider. Add accounts in ExternalProvider to see them here."
        emptyIcon={<Wallet className="text-muted-foreground size-6" />}
        skeletonCount={4}
      >
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-0.5">
            {classifiedAccounts.map(({ account, isArchived, hasUnreconciledBalance, balance }, index) => {
              const lastTx = lastTransactionByCategoryId?.get(account.id);

              return (
                <SortableAccountRow
                  key={account.id}
                  id={account.id}
                  index={index}
                  account={account}
                  balance={balance}
                  currency={account.currencyId || currency}
                  isArchived={isArchived}
                  hasUnreconciledBalance={hasUnreconciledBalance}
                  lastTx={lastTx}
                  canReorder={Boolean(onReorderCategories)}
                  isSelected={selectedAccountId === account.id}
                  onSelect={
                    onSelectAccount
                      ? () => onSelectAccount(selectedAccountId === account.id ? null : account.id)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </DragDropProvider>
      </SectionShell>
    </TooltipProvider>
  );
}

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
      return <Landmark className="text-primary size-4" />;
    case CategoryType.Account:
      return <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />;
    default:
      return <CreditCard className="text-muted-foreground size-4" />;
  }
}

interface SortableAccountRowProps {
  id: string;
  index: number;
  account: ExternalProviderCategory;
  balance: number;
  currency: string;
  isArchived: boolean;
  hasUnreconciledBalance: boolean;
  lastTx?: LastTransactionSummary | null;
  canReorder: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

function SortableAccountRow({
  id,
  index,
  account,
  balance,
  currency,
  isArchived,
  hasUnreconciledBalance,
  lastTx,
  canReorder,
  isSelected = false,
  onSelect,
}: SortableAccountRowProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    type: "account-row",
    accept: "account-row",
    group: "accounts",
    modifiers: [RestrictToVerticalAxis],
    disabled: !canReorder,
  });

  const typeNum = Number(account.categoryType);

  return (
    <div
      ref={ref}
      className={cn(
        "group/row relative flex items-center justify-between px-2 py-3 transition-opacity",
        isSelected && "bg-primary/5 ring-primary/40 rounded-lg ring-1",
        isDragging && "bg-muted/40 relative z-10 rounded-lg opacity-50",
        isArchived && !hasUnreconciledBalance && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {canReorder && (
          <Button
            ref={handleRef}
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground/40 hover:text-foreground relative z-10 -ml-1 cursor-grab opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
            aria-label={`Reorder ${account.name}`}
          >
            <GripVertical className="size-3.5" />
          </Button>
        )}

        <div className="bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg">
          {getAccountIcon(typeNum)}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {onSelect ? (
              <button
                type="button"
                onClick={onSelect}
                aria-pressed={isSelected}
                aria-label={`Filter transactions by ${account.name}`}
                className="focus-visible:ring-ring cursor-pointer truncate rounded-sm text-left text-sm leading-none font-medium outline-none after:absolute after:inset-0 focus-visible:ring-2"
              >
                {account.name}
              </button>
            ) : (
              <span className="truncate text-sm leading-none font-medium">{account.name}</span>
            )}

            {hasUnreconciledBalance && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative z-10 inline-flex cursor-help items-center text-amber-500 transition-colors hover:text-amber-600">
                    <AlertTriangle className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-2.5 text-xs">
                  <div className="font-semibold text-amber-500">Unreconciled Archived Account</div>
                  <div className="text-muted-foreground mt-1">
                    This archived account ('_' prefix) has a non-zero balance ({formatMoney(balance, currency)}). In
                    ExternalProvider, edit its balance directly to 0 or record a transfer to/from an active account to
                    reconcile it.
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {isArchived && !hasUnreconciledBalance && (
              <Badge variant="secondary" className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal">
                Archived
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
              {getCategoryTypeName(typeNum)}
            </Badge>

            {lastTx && (
              <span className="relative z-10">
                <LastTransactionBadge summary={lastTx} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 pl-3 text-right">
        <span className={balance < 0 ? "text-destructive text-sm font-medium" : "text-foreground text-sm font-medium"}>
          {formatMoney(balance, currency)}
        </span>
      </div>
    </div>
  );
}
