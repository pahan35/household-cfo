import { format } from "date-fns";
import type { Metadata } from "next";

import { IncomeDashboard } from "../_components/income-dashboard";

export const metadata: Metadata = {
  title: "Income & Taxes | Studio Admin",
  description:
    "Income source lifecycle management, tag-based multi-currency tax breakdown, audit, and net disposable income analytics.",
  alternates: {
    canonical: "/dashboard/family-budget/income",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Income &amp; Taxes</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <IncomeDashboard />
    </div>
  );
}
