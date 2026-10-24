import type { ReactNode } from "react";

import type { Metadata } from "next";

import { LifestyleLayoutClient } from "./lifestyle-layout-client";

export const metadata: Metadata = {
  title: "Lifestyle & Tags | Family Budget",
  description:
    "Mobile-style category-to-tag drill-down statistics, travel and concert costing, wellness cadence, and learning analytics.",
  alternates: {
    canonical: "/dashboard/family-budget/lifestyle",
  },
};

export default function LifestyleLayout({ children }: { children: ReactNode }) {
  return <LifestyleLayoutClient>{children}</LifestyleLayoutClient>;
}
