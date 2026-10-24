import { describe, expect, it } from "vitest";

import { filterExternalProviderIcons } from "../external-provider-icon-picker";

describe("ExternalProviderIconPicker Search and Filter Logic", () => {
  it("returns all 80 icons when query is empty and group is all", () => {
    const results = filterExternalProviderIcons("", "all");
    expect(results).toHaveLength(80);
  });

  it("filters icons by search query matching name, label, or keywords", () => {
    const carResults = filterExternalProviderIcons("car").map((i) => i.id);
    expect(carResults).toContain("car");

    const foodResults = filterExternalProviderIcons("food").map((i) => i.id);
    expect(foodResults).toContain("groceries");
    expect(foodResults).toContain("eating");
    expect(foodResults).toContain("forkandknife");

    const cryptoResults = filterExternalProviderIcons("crypto").map((i) => i.id);
    expect(cryptoResults).toContain("emoney");
  });

  it("filters icons by group", () => {
    const financeResults = filterExternalProviderIcons("", "finance");
    expect(financeResults.length).toBeGreaterThan(0);
    expect(financeResults.every((i) => i.group === "finance")).toBe(true);

    const transportResults = filterExternalProviderIcons("", "transport");
    expect(transportResults.length).toBeGreaterThan(0);
    expect(transportResults.every((i) => i.group === "transport")).toBe(true);
  });

  it("combines group filter with search query", () => {
    // "car" in transport group
    const transportCar = filterExternalProviderIcons("car", "transport").map((i) => i.id);
    expect(transportCar).toContain("car");

    // "airplane" in food group should return empty
    const foodAirplane = filterExternalProviderIcons("airplane", "food");
    expect(foodAirplane).toHaveLength(0);
  });

  it("handles whitespace and case-insensitivity gracefully", () => {
    const upperQuery = filterExternalProviderIcons("  AIRPLANE  ").map((i) => i.id);
    expect(upperQuery).toContain("airplane");
  });

  it("returns empty array when no icon matches", () => {
    const results = filterExternalProviderIcons("non_existent_random_word");
    expect(results).toEqual([]);
  });
});
