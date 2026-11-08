import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InMemoryMortgageStore, setTestMortgageStore } from "@/server/mortgage/db";
import { InMemoryPresetStore, setTestPresetStore } from "@/server/presets/db";
import { InMemoryRunwayStore, setTestRunwayStore } from "@/server/runway/db";

import {
  createMortgageScenario,
  deleteMortgageScenario,
  duplicateMortgageScenario,
  getMortgageScenario,
  listMortgageScenarios,
  resolveMortgageConflict,
  setPrimaryMortgageScenario,
  updateMortgageScenario,
} from "../mortgage-service";
import { deletePreset, listPresets, setActivePreset, upsertPreset } from "../presets-service";
import {
  createRunwayScenario,
  deleteRunwayScenario,
  getRunwayScenario,
  listRunwayScenarios,
  resolveRunwayConflict,
  updateRunwayScenario,
} from "../runway-service";
import { type AuthContext, ServiceError } from "../types";

const ctx: AuthContext = { subject: "test@example.com", source: "session" };

describe("mortgage-service", () => {
  beforeEach(() => setTestMortgageStore(new InMemoryMortgageStore()));
  afterEach(() => setTestMortgageStore(null));

  it("creates, lists, updates, duplicates, promotes and deletes scenarios", async () => {
    const created = await createMortgageScenario(ctx, { name: "Plan A", isPrimary: true });
    expect(created.name).toBe("Plan A");
    expect(await listMortgageScenarios(ctx)).toHaveLength(1);

    const updated = await updateMortgageScenario(ctx, { id: created.id, name: "Plan A2" });
    expect(updated.name).toBe("Plan A2");

    const copy = await duplicateMortgageScenario(ctx, { id: created.id, name: "Copy" });
    expect(copy.id).not.toBe(created.id);

    const promoted = await setPrimaryMortgageScenario(ctx, copy.id);
    expect(promoted.isPrimary).toBe(true);

    await deleteMortgageScenario(ctx, copy.id);
    expect(await listMortgageScenarios(ctx)).toHaveLength(1);
  });

  it("raises not_found ServiceErrors", async () => {
    await expect(getMortgageScenario(ctx, "missing")).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteMortgageScenario(ctx, "missing")).rejects.toBeInstanceOf(ServiceError);
    await expect(updateMortgageScenario(ctx, { id: "missing", name: "x" })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("reconciles conflicts for keep_local and keep_remote", async () => {
    const created = await createMortgageScenario(ctx, { name: "Remote name", isPrimary: true });

    const remote = await resolveMortgageConflict(ctx, { id: created.id, choice: "keep_remote" });
    expect(remote.name).toBe("Remote name");

    const local = await resolveMortgageConflict(ctx, {
      id: created.id,
      choice: "keep_local",
      localVersion: { name: "Local draft" },
    });
    expect(local.name).toBe("Local draft");
    expect((await getMortgageScenario(ctx, created.id)).name).toBe("Local draft");

    await expect(resolveMortgageConflict(ctx, { id: created.id, choice: "keep_local" })).rejects.toMatchObject({
      code: "invalid",
    });
  });
});

describe("runway-service", () => {
  beforeEach(() => setTestRunwayStore(new InMemoryRunwayStore()));
  afterEach(() => setTestRunwayStore(null));

  it("supports CRUD and conflict reconciliation", async () => {
    const created = await createRunwayScenario(ctx, { name: "Runway", isPrimary: true });
    expect(await listRunwayScenarios(ctx)).toHaveLength(1);

    const { scenario, linkedOfferRevision } = await getRunwayScenario(ctx, created.id, { includeOffer: true });
    expect(scenario.id).toBe(created.id);
    expect(linkedOfferRevision).toBeNull();

    const updated = await updateRunwayScenario(ctx, { id: created.id, name: "Runway 2" });
    expect(updated.name).toBe("Runway 2");

    const kept = await resolveRunwayConflict(ctx, {
      id: created.id,
      choice: "keep_local",
      localVersion: { name: "L" },
    });
    expect(kept.name).toBe("L");
    expect((await resolveRunwayConflict(ctx, { id: created.id, choice: "keep_remote" })).name).toBe("L");

    await deleteRunwayScenario(ctx, created.id);
    await expect(getRunwayScenario(ctx, created.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("presets-service", () => {
  beforeEach(() =>
    setTestPresetStore(
      new InMemoryPresetStore([
        { id: "all-activity", name: "All Activity", incomeDeductions: [], expenseExclusions: [], isBuiltIn: true },
      ]),
    ),
  );
  afterEach(() => setTestPresetStore(null));

  it("upserts, activates and deletes presets", async () => {
    const result = await upsertPreset(ctx, {
      preset: { id: "custom", name: "Custom", incomeDeductions: [], expenseExclusions: ["rent"] },
      makeActive: true,
    });
    expect(result.activePresetId).toBe("custom");

    await setActivePreset(ctx, { activePresetId: "all-activity" });
    expect((await listPresets(ctx)).activePresetId).toBe("all-activity");

    const afterDelete = await deletePreset(ctx, { presetId: "custom" });
    expect(afterDelete.presets.some((p) => p.id === "custom")).toBe(false);
    await expect(deletePreset(ctx, { presetId: "custom" })).rejects.toMatchObject({ code: "not_found" });
  });
});
