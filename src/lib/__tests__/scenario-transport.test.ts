import { describe, expect, it, vi } from "vitest";

import {
  createActionScenarioTransport,
  createFetchScenarioTransport,
  type ScenarioActionOperations,
  unwrapAction,
} from "../scenario-transport";

describe("scenario-transport", () => {
  describe("unwrapAction", () => {
    it("returns data on success", () => {
      expect(unwrapAction({ data: { count: 42 } }, "failed")).toEqual({ count: 42 });
    });

    it("throws serverError when present", () => {
      expect(() => unwrapAction({ serverError: "Unauthorized" }, "fallback")).toThrow("Unauthorized");
    });

    it("throws validation error message when validationErrors present", () => {
      expect(() => unwrapAction({ validationErrors: { id: ["required"] } }, "Operation failed")).toThrow(
        "Operation failed: invalid input",
      );
    });

    it("throws fallback when neither data nor errors present", () => {
      expect(() => unwrapAction(undefined, "Default error")).toThrow("Default error");
    });
  });

  describe("createActionScenarioTransport", () => {
    it("delegates operations to actions and calls onMutated", async () => {
      const onMutated = vi.fn();
      const mockScenario = { id: "sc-1", name: "Scenario 1" };

      interface TestScenario {
        id: string;
        name: string;
        isPrimary?: boolean;
      }

      const actions = {
        list: vi.fn().mockResolvedValue({ data: { scenarios: [mockScenario] } }),
        create: vi.fn().mockResolvedValue({ data: { scenario: mockScenario } }),
        update: vi.fn().mockResolvedValue({ data: { scenario: { ...mockScenario, name: "Updated" } } }),
        delete: vi.fn().mockResolvedValue({ data: { id: "sc-1" } }),
        setPrimary: vi.fn().mockResolvedValue({ data: { scenario: { ...mockScenario, isPrimary: true } } }),
        duplicate: vi.fn().mockResolvedValue({ data: { scenario: { ...mockScenario, id: "sc-2" } } }),
      };

      const transport = createActionScenarioTransport<TestScenario, { name: string }, { name?: string }>(actions, {
        onMutated,
      });

      const list = await transport.list();
      expect(list).toEqual([mockScenario]);
      expect(onMutated).not.toHaveBeenCalled();

      const created = await transport.create({ name: "Scenario 1" });
      expect(created).toEqual(mockScenario);
      expect(onMutated).toHaveBeenCalledTimes(1);

      const updated = await transport.update("sc-1", { name: "Updated" });
      expect(updated.name).toBe("Updated");
      expect(onMutated).toHaveBeenCalledTimes(2);

      await transport.delete("sc-1");
      expect(onMutated).toHaveBeenCalledTimes(3);

      const primary = await transport.setPrimary("sc-1");
      expect(primary.isPrimary).toBe(true);
      expect(onMutated).toHaveBeenCalledTimes(4);

      const copy = await transport.duplicate("sc-1", "Copy");
      expect(copy.id).toBe("sc-2");
      expect(onMutated).toHaveBeenCalledTimes(5);
    });

    it("propagates action errors as thrown exceptions so offline fallbacks can trigger", async () => {
      const actions = {
        list: vi.fn().mockResolvedValue({ serverError: "Network error" }),
        create: vi.fn().mockResolvedValue({ serverError: "Database down" }),
        update: vi.fn(),
        delete: vi.fn(),
        setPrimary: vi.fn(),
        duplicate: vi.fn(),
      };

      const transport = createActionScenarioTransport(
        actions as unknown as ScenarioActionOperations<unknown, Record<string, unknown>, Record<string, unknown>>,
      );

      await expect(transport.list()).rejects.toThrow("Network error");
      await expect(transport.create({})).rejects.toThrow("Database down");
    });
  });

  describe("createFetchScenarioTransport", () => {
    it("handles HTTP responses and errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ scenarios: [{ id: "fetch-1" }] }),
      });

      const transport = createFetchScenarioTransport(mockFetch as unknown as typeof fetch, "/api/test");
      const result = await transport.list();
      expect(result).toEqual([{ id: "fetch-1" }]);

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(transport.list()).rejects.toThrow("HTTP 500");
    });
  });
});
