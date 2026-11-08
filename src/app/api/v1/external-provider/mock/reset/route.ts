import { NextResponse } from "next/server";

import { resetMockExternalProvider } from "@/server/services/external-provider-service";

import { handleV1 } from "../../../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const snapshot = await resetMockExternalProvider(ctx);
    return NextResponse.json(snapshot);
  });
}
