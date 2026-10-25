import { describe, expect, it } from "vitest";

import {
  formatDateRangeDisplay,
  getPresetDateRange,
  hasActiveDateFilter,
  isPresetActive,
} from "../transaction-date-range-filter";

describe("TransactionDateRangeFilter helpers", () => {
  const refDate = new Date("2024-07-15T12:00:00Z");

  describe("getPresetDateRange", () => {
    it("calculates this-month correctly", () => {
      const range = getPresetDateRange("this-month", refDate);
      expect(range.from).toBe("2024-07-01");
      expect(range.to).toBe("2024-07-31");
    });

    it("calculates last-month correctly across month boundary", () => {
      const range = getPresetDateRange("last-month", refDate);
      expect(range.from).toBe("2024-06-01");
      expect(range.to).toBe("2024-06-30");
    });

    it("calculates this-year correctly", () => {
      const range = getPresetDateRange("this-year", refDate);
      expect(range.from).toBe("2024-01-01");
      expect(range.to).toBe("2024-12-31");
    });

    it("calculates all-time correctly", () => {
      const range = getPresetDateRange("all-time", refDate);
      expect(range.from).toBeNull();
      expect(range.to).toBeNull();
    });
  });

  describe("isPresetActive", () => {
    it("returns true when range matches preset exactly", () => {
      expect(isPresetActive({ from: "2024-07-01", to: "2024-07-31" }, "this-month", refDate)).toBe(true);
      expect(isPresetActive({ from: "2024-06-01", to: "2024-06-30" }, "last-month", refDate)).toBe(true);
      expect(isPresetActive({ from: "2024-01-01", to: "2024-12-31" }, "this-year", refDate)).toBe(true);
      expect(isPresetActive({ from: null, to: null }, "all-time", refDate)).toBe(true);
      expect(isPresetActive(undefined, "all-time", refDate)).toBe(true);
    });

    it("returns false when range does not match preset", () => {
      expect(isPresetActive({ from: "2024-07-01", to: "2024-07-15" }, "this-month", refDate)).toBe(false);
      expect(isPresetActive({ from: "2024-07-01", to: "2024-07-31" }, "last-month", refDate)).toBe(false);
    });
  });

  describe("hasActiveDateFilter", () => {
    it("identifies active vs inactive date filters", () => {
      expect(hasActiveDateFilter(undefined)).toBe(false);
      expect(hasActiveDateFilter({ from: null, to: null })).toBe(false);
      expect(hasActiveDateFilter({ from: "", to: "" })).toBe(false);
      expect(hasActiveDateFilter({ from: "2024-07-01", to: null })).toBe(true);
      expect(hasActiveDateFilter({ from: null, to: "2024-07-31" })).toBe(true);
      expect(hasActiveDateFilter({ from: "2024-07-01", to: "2024-07-31" })).toBe(true);
    });
  });

  describe("formatDateRangeDisplay", () => {
    it("formats range boundaries clearly", () => {
      expect(formatDateRangeDisplay(undefined)).toBeNull();
      expect(formatDateRangeDisplay({ from: null, to: null })).toBeNull();
      expect(formatDateRangeDisplay({ from: "2024-07-01", to: "2024-07-31" })).toBe("2024-07-01 – 2024-07-31");
      expect(formatDateRangeDisplay({ from: "2024-07-01", to: null })).toBe("From 2024-07-01");
      expect(formatDateRangeDisplay({ from: null, to: "2024-07-31" })).toBe("Until 2024-07-31");
    });
  });
});
