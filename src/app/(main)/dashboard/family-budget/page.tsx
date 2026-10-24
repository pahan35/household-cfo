import { format } from "date-fns";
import type { Metadata } from "next";

import { FamilyBudgetDashboard } from "./_components/family-budget-dashboard";

export const metadata: Metadata = {
  title: "Family Budget | Studio Admin",
  description:
    "Live household budget overview powered by ExternalProvider with accounts, category spending limits, and recent transactions.",
  alternates: {
    canonical: "/dashboard/family-budget",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Family Budget</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <FamilyBudgetDashboard />
    </div>
  );
}
