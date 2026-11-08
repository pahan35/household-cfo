import { NextResponse } from "next/server";

import { snapshotQuerySchema } from "@/lib/schemas/external-provider";
import { getSnapshot } from "@/server/services/external-provider-service";

import { handleV1 } from "../../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const url = new URL(request.url);
    const rawSinceVersion = url.searchParams.get("sinceVersion");
    const query = snapshotQuerySchema.parse({
      sinceVersion: rawSinceVersion !== null ? rawSinceVersion : undefined,
    });
    const snapshot = await getSnapshot(ctx, query);
    return NextResponse.json(snapshot);
  });
}
