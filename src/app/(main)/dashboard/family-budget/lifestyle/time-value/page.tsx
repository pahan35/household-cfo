import type { Metadata } from "next";

import { TimeValueDashboard } from "./_components/time-value-dashboard";

export const metadata: Metadata = {
  title: "Time & Opportunity Motivator | Family Budget",
  description:
    "Dual-player Joy vs. Drift screen time reflection, partner care recognition, side hustles, pet projects, and goal acceleration.",
};

export default function TimeValuePage() {
  return <TimeValueDashboard />;
}
