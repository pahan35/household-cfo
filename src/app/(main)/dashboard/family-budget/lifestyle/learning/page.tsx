import type { Metadata } from "next";

import { LearningDashboard } from "./learning-dashboard";

export const metadata: Metadata = {
  title: "Learning | Family Budget",
  description:
    "Foundational learning facets (#platform, #cert, #course, #tutor, #books) and recurring subscription run-rate metrics.",
};

export default function LearningPage() {
  return <LearningDashboard />;
}
