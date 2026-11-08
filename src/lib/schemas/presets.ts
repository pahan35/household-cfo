import { z } from "zod";

/** Shared DTO contracts for budget exclusion presets. */

export const exclusionPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  incomeDeductions: z.array(z.string()).default([]),
  expenseExclusions: z.array(z.string()).default([]),
  isBuiltIn: z.boolean().optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
});
export type ExclusionPresetDto = z.infer<typeof exclusionPresetSchema>;

export const upsertPresetSchema = z.object({
  preset: exclusionPresetSchema,
  makeActive: z.boolean().optional(),
});
export type UpsertPresetDto = z.infer<typeof upsertPresetSchema>;

export const setActivePresetSchema = z.object({ activePresetId: z.string().min(1) });
export type SetActivePresetDto = z.infer<typeof setActivePresetSchema>;

export const deletePresetSchema = z.object({ presetId: z.string().min(1) });
export type DeletePresetDto = z.infer<typeof deletePresetSchema>;

export const savePresetsSchema = z.object({
  presets: z.array(exclusionPresetSchema),
  activePresetId: z.string().optional(),
});
export type SavePresetsDto = z.infer<typeof savePresetsSchema>;
