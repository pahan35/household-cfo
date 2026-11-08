import { NextResponse } from "next/server";

import { z } from "zod";

import { screenLogBatchSchema, screenLogSchema } from "@/lib/schemas/screen-log";
import { ingestScreenLogs, listWeeklyLogs } from "@/server/services/screen-log-service";

import { handleV1, parseJsonBody } from "../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.union([screenLogBatchSchema, screenLogSchema.transform((log) => ({ logs: [log] }))]);

export function GET(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => NextResponse.json({ weeklyLogs: await listWeeklyLogs(ctx) }));
}

export function POST(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const { logs } = await parseJsonBody(request, bodySchema);
    return NextResponse.json(await ingestScreenLogs(ctx, logs), { status: 201 });
  });
}
