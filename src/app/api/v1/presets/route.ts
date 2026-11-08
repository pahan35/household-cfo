import { NextResponse } from "next/server";

import { z } from "zod";

import {
  deletePresetSchema,
  savePresetsSchema,
  setActivePresetSchema,
  upsertPresetSchema,
} from "@/lib/schemas/presets";
import {
  deletePreset,
  listPresets,
  savePresets,
  seedPresetsIfEmpty,
  setActivePreset,
  upsertPreset,
} from "@/server/services/presets-service";
import { ServiceError } from "@/server/services/types";

import { handleV1, parseJsonBody } from "../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  savePresetsSchema.extend({ action: z.literal("seed_if_empty") }),
  savePresetsSchema.extend({ action: z.literal("save_all") }),
  setActivePresetSchema.extend({ action: z.literal("set_active") }),
  upsertPresetSchema.extend({ action: z.literal("upsert_preset") }),
  deletePresetSchema.extend({ action: z.literal("delete_preset") }),
]);

export function GET(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => NextResponse.json(await listPresets(ctx)));
}

export function POST(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const body = await parseJsonBody(request, bodySchema);
    switch (body.action) {
      case "seed_if_empty":
        return NextResponse.json(await seedPresetsIfEmpty(ctx, body));
      case "save_all":
        return NextResponse.json(await savePresets(ctx, body));
      case "set_active":
        return NextResponse.json(await setActivePreset(ctx, body));
      case "upsert_preset":
        return NextResponse.json(await upsertPreset(ctx, body));
      case "delete_preset":
        return NextResponse.json(await deletePreset(ctx, body));
      default:
        throw new ServiceError("invalid", "Unknown action");
    }
  });
}
