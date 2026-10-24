"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import {
  AlertCircle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Percent,
  Scale,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  buildFeeTransaction,
  buildFxReconciliationTransaction,
  buildPrincipalOutflowTransaction,
  buildSettlementTransaction,
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
  convertCurrencyAmount,
  formatMoney,
  isAccountType,
  isArchivedCategoryName,
} from "./external-provider-data";

interface DebtClearingPanelProps {
  debtAccount: ExternalProviderCategory;
  allCategories: ExternalProviderCategory[];
  currencies: ExternalProviderCurrency[];
  defaultCurrency: string;
  onClose?: () => void;
  onCreateTransaction: (tx: ExternalProviderTransaction) => Promise<void>;
  onArchiveSettledAccount: (accountId: string, options?: { exceptFromBalance?: boolean }) => Promise<void>;
  isMutating?: boolean;
}

export function DebtClearingPanel({
  debtAccount,
  allCategories,
  currencies,
  defaultCurrency,
  onClose,
  onCreateTransaction,
  onArchiveSettledAccount,
  isMutating = false,
}: DebtClearingPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("outflow");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = Number(debtAccount.amount) || 0;
  const debtCurrency = debtAccount.currencyId ?? defaultCurrency;
  const isArchived = isArchivedCategoryName(debtAccount.name);
  const isZeroBalance = Math.abs(balance) < 0.005;

  // Active user payment accounts (excluding this debt account)
  const paymentAccounts = useMemo(() => {
    return allCategories
      .filter((c) => !c.deleted && isAccountType(c.categoryType) && c.id !== debtAccount.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories, debtAccount.id]);

  // Expense categories
  const expenseCategories = useMemo(() => {
    return allCategories
      .filter((c) => !c.deleted && Number(c.categoryType) === CategoryType.Expense)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories]);

  // Income categories
  const incomeCategories = useMemo(() => {
    return allCategories
      .filter((c) => !c.deleted && Number(c.categoryType) === CategoryType.Income)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories]);

  // -------------------------------------------------------------
  // TAB 1: Outflow (Principal Purchase)
  // -------------------------------------------------------------
  const [outflowSourceId, setOutflowSourceId] = useState<string>(paymentAccounts[0]?.id ?? "");
  const [outflowSourceAmount, setOutflowSourceAmount] = useState<string>("");
  const [outflowDestAmount, setOutflowDestAmount] = useState<string>("");
  const [outflowComment, setOutflowComment] = useState<string>("");

  const outflowSourceAccount = useMemo(
    () => paymentAccounts.find((a) => a.id === outflowSourceId) ?? paymentAccounts[0],
    [paymentAccounts, outflowSourceId],
  );

  function handleOutflowSourceAmountChange(val: string) {
    setOutflowSourceAmount(val);
    const num = parseFloat(val);
    if (!Number.isNaN(num) && num > 0 && outflowSourceAccount) {
      const srcCurr = outflowSourceAccount.currencyId ?? defaultCurrency;
      const converted = convertCurrencyAmount(num, srcCurr, debtCurrency, currencies);
      if (converted !== null) {
        setOutflowDestAmount((Math.round(converted * 100) / 100).toString());
      }
    }
  }

  async function handleOutflowSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outflowSourceAccount) return;
    const srcAmt = parseFloat(outflowSourceAmount);
    const destAmt = parseFloat(outflowDestAmount);
    if (Number.isNaN(srcAmt) || srcAmt <= 0 || Number.isNaN(destAmt) || destAmt <= 0) {
      toast.error("Please enter valid positive amounts");
      return;
    }

    try {
      setIsSubmitting(true);
      const tx = buildPrincipalOutflowTransaction({
        sourceAccount: outflowSourceAccount,
        debtAccount,
        sourceAmount: srcAmt,
        destinationAmount: destAmt,
        comment: outflowComment.trim() || undefined,
      });
      await onCreateTransaction(tx);
      setOutflowSourceAmount("");
      setOutflowDestAmount("");
      setOutflowComment("");
      toast.success("Principal outflow recorded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record outflow");
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // TAB 2: Fee
  // -------------------------------------------------------------
  const [feeSourceId, setFeeSourceId] = useState<string>(paymentAccounts[0]?.id ?? "");
  const [feeAbsorbedBy, setFeeAbsorbedBy] = useState<"debtor" | "me">("debtor");
  const [feeAmount, setFeeAmount] = useState<string>("");
  const [feeConvertedAmount, setFeeConvertedAmount] = useState<string>("");
  const [feeExpenseCatId, setFeeExpenseCatId] = useState<string>(expenseCategories[0]?.id ?? "");
  const [feeComment, setFeeComment] = useState<string>("");

  const feeSourceAccount = useMemo(
    () => paymentAccounts.find((a) => a.id === feeSourceId) ?? paymentAccounts[0],
    [paymentAccounts, feeSourceId],
  );

  function handleFeeAmountChange(val: string) {
    setFeeAmount(val);
    const num = parseFloat(val);
    if (!Number.isNaN(num) && num > 0 && feeSourceAccount) {
      const srcCurr = feeSourceAccount.currencyId ?? defaultCurrency;
      const converted = convertCurrencyAmount(num, srcCurr, debtCurrency, currencies);
      if (converted !== null) {
        setFeeConvertedAmount((Math.round(converted * 100) / 100).toString());
      }
    }
  }

  async function handleFeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feeSourceAccount) return;
    const feeNum = parseFloat(feeAmount);
    if (Number.isNaN(feeNum) || feeNum <= 0) {
      toast.error("Please enter a valid fee amount");
      return;
    }

    const convertedNum = feeConvertedAmount ? parseFloat(feeConvertedAmount) : undefined;
    const feeExpenseCategory = allCategories.find((c) => c.id === feeExpenseCatId);

    try {
      setIsSubmitting(true);
      const tx = buildFeeTransaction({
        sourceAccount: feeSourceAccount,
        debtAccount,
        feeExpenseCategory,
        absorbedBy: feeAbsorbedBy,
        feeAmount: feeNum,
        convertedFeeAmount: convertedNum,
        comment: feeComment.trim() || undefined,
      });
      await onCreateTransaction(tx);
      setFeeAmount("");
      setFeeConvertedAmount("");
      setFeeComment("");
      toast.success(
        feeAbsorbedBy === "debtor"
          ? "Fee recorded (added to debt receivable)"
          : "Fee recorded (absorbed as personal expense)",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record fee");
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // TAB 3: Settle
  // -------------------------------------------------------------
  const [settlementCase, setSettlementCase] = useState<"shared" | "service" | "transfer">("shared");
  const [settleDebtAmount, setSettleDebtAmount] = useState<string>("");
  const [settleTargetId, setSettleTargetId] = useState<string>(
    expenseCategories[0]?.id ?? paymentAccounts[0]?.id ?? "",
  );
  const [settleDestAmount, setSettleDestAmount] = useState<string>("");
  const [settleComment, setSettleComment] = useState<string>("");

  const settleTargetCategory = useMemo(() => {
    return allCategories.find((c) => c.id === settleTargetId);
  }, [allCategories, settleTargetId]);

  function handleSettleDebtAmountChange(val: string) {
    setSettleDebtAmount(val);
    const num = parseFloat(val);
    if (!Number.isNaN(num) && num > 0 && settleTargetCategory) {
      const targetCurr = settleTargetCategory.currencyId ?? defaultCurrency;
      const converted = convertCurrencyAmount(num, debtCurrency, targetCurr, currencies);
      if (converted !== null) {
        setSettleDestAmount((Math.round(converted * 100) / 100).toString());
      }
    }
  }

  async function handleSettleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settleTargetCategory) {
      toast.error("Please select a destination category or account");
      return;
    }
    const debtAmt = parseFloat(settleDebtAmount);
    const destAmt = parseFloat(settleDestAmount);
    if (Number.isNaN(debtAmt) || debtAmt <= 0 || Number.isNaN(destAmt) || destAmt <= 0) {
      toast.error("Please enter valid positive settlement amounts");
      return;
    }

    try {
      setIsSubmitting(true);
      const tx = buildSettlementTransaction({
        debtAccount,
        destinationCategory: settleTargetCategory,
        deductedDebtAmount: debtAmt,
        settledAmount: destAmt,
        comment: settleComment.trim() || undefined,
      });
      await onCreateTransaction(tx);
      setSettleDebtAmount("");
      setSettleDestAmount("");
      setSettleComment("");
      toast.success("Settlement recorded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record settlement");
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // TAB 4: Reconcile & Archive
  // -------------------------------------------------------------
  const [reconcileCategoryId, setReconcileCategoryId] = useState<string>(
    balance > 0 ? (expenseCategories[0]?.id ?? "") : (incomeCategories[0]?.id ?? ""),
  );

  useEffect(() => {
    if (balance > 0.005) {
      setReconcileCategoryId(expenseCategories[0]?.id ?? "");
    } else if (balance < -0.005) {
      setReconcileCategoryId(incomeCategories[0]?.id ?? "");
    }
  }, [balance, expenseCategories, incomeCategories]);

  async function handleReconcileAndArchive() {
    try {
      setIsSubmitting(true);
      if (!isZeroBalance) {
        const cat = allCategories.find((c) => c.id === reconcileCategoryId);
        if (!cat) {
          toast.error("Please select a category for remainder reconciliation");
          return;
        }

        const adjustmentTx = buildFxReconciliationTransaction({
          debtAccount,
          balance,
          reconciliationCategory: cat,
        });

        if (adjustmentTx) {
          await onCreateTransaction(adjustmentTx);
          toast.success("FX remainder adjustment transaction recorded");
        }
      }

      await onArchiveSettledAccount(debtAccount.id, { exceptFromBalance: true });
      toast.success(`Account archived as "_${debtAccount.name.replace(/^_+/, "").trim()}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reconciliation and archive failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderStatusBadge() {
    if (isArchived) {
      return (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
          Archived
        </Badge>
      );
    }
    if (isZeroBalance) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-normal text-emerald-600 dark:text-emerald-400"
        >
          Settled (0.00)
        </Badge>
      );
    }
    if (balance > 0) {
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[10px] font-normal text-blue-600 dark:text-blue-400"
        >
          Active Receivable
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-normal text-amber-600 dark:text-amber-400"
      >
        Credit / Overpaid
      </Badge>
    );
  }

  function renderReconcileContent() {
    if (isZeroBalance) {
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                Account Balance is Fully Settled (0.00 {debtCurrency})
              </span>
              <span className="text-muted-foreground">
                This throwaway account has no remaining balance. You can safely archive it with a leading &quot;_&quot;
                prefix so historical transactions and analytics remain intact while hiding it from active views.
              </span>
            </div>
          </div>

          {isArchived ? (
            <div className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <Archive className="text-muted-foreground size-3.5" />
              <span>This account is already archived.</span>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleReconcileAndArchive}
              disabled={isSubmitting || isMutating}
              className="self-start bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            >
              <Archive className="mr-1.5 size-3.5" />
              {isSubmitting ? "Archiving..." : "Archive Settled Account"}
            </Button>
          )}
        </div>
      );
    }

    if (balance > 0) {
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-blue-500" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-blue-800 dark:text-blue-300">
                Positive Remainder: +{formatMoney(balance, debtCurrency)} (Forgiven Loss / FX Discrepancy)
              </span>
              <span className="text-muted-foreground">
                To bring this account to 0.00 and archive it, record an adjustment expense transaction to close out the
                forgiven or FX loss remainder.
              </span>
            </div>
          </div>

          <div className="flex max-w-sm flex-col gap-2 pt-1">
            <Label className="text-xs font-medium">Reconciliation Expense Category</Label>
            <Select value={reconcileCategoryId} onValueChange={setReconcileCategoryId} disabled={isSubmitting}>
              <SelectTrigger className="bg-background w-full text-xs">
                <SelectValue placeholder="Select FX Loss / Expense category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className="text-xs">
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleReconcileAndArchive}
            disabled={isSubmitting || isMutating || !reconcileCategoryId}
            className="mt-1 self-start text-xs"
          >
            <Sparkles className="mr-1.5 size-3.5" />
            {isSubmitting ? "Reconciling..." : `Reconcile Loss (${formatMoney(balance, debtCurrency)}) & Archive`}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              Negative Remainder: {formatMoney(balance, debtCurrency)} (Overpayment / FX Gain)
            </span>
            <span className="text-muted-foreground">
              To bring this account to 0.00 and archive it, record an adjustment income transaction for the FX gain or
              overpayment remainder.
            </span>
          </div>
        </div>

        <div className="flex max-w-sm flex-col gap-2 pt-1">
          <Label className="text-xs font-medium">Reconciliation Income Category</Label>
          <Select value={reconcileCategoryId} onValueChange={setReconcileCategoryId} disabled={isSubmitting}>
            <SelectTrigger className="bg-background w-full text-xs">
              <SelectValue placeholder="Select FX Gain / Income category" />
            </SelectTrigger>
            <SelectContent>
              {incomeCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleReconcileAndArchive}
          disabled={isSubmitting || isMutating || !reconcileCategoryId}
          className="mt-1 self-start text-xs"
        >
          <Sparkles className="mr-1.5 size-3.5" />
          {isSubmitting
            ? "Reconciling..."
            : `Reconcile Gain (+${formatMoney(Math.abs(balance), debtCurrency)}) & Archive`}
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-card border-purple-500/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Scale className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{debtAccount.name}</CardTitle>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal uppercase">
                  {debtCurrency}
                </Badge>
                {renderStatusBadge()}
              </div>
              <CardDescription className="text-xs">
                Throwaway Clearing Ledger • Live balance:{" "}
                <span
                  className={cn(
                    "font-semibold",
                    balance > 0 && "text-blue-600 dark:text-blue-400",
                    balance < 0 && "text-amber-600 dark:text-amber-400",
                    isZeroBalance && "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {formatMoney(balance, debtCurrency)}
                </span>
              </CardDescription>
            </div>
          </div>

          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground size-7 self-start sm:self-center"
              aria-label="Close Clearing Ledger"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-8 w-full grid-cols-4 p-0.5">
            <TabsTrigger value="outflow" className="gap-1.5 text-xs">
              <ArrowUpRight className="size-3.5" />
              <span>Outflow</span>
            </TabsTrigger>
            <TabsTrigger value="fee" className="gap-1.5 text-xs">
              <Percent className="size-3.5" />
              <span>Fee</span>
            </TabsTrigger>
            <TabsTrigger value="settle" className="gap-1.5 text-xs">
              <ArrowDownLeft className="size-3.5" />
              <span>Settle</span>
            </TabsTrigger>
            <TabsTrigger value="reconcile" className="gap-1.5 text-xs">
              <Archive className="size-3.5" />
              <span>Reconcile</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Outflow */}
          <TabsContent value="outflow" className="pt-3">
            <form onSubmit={handleOutflowSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Source Account (I paid from)</Label>
                  <Select value={outflowSourceId} onValueChange={setOutflowSourceId} disabled={isSubmitting}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select payment account" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          {acc.name} ({acc.currencyId ?? defaultCurrency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    Paid Amount ({outflowSourceAccount?.currencyId ?? defaultCurrency})
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={outflowSourceAmount}
                    onChange={(e) => handleOutflowSourceAmountChange(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Debt Inflow Amount ({debtCurrency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={outflowDestAmount}
                    onChange={(e) => setOutflowDestAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-[11px]">
                    Auto-converted using ExternalProvider exchange rate; editable.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Comment (optional)</Label>
                  <Input
                    placeholder="e.g. Flight tickets / monitor purchase"
                    value={outflowComment}
                    onChange={(e) => setOutflowComment(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isMutating || !outflowSourceAmount}
                className="mt-1 self-end text-xs"
              >
                <ArrowUpRight className="mr-1 size-3.5" />
                {isSubmitting ? "Recording..." : "Record Outflow"}
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: Fee */}
          <TabsContent value="fee" className="pt-3">
            <form onSubmit={handleFeeSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Payment Account</Label>
                  <Select value={feeSourceId} onValueChange={setFeeSourceId} disabled={isSubmitting}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select payment account" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          {acc.name} ({acc.currencyId ?? defaultCurrency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Who Absorbs Fee?</Label>
                  <div className="flex gap-1.5 pt-0.5">
                    <Button
                      type="button"
                      size="xs"
                      variant={feeAbsorbedBy === "debtor" ? "default" : "outline"}
                      onClick={() => setFeeAbsorbedBy("debtor")}
                      className="flex-1 text-xs"
                    >
                      Debtor
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={feeAbsorbedBy === "me" ? "default" : "outline"}
                      onClick={() => setFeeAbsorbedBy("me")}
                      className="flex-1 text-xs"
                    >
                      I absorb
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    Fee Amount ({feeSourceAccount?.currencyId ?? defaultCurrency})
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={feeAmount}
                    onChange={(e) => handleFeeAmountChange(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {feeAbsorbedBy === "debtor" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Added to Debt ({debtCurrency})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={feeConvertedAmount}
                      onChange={(e) => setFeeConvertedAmount(e.target.value)}
                      disabled={isSubmitting}
                      className="h-8 text-xs"
                    />
                    <span className="text-muted-foreground text-[11px]">
                      Increases receivable balance of {debtAccount.name}.
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Comment</Label>
                    <Input
                      placeholder="e.g. Bank wire fee"
                      value={feeComment}
                      onChange={(e) => setFeeComment(e.target.value)}
                      disabled={isSubmitting}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Fee Expense Category</Label>
                    <Select value={feeExpenseCatId} onValueChange={setFeeExpenseCatId} disabled={isSubmitting}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="Select fee category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="text-xs">
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-[11px]">
                      Recorded as your personal expense; debt balance unchanged.
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">Comment</Label>
                    <Input
                      placeholder="e.g. Commission fee absorbed"
                      value={feeComment}
                      onChange={(e) => setFeeComment(e.target.value)}
                      disabled={isSubmitting}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isMutating || !feeAmount}
                className="mt-1 self-end text-xs"
              >
                <Percent className="mr-1 size-3.5" />
                {isSubmitting ? "Recording..." : "Record Fee"}
              </Button>
            </form>
          </TabsContent>

          {/* TAB 3: Settle */}
          <TabsContent value="settle" className="pt-3">
            <form onSubmit={handleSettleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Settlement Pattern</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant={settlementCase === "shared" ? "default" : "outline"}
                    onClick={() => {
                      setSettlementCase("shared");
                      setSettleTargetId(expenseCategories[0]?.id ?? "");
                    }}
                    className="h-7 text-[11px]"
                  >
                    Case A: Shared Expense
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={settlementCase === "service" ? "default" : "outline"}
                    onClick={() => {
                      setSettlementCase("service");
                      setSettleTargetId(expenseCategories[0]?.id ?? "");
                    }}
                    className="h-7 text-[11px]"
                  >
                    Case B: Direct Service
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={settlementCase === "transfer" ? "default" : "outline"}
                    onClick={() => {
                      setSettlementCase("transfer");
                      setSettleTargetId(paymentAccounts[0]?.id ?? "");
                    }}
                    className="h-7 text-[11px]"
                  >
                    Case C: Family / Transfer
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Deducted from Debt ({debtCurrency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={settleDebtAmount}
                    onChange={(e) => handleSettleDebtAmountChange(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-[11px]">
                    Reduces receivable balance of {debtAccount.name}.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    {settlementCase === "transfer" ? "Recipient Account or Family Category" : "Expense Category"}
                  </Label>
                  <Select value={settleTargetId} onValueChange={setSettleTargetId} disabled={isSubmitting}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      {settlementCase === "transfer" ? (
                        <>
                          <SelectGroup>
                            <SelectLabel className="text-xs">Tracked Accounts</SelectLabel>
                            {paymentAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                {acc.name} ({acc.currencyId ?? defaultCurrency})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel className="text-xs">Expense Categories (External recipient)</SelectLabel>
                            {expenseCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      ) : (
                        expenseCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="text-xs">
                            {cat.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    Settled / Recorded Amount ({settleTargetCategory?.currencyId ?? debtCurrency})
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={settleDestAmount}
                    onChange={(e) => setSettleDestAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-[11px]">Pre-filled with exchange rate; editable.</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Comment</Label>
                  <Input
                    placeholder="e.g. Taxi share / Doctor payment"
                    value={settleComment}
                    onChange={(e) => setSettleComment(e.target.value)}
                    disabled={isSubmitting}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isMutating || !settleDebtAmount}
                className="mt-1 self-end text-xs"
              >
                <ArrowDownLeft className="mr-1 size-3.5" />
                {isSubmitting ? "Recording..." : "Record Settlement"}
              </Button>
            </form>
          </TabsContent>

          {/* TAB 4: Reconcile & Archive */}
          <TabsContent value="reconcile" className="flex flex-col gap-3 pt-3">
            {renderReconcileContent()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
