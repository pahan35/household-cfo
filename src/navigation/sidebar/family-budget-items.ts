import {
  ArrowLeftRight,
  Banknote,
  Compass,
  GraduationCap,
  HeartPulse,
  Home,
  Hourglass,
  Palmtree,
  PiggyBank,
  Scale,
  Tags,
  Timer,
  Wallet,
} from "lucide-react";

import type { NavGroup } from "./sidebar-items";

export const familyBudgetNavGroup: NavGroup = {
  id: 1,
  label: "Family Budget",
  items: [
    {
      id: "family-budget-accounts",
      title: "Accounts & Transactions",
      url: "/dashboard/family-budget",
      icon: Wallet,
    },
    {
      id: "family-budget-overview",
      title: "Budget Overview",
      url: "/dashboard/family-budget/budget-overview",
      icon: PiggyBank,
    },
    {
      id: "family-budget-income",
      title: "Income & Taxes",
      url: "/dashboard/family-budget/income",
      icon: Banknote,
    },
    {
      id: "family-budget-offer-comparator",
      title: "Offer Comparator",
      url: "/dashboard/family-budget/offer-comparator",
      icon: Scale,
    },
    {
      id: "family-budget-runway",
      title: "Runway Simulator",
      url: "/dashboard/family-budget/runway",
      icon: Hourglass,
    },
    {
      id: "family-budget-mortgage",
      title: "Mortgage & Home Goal",
      url: "/dashboard/family-budget/mortgage",
      icon: Home,
    },
    {
      id: "family-budget-fx-inflation",
      title: "FX & Inflation",
      url: "/dashboard/family-budget/fx-inflation",
      icon: ArrowLeftRight,
    },
    {
      id: "family-budget-lifestyle",
      title: "Lifestyle & Tags",
      icon: Compass,
      subItems: [
        {
          id: "family-budget-lifestyle-explorer",
          title: "Tag & Category Explorer",
          url: "/dashboard/family-budget/lifestyle",
          icon: Tags,
        },
        {
          id: "family-budget-lifestyle-trips",
          title: "Trips & Concerts",
          url: "/dashboard/family-budget/lifestyle/trips-concerts",
          icon: Palmtree,
        },
        {
          id: "family-budget-lifestyle-health",
          title: "Health & Sport",
          url: "/dashboard/family-budget/lifestyle/health-sport",
          icon: HeartPulse,
        },
        {
          id: "family-budget-lifestyle-learning",
          title: "Learning",
          url: "/dashboard/family-budget/lifestyle/learning",
          icon: GraduationCap,
        },
        {
          id: "family-budget-lifestyle-time-value",
          title: "Time & Opportunity",
          url: "/dashboard/family-budget/lifestyle/time-value",
          icon: Timer,
        },
      ],
    },
  ],
};
