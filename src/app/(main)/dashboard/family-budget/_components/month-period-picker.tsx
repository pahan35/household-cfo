"use client";

import { useMemo, useState } from "react";

import { cn } from "cn";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, GitCompare, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { CompareMode } from "./expense-transforms";
import {
  type AvailableMonth,
  type BaselineResolutionResult,
  getNextMonth,
  getPrevMonth,
  MONTH_LABELS,
} from "./yoy-transforms";

export interface MonthPeriodPickerProps {
  activeMonthDateStr: string;
  onActiveMonthChange: (dateStr: string) => void;
  availableMonths: AvailableMonth[];
  compareMode: CompareMode;
  onCompareModeChange: (mode: CompareMode) => void;
  compareCustomDateStr?: string | null;
  onCompareCustomDateChange?: (dateStr: string) => void;
  baselineResolution?: BaselineResolutionResult | null;
}

export function MonthPeriodPicker({
  activeMonthDateStr,
  onActiveMonthChange,
  availableMonths,
  compareMode,
  onCompareModeChange,
  compareCustomDateStr,
  onCompareCustomDateChange,
  baselineResolution,
}: MonthPeriodPickerProps) {
  const [isMainPopoverOpen, setIsMainPopoverOpen] = useState(false);
  const [isCustomPopoverOpen, setIsCustomPopoverOpen] = useState(false);

  // Parse active date to initialize view year
  const activeDate = useMemo(() => {
    try {
      return parseISO(activeMonthDateStr);
    } catch {
      return new Date();
    }
  }, [activeMonthDateStr]);

  const [viewYear, setViewYear] = useState<number>(() => activeDate.getFullYear());
  const [customViewYear, setCustomViewYear] = useState<number>(() => {
    if (compareCustomDateStr) {
      try {
        return parseISO(compareCustomDateStr).getFullYear();
      } catch {
        return activeDate.getFullYear();
      }
    }
    return activeDate.getFullYear();
  });

  // Calculate available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const m of availableMonths) {
      years.add(m.year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [availableMonths]);

  // Stepper calculations
  const prevMonth = useMemo(
    () => getPrevMonth(activeMonthDateStr, availableMonths),
    [activeMonthDateStr, availableMonths],
  );
  const nextMonth = useMemo(
    () => getNextMonth(activeMonthDateStr, availableMonths),
    [activeMonthDateStr, availableMonths],
  );

  const activeMonthLabel = useMemo(() => {
    const found = availableMonths.find((m) => m.dateStr === activeMonthDateStr);
    if (found) return found.label;
    const mIdx = activeDate.getMonth();
    const y = activeDate.getFullYear();
    return `${MONTH_LABELS[mIdx]} ${y}`;
  }, [availableMonths, activeMonthDateStr, activeDate]);

  // Quick preset targets
  const currentMonthDateStr = useMemo(() => {
    return format(startOfMonth(new Date()), "yyyy-MM-dd");
  }, []);

  const previousMonthDateStr = useMemo(() => {
    return format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Month Steppers & Main Popover */}
      <div className="bg-muted/40 flex items-center rounded-lg border p-0.5 text-xs shadow-xs">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={!prevMonth}
          onClick={() => {
            if (prevMonth) {
              onActiveMonthChange(prevMonth.dateStr);
              setViewYear(prevMonth.year);
            }
          }}
          aria-label="Previous month"
          className="text-muted-foreground hover:text-foreground h-7 w-7 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        <Popover open={isMainPopoverOpen} onOpenChange={setIsMainPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hover:bg-background/80 hover:text-foreground h-7 gap-1.5 px-2.5 text-xs font-semibold"
              aria-label="Select month and year"
            >
              <CalendarIcon className="text-muted-foreground size-3.5" />
              <span>{activeMonthLabel}</span>
              <ChevronDown className="text-muted-foreground size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-64 p-3 text-xs" sideOffset={6}>
            {/* Quick shortcuts */}
            <div className="grid grid-cols-2 gap-1.5 border-b pb-2.5">
              <Button
                type="button"
                variant={activeMonthDateStr === currentMonthDateStr ? "secondary" : "outline"}
                size="xs"
                className="h-7 text-[11px]"
                onClick={() => {
                  onActiveMonthChange(currentMonthDateStr);
                  setViewYear(new Date().getFullYear());
                  setIsMainPopoverOpen(false);
                }}
              >
                Current Month
              </Button>
              <Button
                type="button"
                variant={activeMonthDateStr === previousMonthDateStr ? "secondary" : "outline"}
                size="xs"
                className="h-7 text-[11px]"
                onClick={() => {
                  onActiveMonthChange(previousMonthDateStr);
                  setViewYear(subMonths(new Date(), 1).getFullYear());
                  setIsMainPopoverOpen(false);
                }}
              >
                Previous Month
              </Button>
            </div>

            {/* Year selector bar */}
            <div className="flex items-center justify-between pt-2 pb-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6"
                aria-label="Previous year"
                onClick={() => setViewYear((y) => y - 1)}
              >
                <ChevronLeft className="size-3" />
              </Button>
              <span className="font-semibold">{viewYear}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-6 w-6"
                aria-label="Next year"
                onClick={() => setViewYear((y) => y + 1)}
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>

            {/* 12-month grid */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {MONTH_LABELS.map((monthName, idx) => {
                const targetDateStr = `${viewYear}-${String(idx + 1).padStart(2, "0")}-01`;
                const isAvailable = availableMonths.some((m) => m.dateStr === targetDateStr);
                const isSelected = activeMonthDateStr === targetDateStr;

                return (
                  <Button
                    key={monthName}
                    type="button"
                    variant={isSelected ? "default" : isAvailable ? "ghost" : "ghost"}
                    size="xs"
                    disabled={!isAvailable}
                    className={cn(
                      "h-7 text-[11px] font-medium",
                      isSelected && "font-semibold",
                      !isAvailable && "text-muted-foreground/40 cursor-not-allowed opacity-40",
                    )}
                    onClick={() => {
                      onActiveMonthChange(targetDateStr);
                      setIsMainPopoverOpen(false);
                    }}
                  >
                    {monthName}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={!nextMonth}
          onClick={() => {
            if (nextMonth) {
              onActiveMonthChange(nextMonth.dateStr);
              setViewYear(nextMonth.year);
            }
          }}
          aria-label="Next month"
          className="text-muted-foreground hover:text-foreground h-7 w-7 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Compare vs Selector */}
      <div className="flex items-center gap-1.5">
        <Select value={compareMode} onValueChange={(val) => onCompareModeChange(val as CompareMode)}>
          <SelectTrigger size="sm" className="h-8 gap-1.5 text-xs">
            <GitCompare className="text-muted-foreground size-3.5" />
            <SelectValue placeholder="Compare vs" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="none" className="text-xs">
              Compare: Off
            </SelectItem>
            <SelectItem value="prev_month" className="text-xs">
              vs Previous Month
            </SelectItem>
            <SelectItem value="prev_year" className="text-xs">
              vs Same Month Last Year
            </SelectItem>
            <SelectItem value="custom" className="text-xs">
              vs Custom Month...
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Custom Month Popover Trigger (only when mode is 'custom') */}
        {compareMode === "custom" && (
          <Popover open={isCustomPopoverOpen} onOpenChange={setIsCustomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs font-medium">
                <CalendarIcon className="text-muted-foreground size-3.5" />
                <span>
                  {compareCustomDateStr
                    ? (availableMonths.find((m) => m.dateStr === compareCustomDateStr)?.label ?? compareCustomDateStr)
                    : "Pick Baseline"}
                </span>
                <ChevronDown className="text-muted-foreground size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 text-xs" sideOffset={6}>
              <div className="text-muted-foreground border-b pb-1.5 text-[11px] font-medium">
                Select Custom Baseline Month
              </div>
              <div className="flex items-center justify-between pt-2 pb-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6"
                  aria-label="Previous year"
                  onClick={() => setCustomViewYear((y) => y - 1)}
                >
                  <ChevronLeft className="size-3" />
                </Button>
                <span className="font-semibold">{customViewYear}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6"
                  aria-label="Next year"
                  onClick={() => setCustomViewYear((y) => y + 1)}
                >
                  <ChevronRight className="size-3" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {MONTH_LABELS.map((monthName, idx) => {
                  const targetDateStr = `${customViewYear}-${String(idx + 1).padStart(2, "0")}-01`;
                  const isAvailable = availableMonths.some((m) => m.dateStr === targetDateStr);
                  const isSelected = compareCustomDateStr === targetDateStr;

                  return (
                    <Button
                      key={monthName}
                      type="button"
                      variant={isSelected ? "default" : "ghost"}
                      size="xs"
                      disabled={!isAvailable}
                      className={cn(
                        "h-7 text-[11px] font-medium",
                        isSelected && "font-semibold",
                        !isAvailable && "text-muted-foreground/40 cursor-not-allowed opacity-40",
                      )}
                      onClick={() => {
                        onCompareCustomDateChange?.(targetDateStr);
                        setIsCustomPopoverOpen(false);
                      }}
                    >
                      {monthName}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Baseline Status / Quick Clear Badge */}
        {compareMode !== "none" && baselineResolution && (
          <div className="flex items-center gap-1">
            {baselineResolution.hasData ? (
              <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px] font-normal">
                <span>vs {baselineResolution.label}</span>
                <button
                  type="button"
                  aria-label="Disable comparison"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => onCompareModeChange("none")}
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ) : (
              <Badge variant="outline" className="border-destructive/30 text-destructive gap-1 px-2 py-0.5 text-[11px]">
                <span>No data for {baselineResolution.label}</span>
                <button
                  type="button"
                  aria-label="Disable comparison"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => onCompareModeChange("none")}
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
