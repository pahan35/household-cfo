import { format } from "date-fns";
import type { Metadata } from "next";

import { MortgageDashboard } from "./_components/mortgage-dashboard";

export const metadata: Metadata = {
  title: "Mortgage & Home Goal Simulator | Studio Admin",
  description: "Polish primary market apartment acquisition, ExternalProvider goal tracking, and overlap cashflow simulator.",
  alternates: {
    canonical: "/dashboard/family-budget/mortgage",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Mortgage & Home Goal Simulator</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <MortgageDashboard />
    </div>
  );
}
