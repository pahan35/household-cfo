import { NextResponse } from "next/server";

import { triggerSyncSchema } from "@/lib/schemas/external-provider";
import { triggerSync } from "@/server/services/external-provider-service";

import { handleV1, parseJsonBody } from "../../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    let body = {};
    const text = await request.clone().text();
    if (text.trim().length > 0) {
      body = await parseJsonBody(request, triggerSyncSchema);
    }
    const result = await triggerSync(ctx, body);
    return NextResponse.json(result);
  });
}
