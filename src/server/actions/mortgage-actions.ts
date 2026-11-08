"use server";

import { z } from "zod";

import {
  createMortgageScenarioSchema,
  duplicateScenarioSchema,
  resolveMortgageConflictSchema,
  scenarioIdSchema,
  updateMortgageScenarioSchema,
} from "@/lib/schemas/scenarios";
import {
  createMortgageScenario,
  deleteMortgageScenario,
  duplicateMortgageScenario,
  listMortgageScenarios,
  resolveMortgageConflict,
  setPrimaryMortgageScenario,
  updateMortgageScenario,
} from "@/server/services/mortgage-service";

import { authActionClient } from "./action-client";

export const listMortgageScenariosAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => ({ scenarios: await listMortgageScenarios(ctx.auth) }));

export const createMortgageScenarioAction = authActionClient
  .inputSchema(createMortgageScenarioSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await createMortgageScenario(ctx.auth, parsedInput) }));

export const updateMortgageScenarioAction = authActionClient
  .inputSchema(updateMortgageScenarioSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await updateMortgageScenario(ctx.auth, parsedInput) }));

export const deleteMortgageScenarioAction = authActionClient
  .inputSchema(scenarioIdSchema)
  .action(async ({ parsedInput, ctx }) => deleteMortgageScenario(ctx.auth, parsedInput.id));

export const setPrimaryMortgageScenarioAction = authActionClient
  .inputSchema(scenarioIdSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await setPrimaryMortgageScenario(ctx.auth, parsedInput.id) }));

export const duplicateMortgageScenarioAction = authActionClient
  .inputSchema(duplicateScenarioSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await duplicateMortgageScenario(ctx.auth, parsedInput) }));

export const resolveMortgageConflictAction = authActionClient
  .inputSchema(resolveMortgageConflictSchema)
  .action(async ({ parsedInput, ctx }) => ({ scenario: await resolveMortgageConflict(ctx.auth, parsedInput) }));
