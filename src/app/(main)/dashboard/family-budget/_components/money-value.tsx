import { cn } from "cn";

import type { ExternalProviderCurrency } from "./external-provider-data";
import { formatMoney, toFxRateToTarget } from "./external-provider-money";

export interface MoneyValueProps {
  amount: number;
  currency: string;
  convertedAmount?: number;
  reportingCurrency?: string;
  currencies?: ExternalProviderCurrency[];
  mode?: "ledger" | "rollup";
  size?: "sm" | "md" | "lg";
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  showApproximationSign?: boolean;
  prefix?: string;
  align?: "left" | "right" | "center";
}

/**
 * Universal dual-currency presentation component for Family Budget.
 *
 * - Ledger Mode (`mode="ledger"`, default):
 *   Line 1 (primary): Native currency amount (e.g., €120.00)
 *   Line 2 (secondary): Converted reporting amount (e.g., ≈ PLN 516.00)
 *   Secondary line is omitted if native currency equals reporting currency.
 *
 * - Rollup Mode (`mode="rollup"`):
 *   Line 1 (primary): Converted reporting amount (e.g., PLN 516.00)
 *   Line 2 (secondary): Native original amount (e.g., orig. €120.00)
 *   Secondary line is omitted if native currency equals reporting currency.
 */
export function MoneyValue({
  amount,
  currency,
  convertedAmount,
  reportingCurrency = "PLN",
  currencies,
  mode = "ledger",
  size = "md",
  className,
  primaryClassName,
  secondaryClassName,
  showApproximationSign = true,
  prefix,
  align = "right",
}: MoneyValueProps) {
  const normCurrency = currency?.trim().toUpperCase() || "PLN";
  const normReporting = reportingCurrency?.trim().toUpperCase() || "PLN";

  const isCrossCurrency = normCurrency !== normReporting;
  const isZeroAmount = Math.abs(amount) < 0.005;
  const showSecondary = isCrossCurrency && !isZeroAmount;

  let effectiveConverted: number | undefined = convertedAmount;
  if (effectiveConverted === undefined && showSecondary && currencies && currencies.length > 0) {
    const rate = toFxRateToTarget(normCurrency, normReporting, currencies);
    effectiveConverted = amount * rate;
  }

  const alignClass =
    align === "left"
      ? "items-start text-left"
      : align === "center"
        ? "items-center text-center"
        : "items-end text-right";

  const primarySizeClass = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  const secondarySizeClass = size === "sm" ? "text-[10px]" : "text-xs";

  if (mode === "rollup") {
    const rollupPrimaryAmount = effectiveConverted ?? amount;
    const rollupPrimaryCurrency = isCrossCurrency ? normReporting : normCurrency;

    return (
      <div className={cn("inline-flex flex-col font-mono leading-tight", alignClass, className)}>
        <span className={cn("font-semibold text-foreground", primarySizeClass, primaryClassName)}>
          {prefix}
          {formatMoney(rollupPrimaryAmount, rollupPrimaryCurrency)}
        </span>
        {showSecondary && (
          <span className={cn("text-muted-foreground", secondarySizeClass, secondaryClassName)}>
            orig. {formatMoney(amount, normCurrency)}
          </span>
        )}
      </div>
    );
  }

  // Ledger mode (default)
  return (
    <div className={cn("inline-flex flex-col font-mono leading-tight", alignClass, className)}>
      <span className={cn("font-semibold text-foreground", primarySizeClass, primaryClassName)}>
        {prefix}
        {formatMoney(amount, normCurrency)}
      </span>
      {showSecondary && effectiveConverted !== undefined && (
        <span className={cn("text-muted-foreground", secondarySizeClass, secondaryClassName)}>
          {showApproximationSign ? "≈ " : ""}
          {formatMoney(effectiveConverted, normReporting)}
        </span>
      )}
    </div>
  );
}
