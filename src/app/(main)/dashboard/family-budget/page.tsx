import { format } from "date-fns";
import type { Metadata } from "next";

import { FamilyBudgetDashboard } from "./_components/family-budget-dashboard";

export const metadata: Metadata = {
  title: "Accounts & Transactions | Studio Admin",
  description:
    "Live household accounts, multi-currency liquidity, and all-time transaction review powered by ExternalProvider.",
  alternates: {
    canonical: "/dashboard/family-budget",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Accounts &amp; Transactions</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <FamilyBudgetDashboard />
    </div>
  );
}
