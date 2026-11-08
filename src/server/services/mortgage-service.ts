import "server-only";

import type {
  CreateMortgageScenarioDto,
  DuplicateScenarioDto,
  ResolveMortgageConflictDto,
  UpdateMortgageScenarioDto,
} from "@/lib/schemas/scenarios";
import { getMortgageStore, type MortgageScenario } from "@/server/mortgage/db";

import { type AuthContext, guard, ServiceError } from "./types";

export async function listMortgageScenarios(_ctx: AuthContext): Promise<MortgageScenario[]> {
  return guard("internal", "Failed to list mortgage scenarios", () => getMortgageStore().list());
}

export async function getMortgageScenario(_ctx: AuthContext, id: string): Promise<MortgageScenario> {
  const scenario = await guard("internal", "Failed to load scenario", () => getMortgageStore().get(id));
  if (!scenario) throw new ServiceError("not_found", `Scenario not found: ${id}`);
  return scenario;
}

export async function createMortgageScenario(
  _ctx: AuthContext,
  input: CreateMortgageScenarioDto,
): Promise<MortgageScenario> {
  return guard("invalid", "Failed to create scenario", () => getMortgageStore().create(input));
}

export async function updateMortgageScenario(
  _ctx: AuthContext,
  { id, ...updates }: UpdateMortgageScenarioDto,
): Promise<MortgageScenario> {
  return guard("not_found", "Failed to update scenario", () => getMortgageStore().update(id, updates));
}

export async function deleteMortgageScenario(_ctx: AuthContext, id: string): Promise<{ id: string }> {
  const deleted = await guard("internal", "Failed to delete scenario", () => getMortgageStore().delete(id));
  if (!deleted) throw new ServiceError("not_found", `Scenario not found: ${id}`);
  return { id };
}

export async function setPrimaryMortgageScenario(_ctx: AuthContext, id: string): Promise<MortgageScenario> {
  return guard("not_found", "Failed to set primary scenario", () => getMortgageStore().setPrimary(id));
}

export async function duplicateMortgageScenario(
  _ctx: AuthContext,
  { id, name }: DuplicateScenarioDto,
): Promise<MortgageScenario> {
  return guard("not_found", "Failed to duplicate scenario", () => getMortgageStore().duplicate(id, name));
}

/**
 * Cloud-sync reconciliation: applies the user's conflict choice and returns the reconciled state.
 * - `keep_local` pushes the supplied local draft over the persisted version.
 * - `keep_remote` leaves the persisted version untouched and returns it.
 */
export async function resolveMortgageConflict(
  ctx: AuthContext,
  { id, choice, localVersion }: ResolveMortgageConflictDto,
): Promise<MortgageScenario> {
  if (choice === "keep_remote") {
    return getMortgageScenario(ctx, id);
  }
  if (!localVersion) {
    throw new ServiceError("invalid", "localVersion is required to keep the local draft");
  }
  return updateMortgageScenario(ctx, { id, ...localVersion });
}
