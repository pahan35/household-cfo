import packageJson from "../../package.json";
import { isFocusedMode } from "./app-mode";

const currentYear = new Date().getFullYear();
const focused = isFocusedMode();

export const APP_CONFIG = {
  name: focused ? "Family Budget" : "Studio Admin",
  url: "https://family-budget.example.com",
  repository: "https://github.com/arhamkhnz/next-shadcn-admin-dashboard",
  version: packageJson.version,
  copyright: `© ${currentYear}, ${focused ? "Family Budget" : "Studio Admin"}.`,
  meta: {
    title: focused ? "Family Budget" : "Studio Admin: Open Source shadcn/ui Admin Dashboard",
    description: focused
      ? "Private family budget, spending analytics, and runway planning dashboard."
      : "Free, MIT-licensed shadcn/ui admin dashboard with 25+ screens and editions for Radix UI, Base UI, React Aria, and TanStack Start.",
  },
};
