import { z } from "zod";

import type { MortgageSimulatorConfig } from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-types";
import type {
  AusterityPreset,
  CapitalPoolConfig,
  CategoryAusterityWeight,
  JdgRunwayConfig,
  LookbackWindow,
} from "@/app/(main)/dashboard/family-budget/runway/_components/runway-types";

/**
 * Shared DTO contracts for scenario persistence (web Server Actions and `/api/v1/` REST).
 *
 * Deeply nested simulator configs are validated as plain objects here; the stores
 * sanitize and merge them against domain defaults.
 */

const plainObject = <T extends object>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null && !Array.isArray(value), {
    message: "Expected an object",
  });

export const scenarioIdSchema = z.object({ id: z.string().min(1, "Scenario id is required") });

export const scenarioKindSchema = z.enum(["mortgage", "runway"]);
export type ScenarioKind = z.infer<typeof scenarioKindSchema>;

// ---------------------------------------------------------------------------
// Mortgage
// ---------------------------------------------------------------------------

export const createMortgageScenarioSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().optional(),
  isPrimary: z.boolean().optional(),
  config: plainObject<Partial<MortgageSimulatorConfig>>().optional(),
});
export type CreateMortgageScenarioDto = z.infer<typeof createMortgageScenarioSchema>;

export const updateMortgageScenarioSchema = z.object({
  id: z.string().min(1, "Scenario id is required"),
  name: z.string().optional(),
  isPrimary: z.boolean().optional(),
  config: plainObject<Partial<MortgageSimulatorConfig>>().optional(),
});
export type UpdateMortgageScenarioDto = z.infer<typeof updateMortgageScenarioSchema>;

export const duplicateScenarioSchema = z.object({
  id: z.string().min(1, "Scenario id is required"),
  name: z.string().optional(),
});
export type DuplicateScenarioDto = z.infer<typeof duplicateScenarioSchema>;

// ---------------------------------------------------------------------------
// Runway
// ---------------------------------------------------------------------------

const runwayFields = {
  name: z.string().optional(),
  isPrimary: z.boolean().optional(),
  jdgConfig: plainObject<Partial<JdgRunwayConfig>>().optional(),
  capitalPoolConfig: plainObject<Partial<CapitalPoolConfig>>().optional(),
  lookbackWindow: z
    .custom<LookbackWindow>((value) => typeof value === "number" || typeof value === "string")
    .optional(),
  activePresetId: z.string().optional(),
  customPresets: z.array(plainObject<AusterityPreset>()).optional(),
  categoryCuts: z.record(z.string(), plainObject<CategoryAusterityWeight>()).optional(),
  baselineOfferRevisionId: z.string().nullable().optional(),
};

export const createRunwayScenarioSchema = z.object({ id: z.string().min(1).optional(), ...runwayFields });
export type CreateRunwayScenarioDto = z.infer<typeof createRunwayScenarioSchema>;

export const updateRunwayScenarioSchema = z.object({
  id: z.string().min(1, "Scenario id is required"),
  ...runwayFields,
});
export type UpdateRunwayScenarioDto = z.infer<typeof updateRunwayScenarioSchema>;

// ---------------------------------------------------------------------------
// Cloud sync reconciliation
// ---------------------------------------------------------------------------

export const resolveMortgageConflictSchema = z.object({
  id: z.string().min(1, "Scenario id is required"),
  choice: z.enum(["keep_local", "keep_remote"]),
  /** Required for `keep_local`: the client draft to push over the remote version. */
  localVersion: z
    .object({
      name: z.string().optional(),
      isPrimary: z.boolean().optional(),
      config: plainObject<Partial<MortgageSimulatorConfig>>().optional(),
    })
    .optional(),
});
export type ResolveMortgageConflictDto = z.infer<typeof resolveMortgageConflictSchema>;

export const resolveRunwayConflictSchema = z.object({
  id: z.string().min(1, "Scenario id is required"),
  choice: z.enum(["keep_local", "keep_remote"]),
  localVersion: z.object(runwayFields).optional(),
});
export type ResolveRunwayConflictDto = z.infer<typeof resolveRunwayConflictSchema>;
