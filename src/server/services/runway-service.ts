import "server-only";

import type {
  CreateRunwayScenarioDto,
  DuplicateScenarioDto,
  ResolveRunwayConflictDto,
  UpdateRunwayScenarioDto,
} from "@/lib/schemas/scenarios";
import { getRunwayStore, type RunwayScenario } from "@/server/runway/db";

import { type AuthContext, guard, ServiceError } from "./types";

export async function listRunwayScenarios(_ctx: AuthContext): Promise<RunwayScenario[]> {
  return guard("internal", "Failed to list runway scenarios", () => getRunwayStore().list());
}

export async function getRunwayScenario(_ctx: AuthContext, id: string, options: { includeOffer?: boolean } = {}) {
  const store = getRunwayStore();
  const scenario = await guard("internal", "Failed to load runway scenario", () => store.get(id));
  if (!scenario) throw new ServiceError("not_found", `Runway scenario not found: ${id}`);

  let linkedOfferRevision = null;
  if (options.includeOffer && scenario.baselineOfferRevisionId) {
    linkedOfferRevision = await guard("internal", "Failed to load linked offer", () =>
      store.getLinkedOfferRevision(id),
    );
  }
  return { scenario, linkedOfferRevision };
}

export async function createRunwayScenario(_ctx: AuthContext, input: CreateRunwayScenarioDto): Promise<RunwayScenario> {
  return guard("internal", "Failed to create runway scenario", () => getRunwayStore().create(input));
}

export async function updateRunwayScenario(
  _ctx: AuthContext,
  { id, ...updates }: UpdateRunwayScenarioDto,
): Promise<RunwayScenario> {
  return guard("not_found", "Failed to update runway scenario", () => getRunwayStore().update(id, updates));
}

export async function deleteRunwayScenario(_ctx: AuthContext, id: string): Promise<{ id: string }> {
  const deleted = await guard("internal", "Failed to delete scenario", () => getRunwayStore().delete(id));
  if (!deleted) throw new ServiceError("not_found", `Scenario not found: ${id}`);
  return { id };
}

export async function setPrimaryRunwayScenario(_ctx: AuthContext, id: string): Promise<RunwayScenario> {
  return guard("not_found", "Failed to set primary scenario", () => getRunwayStore().setPrimary(id));
}

export async function duplicateRunwayScenario(
  _ctx: AuthContext,
  { id, name }: DuplicateScenarioDto,
): Promise<RunwayScenario> {
  return guard("not_found", "Failed to duplicate scenario", () => getRunwayStore().duplicate(id, name));
}

/** Cloud-sync reconciliation for runway scenarios (see `resolveMortgageConflict`). */
export async function resolveRunwayConflict(
  ctx: AuthContext,
  { id, choice, localVersion }: ResolveRunwayConflictDto,
): Promise<RunwayScenario> {
  if (choice === "keep_remote") {
    return (await getRunwayScenario(ctx, id)).scenario;
  }
  if (!localVersion) {
    throw new ServiceError("invalid", "localVersion is required to keep the local draft");
  }
  return updateRunwayScenario(ctx, { id, ...localVersion });
}
