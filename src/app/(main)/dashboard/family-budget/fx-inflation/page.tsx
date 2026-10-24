import { format } from "date-fns";
import type { Metadata } from "next";

import { FxInflationDashboard } from "../_components/fx-inflation-dashboard";

export const metadata: Metadata = {
  title: "FX & Inflation Analysis | Studio Admin",
  description:
    "Macroeconomic inflation deflation, dual-currency normalization, and forward USD/PLN sensitivity simulations.",
  alternates: {
    canonical: "/dashboard/family-budget/fx-inflation",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">FX & Inflation Analysis</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <FxInflationDashboard />
    </div>
  );
}
