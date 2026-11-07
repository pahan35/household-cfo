import { type NextRequest, NextResponse } from "next/server";

import type { MortgageSimulatorConfig } from "@/app/(main)/dashboard/family-budget/mortgage/_components/mortgage-types";
import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getMortgageStore } from "@/server/mortgage/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScenarioRequestBody {
  action?: string;
  id?: string;
  name?: string;
  isPrimary?: boolean;
  config?: Partial<MortgageSimulatorConfig>;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const store = getMortgageStore();

  if (id) {
    const scenario = await store.get(id);
    if (!scenario) {
      return jsonError(`Scenario not found: ${id}`, 404);
    }
    return NextResponse.json({ scenario });
  }

  const scenarios = await store.list();
  return NextResponse.json({ scenarios });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: ScenarioRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as ScenarioRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const store = getMortgageStore();

  if (body.action === "set_primary") {
    if (!body.id || typeof body.id !== "string") {
      return jsonError("Scenario id is required to set as primary", 400);
    }
    try {
      const scenario = await store.setPrimary(body.id);
      return NextResponse.json({ scenario });
    } catch (err: unknown) {
      return jsonError(getErrorMessage(err, "Failed to set primary scenario"), 404);
    }
  }

  if (body.action === "duplicate") {
    if (!body.id || typeof body.id !== "string") {
      return jsonError("Scenario id is required to duplicate", 400);
    }
    try {
      const scenario = await store.duplicate(body.id, body.name);
      return NextResponse.json({ scenario }, { status: 201 });
    } catch (err: unknown) {
      return jsonError(getErrorMessage(err, "Failed to duplicate scenario"), 404);
    }
  }

  // Standard scenario creation
  try {
    const scenario = await store.create({
      id: body.id,
      name: body.name,
      isPrimary: body.isPrimary,
      config: body.config,
    });
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to create scenario"), 400);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: ScenarioRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as ScenarioRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.id || typeof body.id !== "string") {
    return jsonError("Scenario id is required for update", 400);
  }

  const store = getMortgageStore();
  try {
    const scenario = await store.update(body.id, {
      name: body.name,
      isPrimary: body.isPrimary,
      config: body.config,
    });
    return NextResponse.json({ scenario });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to update scenario"), 404);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");

  if (!id) {
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        const body = JSON.parse(text) as ScenarioRequestBody;
        id = body.id ?? null;
      }
    } catch {
      // Ignore body parse errors if id wasn't in body
    }
  }

  if (!id || typeof id !== "string") {
    return jsonError("Scenario id is required for deletion", 400);
  }

  const store = getMortgageStore();
  const deleted = await store.delete(id);
  if (!deleted) {
    return jsonError(`Scenario not found: ${id}`, 404);
  }

  return NextResponse.json({ success: true, id });
}
