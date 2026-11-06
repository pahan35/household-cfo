import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { familyBudgetNavGroup } from "@/navigation/sidebar/family-budget-items";
import { templateSidebarItems } from "@/navigation/sidebar/sidebar-items";

import { NavMain } from "../nav-main";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/family-budget",
}));

describe("NavMain", () => {
  it("hides Quick Create and renders only family budget items when in focused mode", () => {
    const original = process.env.NEXT_PUBLIC_APP_MODE;
    try {
      process.env.NEXT_PUBLIC_APP_MODE = "focused";

      const html = renderToString(
        <TooltipProvider>
          <SidebarProvider>
            <NavMain items={[familyBudgetNavGroup]} />
          </SidebarProvider>
        </TooltipProvider>,
      );

      expect(html).toContain("Family Budget");
      expect(html).toContain("Accounts &amp; Transactions");
      expect(html).not.toContain("Quick Create");
      expect(html).not.toContain("Dashboards");
    } finally {
      process.env.NEXT_PUBLIC_APP_MODE = original;
    }
  });

  it("shows Quick Create and template items when in full mode", () => {
    const original = process.env.NEXT_PUBLIC_APP_MODE;
    try {
      process.env.NEXT_PUBLIC_APP_MODE = "full";

      const html = renderToString(
        <TooltipProvider>
          <SidebarProvider>
            <NavMain items={[familyBudgetNavGroup, ...templateSidebarItems]} />
          </SidebarProvider>
        </TooltipProvider>,
      );

      expect(html).toContain("Family Budget");
      expect(html).toContain("Quick Create");
      expect(html).toContain("Dashboards");
    } finally {
      process.env.NEXT_PUBLIC_APP_MODE = original;
    }
  });
});
