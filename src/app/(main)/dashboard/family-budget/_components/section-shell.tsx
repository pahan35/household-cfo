"use client";

import type { ReactNode } from "react";

import { cn } from "cn";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export interface SectionShellProps {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  skeletonCount?: number;
  skeletonHeight?: string;
  children?: ReactNode;
  className?: string;
}

export function SectionShell({
  title,
  description,
  action,
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyTitle = "No data found",
  emptyDescription,
  emptyIcon,
  skeletonCount = 3,
  skeletonHeight = "h-10",
  children,
  className,
}: SectionShellProps) {
  const errorMessage = typeof error === "string" ? error : error?.message;

  function renderContent() {
    if (isLoading) {
      const skeletonKeys = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6"].slice(0, skeletonCount);
      return (
        <div className="flex flex-col gap-3 py-2">
          {skeletonKeys.map((key) => (
            <Skeleton key={key} className={cn("w-full", skeletonHeight)} />
          ))}
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>Failed to load section data</span>
          </div>
          <p className="max-w-md text-muted-foreground text-xs">{errorMessage}</p>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="mt-2 gap-1.5">
              <RotateCcw className="size-3.5" />
              <span>Retry</span>
            </Button>
          )}
        </div>
      );
    }

    if (isEmpty) {
      return (
        <Empty className="py-8">
          <EmptyMedia variant="icon">
            {emptyIcon ?? <AlertCircle className="size-4 text-muted-foreground" />}
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      );
    }

    return children;
  }

  return (
    <Card className={cn("flex flex-col justify-between", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>

      <CardContent className="flex-1">{renderContent()}</CardContent>
    </Card>
  );
}
