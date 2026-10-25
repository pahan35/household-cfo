import { describe, expect, it } from "vitest";

import { applyBudgetOverviewPeriodToParams, resolveBudgetOverviewPeriodState } from "../budget-overview-period-state";

describe("resolveBudgetOverviewPeriodState", () => {
  it("prefers URL params over localStorage over defaults", () => {
    const stored = JSON.stringify({ month: "2024-01-01", compareMode: "prev_year" });
    expect(resolveBudgetOverviewPeriodState("?month=2025-03-01&compare=prev", stored, "2026-10-01")).toMatchObject({
      month: "2025-03-01",
      compareMode: "prev_month",
    });
    expect(resolveBudgetOverviewPeriodState("", stored, "2026-10-01")).toMatchObject({
      month: "2024-01-01",
      compareMode: "prev_year",
    });
    expect(resolveBudgetOverviewPeriodState("", null, "2026-10-01")).toEqual({
      month: "2026-10-01",
      compareMode: "none",
      compareDate: null,
      traceCategory: null,
    });
  });

  it("ignores invalid values and corrupt storage", () => {
    expect(resolveBudgetOverviewPeriodState("?month=bogus&compare=zzz", "{not json", "2026-10-01")).toMatchObject({
      month: "2026-10-01",
      compareMode: "none",
    });
  });

  it("keeps the custom compare date and trace category", () => {
    const state = resolveBudgetOverviewPeriodState(
      "?month=2025-03-01&compare=custom&compareDate=2023-05-01&traceCategory=abc",
      null,
      "2026-10-01",
    );
    expect(state).toMatchObject({ compareMode: "custom", compareDate: "2023-05-01", traceCategory: "abc" });
  });
});

describe("applyBudgetOverviewPeriodToParams", () => {
  it("round-trips through URL params", () => {
    const params = new URLSearchParams();
    applyBudgetOverviewPeriodToParams(params, {
      month: "2025-03-01",
      compareMode: "prev_year",
      compareDate: null,
      traceCategory: "c1",
    });
    expect(params.toString()).toBe("month=2025-03-01&compare=yoy&traceCategory=c1");
    expect(resolveBudgetOverviewPeriodState(`?${params.toString()}`, null, "x")).toMatchObject({
      compareMode: "prev_year",
      traceCategory: "c1",
    });
  });
});
