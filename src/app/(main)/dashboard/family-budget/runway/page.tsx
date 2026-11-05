import { format } from "date-fns";
import type { Metadata } from "next";

import { RunwayDashboard } from "./_components/runway-dashboard";

export const metadata: Metadata = {
  title: "Runway Simulator | Studio Admin",
  description: "Polish B2B JDG zero-revenue runway and living austerity depletion simulator.",
  alternates: {
    canonical: "/dashboard/family-budget/runway",
  },
};

export default function Page() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Runway & Income Loss Simulator</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <RunwayDashboard />
    </div>
  );
}
