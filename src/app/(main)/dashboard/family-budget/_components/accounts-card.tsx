"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowUpToLine,
  CreditCard,
  GripVertical,
  Landmark,
  MoreHorizontal,
  Plus,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { getCategories, updateCategoriesOrder } from "./external-provider-client";
import {
  archiveAccountCategory,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  computeAccountLiquiditySummary,
  filterAndClassifyAccounts,
  findAccountsBelowArchived,
  formatMoney,
  isThrowawayDebtAccount,
  type LastTransactionSummary,
  moveAccountsAboveArchived,
  unarchiveAccountCategory,
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
  onArchiveAccount?: (accountId: string) => Promise<void>;
  onUnarchiveAccount?: (accountId: string) => Promise<void>;
  onMoveAccountsAboveArchived?: (accountIds?: string[]) => Promise<void>;
  lastTransactionByCategoryId?: Map<string, LastTransactionSummary>;
  currencies?: ExternalProviderCurrency[];
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string | null) => void;
  onOpenNewDebtDialog?: () => void;
  onOpenClearingLedger?: (accountId: string) => void;
}

export function AccountsCard({
  categories: controlledCategories,
  currency = "PLN",
  isLoading: controlledIsLoading,
  error: controlledError,
  onRetry: controlledOnRetry,
  onReorderCategories,
  onArchiveAccount,
  onUnarchiveAccount,
  onMoveAccountsAboveArchived,
  lastTransactionByCategoryId,
  currencies = [],
  selectedAccountId = null,
  onSelectAccount,
  onOpenNewDebtDialog,
  onOpenClearingLedger,
}: AccountsCardProps) {
  const [internalCategories, setInternalCategories] = useState<ExternalProviderCategory[]>([]);
  const [internalIsLoading, setInternalIsLoading] = useState(true);
  const [internalError, setInternalError] = useState<Error | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [accountToArchive, setAccountToArchive] = useState<{
    account: ExternalProviderCategory;
    balance: number;
    currency: string;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);

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

  const accountsBelowArchived = useMemo(() => {
    return findAccountsBelowArchived(categories);
  }, [categories]);

  const accountsBelowArchivedIdSet = useMemo(() => {
    return new Set(accountsBelowArchived.map((c) => c.id));
  }, [accountsBelowArchived]);

  const handleArchive = useCallback(
    async (accountId: string) => {
      if (onArchiveAccount) {
        setIsMutating(true);
        try {
          await onArchiveAccount(accountId);
        } finally {
          setIsMutating(false);
        }
        return;
      }

      const prev = categories;
      const target = categories.find((c) => c.id === accountId);
      const { updatedCategories, modifiedCategories } = archiveAccountCategory(categories, accountId);
      if (modifiedCategories.length === 0) return;

      setInternalCategories(updatedCategories);
      setIsMutating(true);
      try {
        await updateCategoriesOrder(modifiedCategories, { allUpdatedCategories: updatedCategories });
        toast.success(`Archived "${target?.name ?? "account"}"`);
      } catch (err) {
        setInternalCategories(prev);
        toast.error(err instanceof Error ? err.message : "Failed to archive account");
      } finally {
        setIsMutating(false);
      }
    },
    [categories, onArchiveAccount],
  );

  const handleUnarchive = useCallback(
    async (accountId: string) => {
      if (onUnarchiveAccount) {
        setIsMutating(true);
        try {
          await onUnarchiveAccount(accountId);
        } finally {
          setIsMutating(false);
        }
        return;
      }

      const prev = categories;
      const target = categories.find((c) => c.id === accountId);
      const { updatedCategories, modifiedCategories } = unarchiveAccountCategory(categories, accountId);
      if (modifiedCategories.length === 0) return;

      setInternalCategories(updatedCategories);
      setIsMutating(true);
      try {
        await updateCategoriesOrder(modifiedCategories, { allUpdatedCategories: updatedCategories });
        const cleanName = target?.name.replace(/^_+/, "").trim() || "account";
        toast.success(`Unarchived "${cleanName}"`);
      } catch (err) {
        setInternalCategories(prev);
        toast.error(err instanceof Error ? err.message : "Failed to unarchive account");
      } finally {
        setIsMutating(false);
      }
    },
    [categories, onUnarchiveAccount],
  );

  const handleMoveAboveArchived = useCallback(
    async (accountIds?: string[]) => {
      if (onMoveAccountsAboveArchived) {
        setIsMutating(true);
        try {
          await onMoveAccountsAboveArchived(accountIds);
        } finally {
          setIsMutating(false);
        }
        return;
      }

      const prev = categories;
      const { updatedCategories, modifiedCategories } = moveAccountsAboveArchived(categories, accountIds);
      if (modifiedCategories.length === 0) return;

      setInternalCategories(updatedCategories);
      setIsMutating(true);
      try {
        await updateCategoriesOrder(modifiedCategories, { allUpdatedCategories: updatedCategories });
        toast.success(
          accountIds && accountIds.length === 1
            ? "Account moved above archived"
            : "Moved active accounts above archived",
        );
      } catch (err) {
        setInternalCategories(prev);
        toast.error(err instanceof Error ? err.message : "Failed to reposition accounts");
      } finally {
        setIsMutating(false);
      }
    },
    [categories, onMoveAccountsAboveArchived],
  );

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
            <div className="flex items-center gap-2">
              {onOpenNewDebtDialog && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={onOpenNewDebtDialog}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <Plus className="size-3" />
                  <span>New Debt</span>
                </Button>
              )}
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
        {accountsBelowArchived.length > 0 && !isLoading && !error && (
          <div className="border-amber-500/20 bg-amber-500/10 mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <span className="text-foreground">
                <span className="font-medium">
                  {accountsBelowArchived.length === 1
                    ? "1 active account is positioned below archived accounts"
                    : `${accountsBelowArchived.length} active accounts are positioned below archived accounts`}
                </span>
              </span>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void handleMoveAboveArchived()}
              disabled={isMutating}
              className="border-amber-500/30 hover:bg-amber-500/15 h-7 gap-1.5 text-xs font-medium"
            >
              <ArrowUpToLine className="size-3.5" />
              <span>Move above archived</span>
            </Button>
          </div>
        )}

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
                  isBelowArchived={accountsBelowArchivedIdSet.has(account.id)}
                  lastTx={lastTx}
                  canReorder={Boolean(onReorderCategories)}
                  isSelected={selectedAccountId === account.id}
                  disabled={isMutating}
                  onSelect={
                    onSelectAccount
                      ? () => onSelectAccount(selectedAccountId === account.id ? null : account.id)
                      : undefined
                  }
                  onOpenClearingLedger={
                    onOpenClearingLedger ?? (onSelectAccount ? (accId) => onSelectAccount(accId) : undefined)
                  }
                  onRequestArchive={(acc, bal, curr) =>
                    setAccountToArchive({ account: acc, balance: bal, currency: curr })
                  }
                  onUnarchive={(id) => void handleUnarchive(id)}
                  onMoveAboveArchived={(id) => void handleMoveAboveArchived([id])}
                />
              );
            })}
          </div>
        </DragDropProvider>

        <AlertDialog open={accountToArchive !== null} onOpenChange={(open) => !open && setAccountToArchive(null)}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Archive &quot;{accountToArchive?.account.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-muted-foreground flex flex-col gap-2 text-xs">
                  <p>
                    This account will be renamed to &quot;_{accountToArchive?.account.name.replace(/^_+/, "").trim()}
                    &quot; and moved to the end of your accounts list.
                  </p>
                  {accountToArchive && Math.abs(accountToArchive.balance) >= 0.005 && (
                    <div className="border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300 mt-1 flex items-start gap-2 rounded-md border p-2.5">
                      <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <span className="font-semibold">Unreconciled Balance Warning:</span> This account has a non-zero
                        balance ({formatMoney(accountToArchive.balance, accountToArchive.currency)}). In ExternalProvider,
                        archived accounts with non-zero balances remain visible with a reconciliation warning.
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isMutating}
                onClick={() => {
                  if (accountToArchive) {
                    const id = accountToArchive.account.id;
                    setAccountToArchive(null);
                    void handleArchive(id);
                  }
                }}
              >
                Archive account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
  isBelowArchived: boolean;
  lastTx?: LastTransactionSummary | null;
  canReorder: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onRequestArchive?: (account: ExternalProviderCategory, balance: number, currency: string) => void;
  onUnarchive?: (accountId: string) => void;
  onMoveAboveArchived?: (accountId: string) => void;
  onOpenClearingLedger?: (accountId: string) => void;
}

function SortableAccountRow({
  id,
  index,
  account,
  balance,
  currency,
  isArchived,
  hasUnreconciledBalance,
  isBelowArchived,
  lastTx,
  canReorder,
  isSelected = false,
  disabled = false,
  onSelect,
  onRequestArchive,
  onUnarchive,
  onMoveAboveArchived,
  onOpenClearingLedger,
}: SortableAccountRowProps) {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    type: "account-row",
    accept: "account-row",
    group: "accounts",
    modifiers: [RestrictToVerticalAxis],
    disabled: !canReorder || disabled,
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
            disabled={disabled}
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

            {isThrowawayDebtAccount(account) && (
              <Badge
                variant="outline"
                className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0 text-[10px] font-normal"
              >
                Clearing
              </Badge>
            )}

            {lastTx && (
              <span className="relative z-10">
                <LastTransactionBadge summary={lastTx} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pl-3">
        <span className={balance < 0 ? "text-destructive text-sm font-medium" : "text-foreground text-sm font-medium"}>
          {formatMoney(balance, currency)}
        </span>

        {Boolean(onRequestArchive ?? onUnarchive ?? onMoveAboveArchived ?? onOpenClearingLedger) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/60 hover:text-foreground relative z-10 size-7"
                aria-label={`Actions for ${account.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isThrowawayDebtAccount(account) && onOpenClearingLedger && (
                <DropdownMenuItem onClick={() => onOpenClearingLedger(account.id)}>
                  <Scale className="size-4 text-purple-500" />
                  <span>Open Clearing Ledger</span>
                </DropdownMenuItem>
              )}
              {!isArchived && isBelowArchived && onMoveAboveArchived && (
                <DropdownMenuItem onClick={() => onMoveAboveArchived(account.id)}>
                  <ArrowUpToLine className="size-4" />
                  <span>Move above archived</span>
                </DropdownMenuItem>
              )}
              {!isArchived && onRequestArchive && (
                <DropdownMenuItem onClick={() => onRequestArchive(account, balance, currency)}>
                  <Archive className="size-4" />
                  <span>Archive account</span>
                </DropdownMenuItem>
              )}
              {isArchived && onUnarchive && (
                <DropdownMenuItem onClick={() => onUnarchive(account.id)}>
                  <ArchiveRestore className="size-4" />
                  <span>Unarchive account</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
