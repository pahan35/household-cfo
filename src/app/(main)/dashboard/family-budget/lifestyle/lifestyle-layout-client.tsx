"use client";

import { type ReactNode, useTransition } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import { format } from "date-fns";
import { GraduationCap, HeartPulse, Palmtree, RotateCw, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";

import { LifestyleDataProvider, useLifestyleData } from "./use-lifestyle-data";

const LIFESTYLE_NAV_ITEMS = [
  {
    id: "explorer",
    title: "Tag & Category Explorer",
    href: "/dashboard/family-budget/lifestyle",
    icon: Tags,
    exact: true,
  },
  {
    id: "trips-concerts",
    title: "Trips & Concerts",
    href: "/dashboard/family-budget/lifestyle/trips-concerts",
    icon: Palmtree,
    exact: false,
  },
  {
    id: "health-sport",
    title: "Health & Sport",
    href: "/dashboard/family-budget/lifestyle/health-sport",
    icon: HeartPulse,
    exact: false,
  },
  {
    id: "learning",
    title: "Learning",
    href: "/dashboard/family-budget/lifestyle/learning",
    icon: GraduationCap,
    exact: false,
  },
] as const;

function LifestyleHeader() {
  const pathname = usePathname();
  const { isLoading, refresh, transactions } = useLifestyleData();
  const [isRefreshing, startRefresh] = useTransition();

  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      {/* Title & Global Refresh */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl tracking-tight">Lifestyle &amp; Tags</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
              {transactions.length > 0 ? `${transactions.length.toLocaleString()} tx` : "Loading..."}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{formattedDate}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startRefresh(async () => refresh())}
            disabled={isLoading || isRefreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCw className={cn("size-3.5", (isLoading || isRefreshing) && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* In-Page Navigation Bar */}
      <nav aria-label="Lifestyle navigation" className="flex items-center overflow-x-auto border-b pb-2">
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          {LIFESTYLE_NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-xs transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function LifestyleLayoutClient({ children }: { children: ReactNode }) {
  return (
    <LifestyleDataProvider>
      <div className="flex flex-col gap-6">
        <LifestyleHeader />
        <main>{children}</main>
      </div>
    </LifestyleDataProvider>
  );
}
