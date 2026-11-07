import { type NextRequest, NextResponse } from "next/server";

import type { ExclusionPreset } from "@/app/(main)/dashboard/family-budget/_components/expense-transforms";
import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getPresetStore } from "@/server/presets/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PresetsRequestBody {
  action?: "seed_if_empty" | "set_active" | "upsert_preset" | "save_all" | "delete_preset";
  presets?: ExclusionPreset[];
  activePresetId?: string;
  preset?: ExclusionPreset;
  presetId?: string;
  makeActive?: boolean;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

async function verifyAuth(request: NextRequest): Promise<boolean> {
  if (isAuthBypassActive()) {
    return true;
  }
  const session = await getSessionFromRequest(request);
  return Boolean(session);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAuth(request))) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const store = getPresetStore();
    const data = await store.loadAll();
    return NextResponse.json({ presets: data.presets, activePresetId: data.activePresetId });
  } catch (err) {
    return jsonError(getErrorMessage(err, "Failed to load presets"), 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyAuth(request))) {
    return jsonError("Unauthorized", 401);
  }

  let body: PresetsRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as PresetsRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const store = getPresetStore();

  try {
    if (body.action === "seed_if_empty") {
      if (!Array.isArray(body.presets)) {
        return jsonError("Presets array is required for seed_if_empty", 400);
      }
      const result = await store.seedIfEmpty(body.presets, body.activePresetId);
      return NextResponse.json({ presets: result.presets, activePresetId: result.activePresetId });
    }

    if (body.action === "set_active") {
      if (!body.activePresetId) {
        return jsonError("activePresetId is required for set_active", 400);
      }
      const activePresetId = await store.setActive(body.activePresetId);
      return NextResponse.json({ ok: true, activePresetId });
    }

    if (body.action === "upsert_preset" || body.preset) {
      if (!body.preset?.id || !body.preset.name) {
        return jsonError("Valid preset object with id and name is required", 400);
      }
      const saved = await store.upsertPreset(body.preset, body.makeActive);
      const all = await store.loadAll();
      return NextResponse.json({ preset: saved, activePresetId: all.activePresetId, presets: all.presets });
    }

    if (body.action === "save_all") {
      if (!Array.isArray(body.presets)) {
        return jsonError("Presets array is required for save_all", 400);
      }
      const result = await store.saveAll(body.presets, body.activePresetId);
      return NextResponse.json({ presets: result.presets, activePresetId: result.activePresetId });
    }

    if (body.action === "delete_preset" || body.presetId) {
      const targetId = body.presetId ?? (body as PresetsRequestBody).preset?.id;
      if (!targetId) {
        return jsonError("presetId is required for deletion", 400);
      }
      const deleted = await store.deletePreset(targetId);
      const all = await store.loadAll();
      return NextResponse.json({ ok: deleted, presets: all.presets, activePresetId: all.activePresetId });
    }

    return jsonError("Unknown or missing action", 400);
  } catch (err) {
    return jsonError(getErrorMessage(err, "Failed to process preset action"), 500);
  }
}
