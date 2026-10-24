import type { Metadata } from "next";

import { TripsConcertsDashboard } from "./trips-concerts-dashboard";

export const metadata: Metadata = {
  title: "Trips & Concerts | Family Budget",
  description:
    "Episode-based travel detection, pre-booking attribution, untagged date-window candidate discovery, and concert costing.",
};

export default function TripsConcertsPage() {
  return <TripsConcertsDashboard />;
}
