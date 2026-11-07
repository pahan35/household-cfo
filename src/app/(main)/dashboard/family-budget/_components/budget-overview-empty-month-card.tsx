"use client";

import { useMemo } from "react";

import { format, isValid, parseISO } from "date-fns";
import { ArrowRight, CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export interface BudgetOverviewEmptyMonthCardProps {
  activeMonthDateStr: string;
  latestActiveMonth?: { dateStr: string; label: string } | null;
  onSelectMonth?: (dateStr: string) => void;
}

export function BudgetOverviewEmptyMonthCard({
  activeMonthDateStr,
  latestActiveMonth,
  onSelectMonth,
}: BudgetOverviewEmptyMonthCardProps) {
  const monthDisplay = useMemo(() => {
    const parsed = parseISO(activeMonthDateStr);
    if (isValid(parsed)) {
      return format(parsed, "MMMM yyyy");
    }
    return activeMonthDateStr;
  }, [activeMonthDateStr]);

  return (
    <Card className="border-border/60 bg-card/60 border shadow-xs">
      <CardContent className="py-12">
        <Empty className="py-4">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-xl bg-muted/60 text-muted-foreground">
              <CalendarX2 className="size-6" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-semibold">No recorded activity for {monthDisplay}</EmptyTitle>
            <EmptyDescription className="max-w-md text-xs text-muted-foreground">
              This calendar period contains no recorded budget statistics or transaction records. Stale data from
              previous months is hidden to prevent misleading budget totals.
            </EmptyDescription>
          </EmptyHeader>

          {latestActiveMonth && onSelectMonth && (
            <EmptyContent className="mt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => onSelectMonth(latestActiveMonth.dateStr)}
              >
                <span>Switch to {latestActiveMonth.label}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </EmptyContent>
          )}
        </Empty>
      </CardContent>
    </Card>
  );
}
