import { NextResponse } from "next/server";

import { upsertCategoriesSchema } from "@/lib/schemas/external-provider";
import { upsertCategories } from "@/server/services/external-provider-service";

import { handleV1, parseJsonBody } from "../../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PUT(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const body = await parseJsonBody(request, upsertCategoriesSchema);
    const updated = await upsertCategories(ctx, body);
    return NextResponse.json(updated);
  });
}
