import type { Metadata } from "next";

import { HealthSportDashboard } from "./health-sport-dashboard";

export const metadata: Metadata = {
  title: "Health & Sport | Family Budget",
  description:
    "Multi-currency wellness unification, Pilates 10x pass multiplier, session cadence, and inline pass audit queue.",
};

export default function HealthSportPage() {
  return <HealthSportDashboard />;
}
