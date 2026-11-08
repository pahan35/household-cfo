import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import * as authConfig from "@/server/auth/config";
import { InMemoryMortgageStore, setTestMortgageStore } from "@/server/mortgage/db";
import { InMemoryPresetStore, setTestPresetStore } from "@/server/presets/db";

import { createMortgageScenarioAction, listMortgageScenariosAction } from "../mortgage-actions";
import { upsertPresetAction } from "../presets-actions";

describe("Server Actions (next-safe-action)", () => {
  beforeEach(() => {
    setTestMortgageStore(new InMemoryMortgageStore());
    setTestPresetStore(new InMemoryPresetStore());
  });

  afterEach(() => {
    setTestMortgageStore(null);
    setTestPresetStore(null);
    vi.restoreAllMocks();
  });

  it("executes a valid mutation with an active session (bypass)", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);

    const result = await createMortgageScenarioAction({ name: "Action Plan", isPrimary: true });
    expect(result.data?.scenario.name).toBe("Action Plan");

    const listed = await listMortgageScenariosAction({});
    expect(listed.data?.scenarios).toHaveLength(1);
  });

  it("rejects unauthenticated callers before reaching the service", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(false);

    const result = await createMortgageScenarioAction({ name: "Nope" });
    expect(result.data).toBeUndefined();
    expect(result.serverError).toBe("Unauthorized");
  });

  it("returns validation errors for malformed payloads", async () => {
    vi.spyOn(authConfig, "isAuthBypassActive").mockReturnValue(true);

    const result = await upsertPresetAction({ preset: { id: "", name: "" } });
    expect(result.data).toBeUndefined();
    expect(result.validationErrors).toBeDefined();
  });
});
