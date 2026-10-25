"use client";

import { cn } from "cn";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { Calendar, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DateRangePreset = "this-month" | "last-month" | "this-year" | "all-time";

export interface DateRangePeriod {
  from?: string | null;
  to?: string | null;
}

/**
 * Calculates start and end dates for a given preset relative to a reference date.
 */
export function getPresetDateRange(preset: DateRangePreset, referenceDate: Date = new Date()): DateRangePeriod {
  switch (preset) {
    case "this-month":
      return {
        from: format(startOfMonth(referenceDate), "yyyy-MM-dd"),
        to: format(endOfMonth(referenceDate), "yyyy-MM-dd"),
      };
    case "last-month": {
      const prev = subMonths(referenceDate, 1);
      return {
        from: format(startOfMonth(prev), "yyyy-MM-dd"),
        to: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    case "this-year":
      return {
        from: format(startOfYear(referenceDate), "yyyy-MM-dd"),
        to: format(endOfYear(referenceDate), "yyyy-MM-dd"),
      };
    case "all-time":
      return {
        from: null,
        to: null,
      };
  }
}

/**
 * Checks if a given preset exactly matches the current active date range.
 */
export function isPresetActive(
  range: DateRangePeriod | undefined,
  preset: DateRangePreset,
  referenceDate: Date = new Date(),
): boolean {
  if (!range) return preset === "all-time";

  const expected = getPresetDateRange(preset, referenceDate);
  const fromMatches = (range.from ?? null) === expected.from;
  const toMatches = (range.to ?? null) === expected.to;

  return fromMatches && toMatches;
}

/**
 * Checks whether any date filter boundary is active.
 */
export function hasActiveDateFilter(range: DateRangePeriod | undefined): boolean {
  return Boolean(range?.from) || Boolean(range?.to);
}

/**
 * Formats an active date range for human-readable display.
 */
export function formatDateRangeDisplay(range: DateRangePeriod | undefined): string | null {
  if (!range || (!range.from && !range.to)) return null;
  if (range.from && range.to) {
    return `${range.from} – ${range.to}`;
  }
  if (range.from) {
    return `From ${range.from}`;
  }
  return `Until ${range.to}`;
}

export interface TransactionDateRangeFilterProps {
  value?: DateRangePeriod;
  onChange: (nextRange: DateRangePeriod) => void;
  className?: string;
}

export function TransactionDateRangeFilter({ value, onChange, className }: TransactionDateRangeFilterProps) {
  const activeLabel = formatDateRangeDisplay(value);
  const isFiltered = hasActiveDateFilter(value);

  const handleApplyPreset = (preset: DateRangePreset) => {
    onChange(getPresetDateRange(preset));
  };

  const handleClear = () => {
    onChange({ from: null, to: null });
  };

  const handleFromChange = (newFrom: string) => {
    onChange({
      from: newFrom || null,
      to: value?.to ?? null,
    });
  };

  const handleToChange = (newTo: string) => {
    onChange({
      from: value?.from ?? null,
      to: newTo || null,
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2.5 text-xs", className)}>
      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="xs"
          variant={isPresetActive(value, "this-month") ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-2 text-[11px]",
            isPresetActive(value, "this-month") && "font-semibold shadow-xs ring-1 ring-border",
          )}
          onClick={() => handleApplyPreset("this-month")}
        >
          This Month
        </Button>
        <Button
          type="button"
          size="xs"
          variant={isPresetActive(value, "last-month") ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-2 text-[11px]",
            isPresetActive(value, "last-month") && "font-semibold shadow-xs ring-1 ring-border",
          )}
          onClick={() => handleApplyPreset("last-month")}
        >
          Last Month
        </Button>
        <Button
          type="button"
          size="xs"
          variant={isPresetActive(value, "this-year") ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-2 text-[11px]",
            isPresetActive(value, "this-year") && "font-semibold shadow-xs ring-1 ring-border",
          )}
          onClick={() => handleApplyPreset("this-year")}
        >
          This Year
        </Button>
        <Button
          type="button"
          size="xs"
          variant={isPresetActive(value, "all-time") ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-2 text-[11px]",
            isPresetActive(value, "all-time") && "font-semibold shadow-xs ring-1 ring-border",
          )}
          onClick={() => handleApplyPreset("all-time")}
        >
          All Time
        </Button>
      </div>

      {/* Date inputs and Active Badge */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor="tx-filter-from" className="text-[11px] text-muted-foreground">
            From:
          </label>
          <Input
            id="tx-filter-from"
            type="date"
            value={value?.from ?? ""}
            onChange={(e) => handleFromChange(e.target.value)}
            className="h-7 w-[125px] px-2 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor="tx-filter-to" className="text-[11px] text-muted-foreground">
            To:
          </label>
          <Input
            id="tx-filter-to"
            type="date"
            value={value?.to ?? ""}
            onChange={(e) => handleToChange(e.target.value)}
            className="h-7 w-[125px] px-2 text-xs"
          />
        </div>

        {isFiltered && (
          <Badge variant="secondary" className="inline-flex h-7 items-center gap-1 px-2 font-normal text-[11px]">
            <Calendar className="size-3 text-muted-foreground" />
            <span className="tabular-nums">{activeLabel}</span>
            <button
              type="button"
              aria-label="Clear date range filter"
              onClick={handleClear}
              className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </Badge>
        )}
      </div>
    </div>
  );
}
