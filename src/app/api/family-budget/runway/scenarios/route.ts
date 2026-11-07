import { type NextRequest, NextResponse } from "next/server";

import type {
  AusterityPreset,
  CapitalPoolConfig,
  CategoryAusterityWeight,
  JdgRunwayConfig,
  LookbackWindow,
} from "@/app/(main)/dashboard/family-budget/runway/_components/runway-types";
import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getRunwayStore } from "@/server/runway/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RunwayScenarioRequestBody {
  action?: string;
  id?: string;
  name?: string;
  isPrimary?: boolean;
  jdgConfig?: Partial<JdgRunwayConfig>;
  capitalPoolConfig?: Partial<CapitalPoolConfig>;
  lookbackWindow?: LookbackWindow;
  activePresetId?: string;
  customPresets?: AusterityPreset[];
  categoryCuts?: Record<string, CategoryAusterityWeight>;
  baselineOfferRevisionId?: string | null;
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
  const store = getRunwayStore();

  if (id) {
    const scenario = await store.get(id);
    if (!scenario) {
      return jsonError(`Runway scenario not found: ${id}`, 404);
    }

    const includeOffer = searchParams.get("include_offer") === "true";
    let linkedOfferRevision = null;
    if (includeOffer && scenario.baselineOfferRevisionId) {
      linkedOfferRevision = await store.getLinkedOfferRevision(id);
    }

    return NextResponse.json({ scenario, linkedOfferRevision });
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

  let body: RunwayScenarioRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as RunwayScenarioRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const store = getRunwayStore();

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
      jdgConfig: body.jdgConfig,
      capitalPoolConfig: body.capitalPoolConfig,
      lookbackWindow: body.lookbackWindow,
      activePresetId: body.activePresetId,
      customPresets: body.customPresets,
      categoryCuts: body.categoryCuts,
      baselineOfferRevisionId: body.baselineOfferRevisionId,
    });
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to create runway scenario"), 500);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: RunwayScenarioRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as RunwayScenarioRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.id || typeof body.id !== "string") {
    return jsonError("Scenario id is required for updates", 400);
  }

  const store = getRunwayStore();
  try {
    const scenario = await store.update(body.id, {
      name: body.name,
      isPrimary: body.isPrimary,
      jdgConfig: body.jdgConfig,
      capitalPoolConfig: body.capitalPoolConfig,
      lookbackWindow: body.lookbackWindow,
      activePresetId: body.activePresetId,
      customPresets: body.customPresets,
      categoryCuts: body.categoryCuts,
      baselineOfferRevisionId: body.baselineOfferRevisionId,
    });
    return NextResponse.json({ scenario });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to update runway scenario"), 404);
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
        const body = JSON.parse(text) as { id?: string };
        if (body.id) id = body.id;
      }
    } catch {
      // ignore JSON parse failure on DELETE with empty body
    }
  }

  if (!id) {
    return jsonError("Scenario id is required for deletion", 400);
  }

  const store = getRunwayStore();
  try {
    const deleted = await store.delete(id);
    if (!deleted) {
      return jsonError(`Scenario not found: ${id}`, 404);
    }
    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to delete scenario"), 500);
  }
}
