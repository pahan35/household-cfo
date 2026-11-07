import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Dialog } from "@/components/ui/dialog";

import { CategoryType, type ExternalProviderCategory, type StatCategoryPoint } from "../external-provider-data";
import {
  filterExpenseCategories,
  isPresetCategoryActive,
  PresetDialogHeader,
  sanitizePresetCategoryName,
} from "../preset-dialog";

describe("preset-dialog helpers", () => {
  describe("filterExpenseCategories", () => {
    it("strictly filters out accounts, income sources, savings goals, and deleted categories", () => {
      const mockCategories: ExternalProviderCategory[] = [
        { id: "cat-exp-rent", name: "Rent PLN", categoryType: CategoryType.Expense },
        { id: "cat-exp-groceries", name: "Groceries", categoryType: CategoryType.Expense },
        { id: "cat-acc-card", name: "Credit Card", categoryType: CategoryType.Account },
        { id: "cat-acc-bank", name: "Checking Bank", categoryType: CategoryType.BankAccount },
        { id: "cat-acc-debt", name: "Debt: Loan", categoryType: CategoryType.DebtAccount },
        { id: "cat-inc-salary", name: "Main Salary", categoryType: CategoryType.Income },
        { id: "cat-goal-house", name: "House Downpayment", categoryType: CategoryType.Goal },
        { id: "cat-classic-goal", name: "Emergency Fund", categoryType: CategoryType.ClassicGoal },
        { id: "cat-deleted", name: "Old Gym", categoryType: CategoryType.Expense, deleted: true },
      ];

      const result = filterExpenseCategories(mockCategories);

      expect(result.map((c) => c.id)).toEqual(["cat-exp-rent", "cat-exp-groceries"]);
    });

    it("does not re-introduce filtered account or income categories from statCategories", () => {
      const mockCategories: ExternalProviderCategory[] = [
        { id: "cat-exp-1", name: "Utilities", categoryType: CategoryType.Expense },
        { id: "cat-acc-card", name: "Credit Card", categoryType: CategoryType.Account },
        { id: "cat-inc-salary", name: "Salary", categoryType: CategoryType.Income },
      ];

      const statPoints: StatCategoryPoint[] = [
        { id: "cat-exp-1", value: 350 },
        { id: "cat-acc-card", value: 1200 }, // should not be added
        { id: "cat-inc-salary", value: 5000 }, // should not be added
        { id: "cat-unknown-sc", value: 80, title: "Unlisted Expense" }, // new unlisted point
      ];

      const result = filterExpenseCategories(mockCategories, statPoints);

      expect(result.map((c) => c.id)).toEqual(["cat-exp-1", "cat-unknown-sc"]);
    });
  });

  describe("isPresetCategoryActive", () => {
    it("considers non-archived categories always active", () => {
      const cat: ExternalProviderCategory = { id: "c1", name: "Groceries", categoryType: CategoryType.Expense };
      expect(isPresetCategoryActive(cat, 0, false)).toBe(true);
      expect(isPresetCategoryActive(cat, 100, false)).toBe(true);
    });

    it("considers archived category inactive when spend is 0, limit is 0, and not excluded", () => {
      const archivedCat: ExternalProviderCategory = {
        id: "c-old",
        name: "_Old Category",
        categoryType: CategoryType.Expense,
      };
      expect(isPresetCategoryActive(archivedCat, 0, false)).toBe(false);
    });

    it("considers archived category active if it has period spend", () => {
      const archivedCat: ExternalProviderCategory = {
        id: "c-old",
        name: "_Old Category",
        categoryType: CategoryType.Expense,
      };
      expect(isPresetCategoryActive(archivedCat, 50, false)).toBe(true);
    });

    it("considers archived category active if it has a budget limit", () => {
      const archivedCat: ExternalProviderCategory = {
        id: "c-old",
        name: "_Old Category",
        categoryType: CategoryType.Expense,
        limitAmount: 200,
      };
      expect(isPresetCategoryActive(archivedCat, 0, false)).toBe(true);
    });

    it("considers archived category active if it is currently excluded in draft", () => {
      const archivedCat: ExternalProviderCategory = {
        id: "c-old",
        name: "_Old Category",
        categoryType: CategoryType.Expense,
      };
      expect(isPresetCategoryActive(archivedCat, 0, true)).toBe(true);
    });
  });

  describe("sanitizePresetCategoryName", () => {
    it("sanitizes archived category names by trimming leading '_' and stripping currency suffixes", () => {
      const result = sanitizePresetCategoryName("_Rent & Housing PLN", "PLN");
      expect(result.isArchived).toBe(true);
      expect(result.displayName).toBe("Rent & Housing");
    });

    it("handles multiple leading underscores and whitespace", () => {
      const result = sanitizePresetCategoryName(" _Legacy Category ", "PLN");
      expect(result.isArchived).toBe(true);
      expect(result.displayName).toBe("Legacy Category");
    });

    it("preserves non-archived categories without stripping standard letters", () => {
      const result = sanitizePresetCategoryName("Underground Parking", "PLN");
      expect(result.isArchived).toBe(false);
      expect(result.displayName).toBe("Underground Parking");
    });
  });

  describe("PresetDialog Cloud Sync Badge", () => {
    it("renders Cloud Synced badge in the dialog header", () => {
      const html = renderToString(
        <Dialog open={true}>
          <PresetDialogHeader syncStatus="synced" lastSyncedAt={new Date("2026-03-01T12:00:00Z")} />
        </Dialog>,
      );

      expect(html).toContain("Exclusion Presets &amp; Fixed Obligations");
      expect(html).toContain("Cloud Synced");
    });

    it("renders Offline indicator when offline fallback is active", () => {
      const html = renderToString(
        <Dialog open={true}>
          <PresetDialogHeader syncStatus="offline" />
        </Dialog>,
      );

      expect(html).toContain("Local Cache");
    });
  });
});
