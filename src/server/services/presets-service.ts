import "server-only";

import type { DeletePresetDto, SavePresetsDto, SetActivePresetDto, UpsertPresetDto } from "@/lib/schemas/presets";
import { getPresetStore, type PresetStoreData } from "@/server/presets/db";

import { type AuthContext, guard, ServiceError } from "./types";

export async function listPresets(_ctx: AuthContext): Promise<PresetStoreData> {
  return guard("internal", "Failed to load presets", () => getPresetStore().loadAll());
}

export async function seedPresetsIfEmpty(_ctx: AuthContext, input: SavePresetsDto): Promise<PresetStoreData> {
  return guard("internal", "Failed to seed presets", () =>
    getPresetStore().seedIfEmpty(input.presets, input.activePresetId),
  );
}

export async function savePresets(_ctx: AuthContext, input: SavePresetsDto): Promise<PresetStoreData> {
  return guard("internal", "Failed to save presets", () =>
    getPresetStore().saveAll(input.presets, input.activePresetId),
  );
}

export async function setActivePreset(_ctx: AuthContext, { activePresetId }: SetActivePresetDto) {
  const id = await guard("internal", "Failed to set active preset", () => getPresetStore().setActive(activePresetId));
  return { activePresetId: id };
}

export async function upsertPreset(_ctx: AuthContext, { preset, makeActive }: UpsertPresetDto) {
  const store = getPresetStore();
  const saved = await guard("internal", "Failed to save preset", () => store.upsertPreset(preset, makeActive));
  const all = await guard("internal", "Failed to load presets", () => store.loadAll());
  return { preset: saved, presets: all.presets, activePresetId: all.activePresetId };
}

export async function deletePreset(_ctx: AuthContext, { presetId }: DeletePresetDto) {
  const store = getPresetStore();
  const deleted = await guard("internal", "Failed to delete preset", () => store.deletePreset(presetId));
  if (!deleted) throw new ServiceError("not_found", `Preset not found: ${presetId}`);
  const all = await guard("internal", "Failed to load presets", () => store.loadAll());
  return { presets: all.presets, activePresetId: all.activePresetId };
}
