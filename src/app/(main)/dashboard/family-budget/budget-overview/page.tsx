import { format } from "date-fns";
import type { Metadata } from "next";

import { BudgetOverviewDashboard } from "../_components/budget-overview-dashboard";

export const metadata: Metadata = {
  title: "Budget Overview | Studio Admin",
  description:
    "Period-based household budget overview: net income, controllable expenses, trends, and category limits powered by ExternalProvider.",
  alternates: {
    canonical: "/dashboard/family-budget/budget-overview",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Budget Overview</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <BudgetOverviewDashboard />
    </div>
  );
}
