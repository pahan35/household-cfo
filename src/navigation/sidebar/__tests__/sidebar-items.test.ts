import { describe, expect, it } from "vitest";

import { familyBudgetNavGroup } from "../family-budget-items";
import { getSidebarItems, sidebarItems, templateSidebarItems } from "../sidebar-items";

describe("sidebar-items", () => {
  it("exports familyBudgetNavGroup with all expected budget routes", () => {
    expect(familyBudgetNavGroup.label).toBe("Family Budget");
    const urls = familyBudgetNavGroup.items.flatMap((item) =>
      item.subItems ? item.subItems.map((sub) => sub.url) : [item.url],
    );
    expect(urls).toContain("/dashboard/family-budget");
    expect(urls).toContain("/dashboard/family-budget/budget-overview");
    expect(urls).toContain("/dashboard/family-budget/income");
    expect(urls).toContain("/dashboard/family-budget/offer-comparator");
    expect(urls).toContain("/dashboard/family-budget/runway");
    expect(urls).toContain("/dashboard/family-budget/mortgage");
    expect(urls).toContain("/dashboard/family-budget/fx-inflation");
    expect(urls).toContain("/dashboard/family-budget/lifestyle");
    expect(urls).toContain("/dashboard/family-budget/lifestyle/trips-concerts");
  });

  it("returns only familyBudgetNavGroup in focused mode", () => {
    const focusedItems = getSidebarItems({
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);

    expect(focusedItems).toHaveLength(1);
    expect(focusedItems[0]).toBe(familyBudgetNavGroup);
    expect(focusedItems[0].label).toBe("Family Budget");
  });

  it("returns both family budget and template items in full mode", () => {
    const fullItems = getSidebarItems({
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);

    expect(fullItems.length).toBeGreaterThan(1);
    expect(fullItems[0]).toBe(familyBudgetNavGroup);
    expect(fullItems.slice(1)).toEqual(templateSidebarItems);

    const labels = fullItems.map((group) => group.label);
    expect(labels).toContain("Family Budget");
    expect(labels).toContain("Dashboards");
    expect(labels).toContain("Pages");
  });

  it("honors NEXT_PUBLIC_APP_MODE override", () => {
    const forcedFocused = getSidebarItems({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_MODE: "focused",
    } as NodeJS.ProcessEnv);
    expect(forcedFocused).toHaveLength(1);

    const forcedFull = getSidebarItems({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PUBLIC_APP_MODE: "full",
    } as NodeJS.ProcessEnv);
    expect(forcedFull.length).toBeGreaterThan(1);
    expect(forcedFull[0]).toBe(familyBudgetNavGroup);
  });

  it("honors global process.env.NEXT_PUBLIC_APP_MODE when called without arguments", () => {
    const originalMode = process.env.NEXT_PUBLIC_APP_MODE;
    try {
      process.env.NEXT_PUBLIC_APP_MODE = "focused";
      const focusedItems = getSidebarItems();
      expect(focusedItems).toHaveLength(1);
      expect(focusedItems[0]).toBe(familyBudgetNavGroup);

      process.env.NEXT_PUBLIC_APP_MODE = "full";
      const fullItems = getSidebarItems();
      expect(fullItems.length).toBeGreaterThan(1);
      expect(fullItems[0]).toBe(familyBudgetNavGroup);
    } finally {
      process.env.NEXT_PUBLIC_APP_MODE = originalMode;
    }
  });

  it("exports sidebarItems as an array of NavGroup", () => {
    expect(Array.isArray(sidebarItems)).toBe(true);
    expect(sidebarItems.length).toBeGreaterThanOrEqual(1);
    expect(sidebarItems[0].label).toBe("Family Budget");
  });
});
