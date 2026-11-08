"use server";

import { z } from "zod";

import {
  createRunwayScenarioSchema,
  duplicateScenarioSchema,
  resolveRunwayConflictSchema,
  scenarioIdSchema,
  updateRunwayScenarioSchema,
} from "@/lib/schemas/scenarios";
import {
  createRunwayScenario,
  deleteRunwayScenario,
  duplicateRunwayScenario,
  listRunwayScenarios,
  resolveRunwayConflict,
  setPrimaryRunwayScenario,
  updateRunwayScenario,
} from "@/server/services/runway-service";

import { authActionClient } from "./action-client";

export const listRunwayScenariosAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => ({ scenarios: await listRunwayScenarios(ctx.auth) }));

export const createRunwayScenarioAction = authActionClient
  .inputSchema(createRunwayScenarioSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await createRunwayScenario(ctx.auth, parsedInput) }));

export const updateRunwayScenarioAction = authActionClient
  .inputSchema(updateRunwayScenarioSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await updateRunwayScenario(ctx.auth, parsedInput) }));

export const deleteRunwayScenarioAction = authActionClient
  .inputSchema(scenarioIdSchema)
  .action(async ({ parsedInput, ctx }) => deleteRunwayScenario(ctx.auth, parsedInput.id));

export const setPrimaryRunwayScenarioAction = authActionClient
  .inputSchema(scenarioIdSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await setPrimaryRunwayScenario(ctx.auth, parsedInput.id) }));

export const duplicateRunwayScenarioAction = authActionClient
  .inputSchema(duplicateScenarioSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await duplicateRunwayScenario(ctx.auth, parsedInput) }));

export const resolveRunwayConflictAction = authActionClient
  .inputSchema(resolveRunwayConflictSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await resolveRunwayConflict(ctx.auth, parsedInput) }));
