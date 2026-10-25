import { describe, expect, it } from "vitest";

import { addTagToList, filterKnownTags, normalizeTag, removeTagFromList } from "../multi-tag-editor-popover";

describe("MultiTagEditorPopover helpers", () => {
  describe("normalizeTag", () => {
    it("strips whitespace and multiple leading hashes and lowercases", () => {
      expect(normalizeTag("  #Travel  ")).toBe("#travel");
      expect(normalizeTag("###Austria")).toBe("#austria");
      expect(normalizeTag("vacation")).toBe("#vacation");
      expect(normalizeTag("End-Travel")).toBe("#end-travel");
    });

    it("returns empty string for empty or blank strings", () => {
      expect(normalizeTag("")).toBe("");
      expect(normalizeTag("   ")).toBe("");
      expect(normalizeTag("###")).toBe("");
    });
  });

  describe("addTagToList", () => {
    it("adds a normalized tag to empty or undefined list", () => {
      expect(addTagToList(undefined, "travel")).toEqual(["#travel"]);
      expect(addTagToList([], "#vacation")).toEqual(["#vacation"]);
    });

    it("appends new tag to existing list", () => {
      const initial = ["#travel", "#vienna"];
      expect(addTagToList(initial, "hotel")).toEqual(["#travel", "#vienna", "#hotel"]);
    });

    it("does not duplicate existing tags regardless of case or hashes", () => {
      const initial = ["#travel", "#vienna"];
      expect(addTagToList(initial, "TRAVEL")).toEqual(["#travel", "#vienna"]);
      expect(addTagToList(initial, "#travel")).toEqual(["#travel", "#vienna"]);
      expect(addTagToList(initial, "###Vienna")).toEqual(["#travel", "#vienna"]);
    });
  });

  describe("removeTagFromList", () => {
    it("removes target tag regardless of case or leading hashes", () => {
      const initial = ["#travel", "#vienna", "#hotel"];
      expect(removeTagFromList(initial, "vienna")).toEqual(["#travel", "#hotel"]);
      expect(removeTagFromList(initial, "#TRAVEL")).toEqual(["#vienna", "#hotel"]);
      expect(removeTagFromList(initial, "###hotel")).toEqual(["#travel", "#vienna"]);
    });

    it("returns same list or empty if target tag not present", () => {
      expect(removeTagFromList(["#travel"], "unknown")).toEqual(["#travel"]);
      expect(removeTagFromList([], "anything")).toEqual([]);
      expect(removeTagFromList(undefined, "anything")).toEqual([]);
    });
  });

  describe("filterKnownTags", () => {
    const knownTags = ["#travel", "#vienna", "#hotel", "#concert", "#salzburg", "#austria", "#flight"];

    it("returns available tags when query is empty, excluding already applied tags", () => {
      const current = ["#travel", "#hotel"];
      const suggestions = filterKnownTags(knownTags, "", current);
      expect(suggestions).toEqual(["#vienna", "#concert", "#salzburg", "#austria", "#flight"]);
      expect(suggestions).not.toContain("#travel");
      expect(suggestions).not.toContain("#hotel");
    });

    it("filters by query matching substring without leading hash", () => {
      const current = ["#travel"];
      const suggestions = filterKnownTags(knownTags, "salz", current);
      expect(suggestions).toEqual(["#salzburg"]);

      const suggestionsWithHash = filterKnownTags(knownTags, "#aust", current);
      expect(suggestionsWithHash).toEqual(["#austria"]);
    });

    it("respects limit parameter", () => {
      const suggestions = filterKnownTags(knownTags, "", [], 3);
      expect(suggestions).toHaveLength(3);
    });

    it("handles undefined or empty knownTags gracefully", () => {
      expect(filterKnownTags(undefined, "query", [])).toEqual([]);
      expect(filterKnownTags([], "query", [])).toEqual([]);
    });
  });
});
