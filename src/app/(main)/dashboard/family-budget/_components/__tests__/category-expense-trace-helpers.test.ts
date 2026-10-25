import { describe, expect, it } from "vitest";

import { buildLedgerLink, parseLedgerCategoryIds, resolveCategoryIdsForTrace } from "../category-expense-trace-helpers";

describe("buildLedgerLink", () => {
  it("includes every resolved category id and the optional account", () => {
    const ids = resolveCategoryIdsForTrace({
      id: "group",
      name: "Transport & Taxi",
      isSmartGroup: true,
      children: [{ id: "c1" }, { id: "c2" }],
    } as never);
    expect(buildLedgerLink(ids)).toBe("/dashboard/family-budget?categoryId=group,c1,c2");
    expect(buildLedgerLink(ids, "acc 1")).toBe("/dashboard/family-budget?categoryId=group,c1,c2&accountId=acc%201");
  });

  it("falls back to the plain ledger without categories", () => {
    expect(buildLedgerLink([])).toBe("/dashboard/family-budget");
  });
});

describe("parseLedgerCategoryIds", () => {
  it("splits, trims and de-duplicates", () => {
    expect(parseLedgerCategoryIds("a, b,,a")).toEqual(["a", "b"]);
    expect(parseLedgerCategoryIds(null)).toEqual([]);
  });
});
