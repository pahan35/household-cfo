"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { ExternalProviderCurrency } from "./external-provider-data";
import { formatThrowawayDebtAccountName } from "./external-provider-data";
import { ExternalProviderIconPicker } from "./external-provider-icon-picker";

interface DebtAccountInitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency?: string;
  currencies?: ExternalProviderCurrency[];
  onSubmit: (input: {
    name: string;
    currencyId: string;
    exceptFromBalance: boolean;
    icon?: string;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
}

const COMMON_CURRENCIES = ["USD", "EUR", "PLN", "UAH"];

export function DebtAccountInitDialog({
  open,
  onOpenChange,
  defaultCurrency = "USD",
  currencies = [],
  onSubmit,
  isSubmitting = false,
}: DebtAccountInitDialogProps) {
  const nameInputId = useId();
  const exceptSwitchId = useId();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [exceptFromBalance, setExceptFromBalance] = useState(true);
  const [icon, setIcon] = useState("debt");

  const availableCurrencies = useMemo(() => {
    const set = new Set(COMMON_CURRENCIES);
    for (const c of currencies) {
      if (c.id) set.add(c.id.toUpperCase());
    }
    return Array.from(set);
  }, [currencies]);

  const formattedPreview = useMemo(() => {
    return name.trim().length > 0 ? formatThrowawayDebtAccountName(name) : "";
  }, [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      currencyId: currency,
      exceptFromBalance,
      icon,
    });

    setName("");
    setIcon("debt");
    setExceptFromBalance(true);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New Debt Account</DialogTitle>
            <DialogDescription>
              Create a native debt account to track purchases, third-party shared expenses, or deal settlements.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={nameInputId} className="text-xs font-medium">
                Person or Deal Name
              </Label>
              <Input
                id={nameInputId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex or Laptop Deal"
                disabled={isSubmitting}
                autoFocus
                className="h-8 text-xs"
              />
              {formattedPreview && (
                <span className="text-muted-foreground text-[11px]">
                  ExternalProvider account name:{" "}
                  <span className="text-foreground font-semibold">{formattedPreview}</span>
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Base Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isSubmitting}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((code) => (
                    <SelectItem key={code} value={code} className="text-xs">
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Account Icon</Label>
              <ExternalProviderIconPicker value={icon} onChange={setIcon} disabled={isSubmitting} className="w-full" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor={exceptSwitchId} className="text-xs font-medium">
                  Exclude from liquid balance
                </Label>
                <p className="text-muted-foreground text-[11px]">
                  When active, this account is not counted towards your total liquid net worth.
                </p>
              </div>
              <Switch
                id={exceptSwitchId}
                checked={exceptFromBalance}
                onCheckedChange={setExceptFromBalance}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || isSubmitting} className="text-xs">
              {isSubmitting ? "Creating..." : "Create Debt Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
