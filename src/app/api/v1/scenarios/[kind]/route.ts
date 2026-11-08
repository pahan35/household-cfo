import { NextResponse } from "next/server";

import { z } from "zod";

import {
  createMortgageScenarioSchema,
  createRunwayScenarioSchema,
  duplicateScenarioSchema,
  scenarioKindSchema,
  updateMortgageScenarioSchema,
  updateRunwayScenarioSchema,
} from "@/lib/schemas/scenarios";
import {
  createMortgageScenario,
  deleteMortgageScenario,
  duplicateMortgageScenario,
  getMortgageScenario,
  listMortgageScenarios,
  setPrimaryMortgageScenario,
  updateMortgageScenario,
} from "@/server/services/mortgage-service";
import {
  createRunwayScenario,
  deleteRunwayScenario,
  duplicateRunwayScenario,
  getRunwayScenario,
  listRunwayScenarios,
  setPrimaryRunwayScenario,
  updateRunwayScenario,
} from "@/server/services/runway-service";
import { type AuthContext, ServiceError } from "@/server/services/types";

import { handleV1, parseJsonBody } from "../../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ kind: string }> };

async function resolveKind(context: RouteContext) {
  const parsed = scenarioKindSchema.safeParse((await context.params).kind);
  if (!parsed.success) {
    throw new ServiceError("not_found", "Unknown scenario kind (expected 'mortgage' or 'runway')");
  }
  return parsed.data;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_primary"), id: z.string().min(1) }),
  duplicateScenarioSchema.extend({ action: z.literal("duplicate") }),
]);

async function readBody(request: Request): Promise<unknown> {
  try {
    const text = await request.clone().text();
    return text.trim().length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new ServiceError("invalid", "Invalid JSON body");
  }
}

async function create(kind: "mortgage" | "runway", ctx: AuthContext, request: Request) {
  const body = await readBody(request);
  const action = actionSchema.safeParse(body);

  if (action.success) {
    const { data } = action;
    const scenario =
      data.action === "set_primary"
        ? await (kind === "mortgage" ? setPrimaryMortgageScenario : setPrimaryRunwayScenario)(ctx, data.id)
        : await (kind === "mortgage" ? duplicateMortgageScenario : duplicateRunwayScenario)(ctx, data);
    return NextResponse.json({ scenario }, { status: data.action === "duplicate" ? 201 : 200 });
  }

  if (kind === "mortgage") {
    const input = await parseJsonBody(request, createMortgageScenarioSchema);
    return NextResponse.json({ scenario: await createMortgageScenario(ctx, input) }, { status: 201 });
  }
  const input = await parseJsonBody(request, createRunwayScenarioSchema);
  return NextResponse.json({ scenario: await createRunwayScenario(ctx, input) }, { status: 201 });
}

export function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const kind = await resolveKind(context);
    const id = new URL(request.url).searchParams.get("id");

    if (id) {
      if (kind === "mortgage") return NextResponse.json({ scenario: await getMortgageScenario(ctx, id) });
      return NextResponse.json(await getRunwayScenario(ctx, id));
    }
    if (kind === "mortgage") return NextResponse.json({ scenarios: await listMortgageScenarios(ctx) });
    return NextResponse.json({ scenarios: await listRunwayScenarios(ctx) });
  });
}

export function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  return handleV1(request, async (ctx) => create(await resolveKind(context), ctx, request));
}

export function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const kind = await resolveKind(context);
    if (kind === "mortgage") {
      const input = await parseJsonBody(request, updateMortgageScenarioSchema);
      return NextResponse.json({ scenario: await updateMortgageScenario(ctx, input) });
    }
    const input = await parseJsonBody(request, updateRunwayScenarioSchema);
    return NextResponse.json({ scenario: await updateRunwayScenario(ctx, input) });
  });
}

export function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const kind = await resolveKind(context);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new ServiceError("invalid", "Scenario id is required for deletion");

    const result = await (kind === "mortgage" ? deleteMortgageScenario : deleteRunwayScenario)(ctx, id);
    return NextResponse.json({ success: true, ...result });
  });
}
