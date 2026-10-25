import { format } from "date-fns";
import type { Metadata } from "next";

import { OfferComparatorDashboard } from "./_components/offer-comparator-dashboard";

export const metadata: Metadata = {
  title: "Job Offer & Compensation Comparator | Studio Admin",
  description:
    "Job offer normalization, B2B/UoP multi-year tax projections, ExternalProvider benefit ceilings, restructure diffs, and reverse recruiter quick-quotes.",
  alternates: {
    canonical: "/dashboard/family-budget/offer-comparator",
  },
};

export default function OfferComparatorPage() {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Offer Comparator</h1>
        <p className="text-muted-foreground text-sm">
          {formattedDate} • Compensation Normalization &amp; Career Archive
        </p>
      </div>

      <OfferComparatorDashboard />
    </div>
  );
}
