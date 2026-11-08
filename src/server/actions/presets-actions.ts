"use server";

import { z } from "zod";

import {
  deletePresetSchema,
  savePresetsSchema,
  setActivePresetSchema,
  upsertPresetSchema,
} from "@/lib/schemas/presets";
import {
  deletePreset,
  listPresets,
  savePresets,
  seedPresetsIfEmpty,
  setActivePreset,
  upsertPreset,
} from "@/server/services/presets-service";

import { authActionClient } from "./action-client";

export const listPresetsAction = authActionClient.inputSchema(z.object({})).action(({ ctx }) => listPresets(ctx.auth));

export const seedPresetsAction = authActionClient
  .inputSchema(savePresetsSchema)
  .action(({ parsedInput, ctx }) => seedPresetsIfEmpty(ctx.auth, parsedInput));

export const savePresetsAction = authActionClient
  .inputSchema(savePresetsSchema)
  .action(({ parsedInput, ctx }) => savePresets(ctx.auth, parsedInput));

export const setActivePresetAction = authActionClient
  .inputSchema(setActivePresetSchema)
  .action(({ parsedInput, ctx }) => setActivePreset(ctx.auth, parsedInput));

export const upsertPresetAction = authActionClient
  .inputSchema(upsertPresetSchema)
  .action(({ parsedInput, ctx }) => upsertPreset(ctx.auth, parsedInput));

export const deletePresetAction = authActionClient
  .inputSchema(deletePresetSchema)
  .action(({ parsedInput, ctx }) => deletePreset(ctx.auth, parsedInput));
