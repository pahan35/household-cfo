import { Banknote, CreditCard, Landmark, PiggyBank, Plane, Receipt, Scale, Target, Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { CategoryType } from "../external-provider-data";
import {
  EXTERNAL_PROVIDER_ICON_GROUPS,
  EXTERNAL_PROVIDER_ICONS,
  getExternalProviderIconMeta,
  resolveExternalProviderIcon,
} from "../external-provider-icons";

describe("ExternalProvider 80-Icon Catalog", () => {
  it("contains exactly 80 icon definitions with unique IDs", () => {
    expect(EXTERNAL_PROVIDER_ICONS).toHaveLength(80);
    const ids = EXTERNAL_PROVIDER_ICONS.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(80);
  });

  it("covers all 8 expected group categories with at least one icon", () => {
    const groupIds = EXTERNAL_PROVIDER_ICON_GROUPS.map((g) => g.id);
    expect(groupIds).toEqual(["finance", "food", "transport", "living", "tech", "lifestyle", "health", "work"]);

    for (const group of groupIds) {
      const items = EXTERNAL_PROVIDER_ICONS.filter((i) => i.group === group);
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it("ensures every icon has a label, valid icon component, and non-empty keywords", () => {
    for (const meta of EXTERNAL_PROVIDER_ICONS) {
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.keywords.length).toBeGreaterThan(0);
      expect(typeof meta.icon).toBe("object"); // Lucide icon forwardRef/element
    }
  });

  it("supports case-insensitive metadata retrieval", () => {
    expect(getExternalProviderIconMeta("savings")?.id).toBe("savings");
    expect(getExternalProviderIconMeta("Savings")?.id).toBe("savings");
    expect(getExternalProviderIconMeta("SAVINGS")?.id).toBe("savings");
    expect(getExternalProviderIconMeta("Airplane")?.id).toBe("airplane");
    expect(getExternalProviderIconMeta("city")?.id).toBe("city");
    expect(getExternalProviderIconMeta("DEBT")?.id).toBe("debt");
    expect(getExternalProviderIconMeta("non_existent_key")).toBeUndefined();
    expect(getExternalProviderIconMeta(null)).toBeUndefined();
    expect(getExternalProviderIconMeta("")).toBeUndefined();
  });

  it("indexes search keywords as specified in scenarios (fly, food, cash, crypto)", () => {
    const search = (query: string) => {
      const q = query.toLowerCase();
      return EXTERNAL_PROVIDER_ICONS.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          i.keywords.some((k) => k.toLowerCase().includes(q)),
      ).map((i) => i.id);
    };

    expect(search("fly")).toContain("airplane");
    expect(search("food")).toEqual(expect.arrayContaining(["groceries", "eating", "forkandknife"]));
    expect(search("cash")).toContain("cash");
    expect(search("crypto")).toContain("emoney");
  });
});

describe("ExternalProviderIcon Fallback Cascade", () => {
  it("resolves exact matched icons to their corresponding Lucide icons", () => {
    expect(resolveExternalProviderIcon("savings")).toBe(PiggyBank);
    expect(resolveExternalProviderIcon("airplane")).toBe(Plane);
    expect(resolveExternalProviderIcon("debt")).toBe(Scale);
    expect(resolveExternalProviderIcon("cash")).toBe(Banknote);
  });

  it("falls back to CategoryType when icon is missing, empty, or unrecognized", () => {
    // Missing icon
    expect(resolveExternalProviderIcon(undefined, CategoryType.BankAccount)).toBe(Landmark);
    expect(resolveExternalProviderIcon(null, CategoryType.Account)).toBe(Wallet);
    expect(resolveExternalProviderIcon("", CategoryType.DebtAccount)).toBe(Scale);
    expect(resolveExternalProviderIcon("", CategoryType.Income)).toBe(Banknote);
    expect(resolveExternalProviderIcon("", CategoryType.Expense)).toBe(Receipt);
    expect(resolveExternalProviderIcon("", CategoryType.Goal)).toBe(Target);
    expect(resolveExternalProviderIcon("", CategoryType.ClassicGoal)).toBe(Target);

    // Unrecognized string
    expect(resolveExternalProviderIcon("custom_future_icon", CategoryType.DebtAccount)).toBe(Scale);
    expect(resolveExternalProviderIcon("mystery_icon", CategoryType.BankAccount)).toBe(Landmark);
  });

  it("falls back to CreditCard when neither icon nor CategoryType matches", () => {
    expect(resolveExternalProviderIcon(undefined, undefined)).toBe(CreditCard);
    expect(resolveExternalProviderIcon(null, null)).toBe(CreditCard);
    expect(resolveExternalProviderIcon("", 9999)).toBe(CreditCard);
    expect(resolveExternalProviderIcon("unknown", undefined)).toBe(CreditCard);
  });

  it("prioritizes valid icon over fallback CategoryType", () => {
    // A bank account with savings icon should render PiggyBank, not Landmark
    expect(resolveExternalProviderIcon("savings", CategoryType.BankAccount)).toBe(PiggyBank);
    // An expense with beerglass should render Beer, not Receipt
    expect(resolveExternalProviderIcon("beerglass", CategoryType.Expense)).not.toBe(Receipt);
  });
});
