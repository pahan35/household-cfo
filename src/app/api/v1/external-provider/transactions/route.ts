import { NextResponse } from "next/server";

import { createTransactionsSchema, updateTransactionSchema } from "@/lib/schemas/external-provider";
import { createTransactions, updateTransaction } from "@/server/services/external-provider-service";

import { handleV1, parseJsonBody } from "../../_lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const body = await parseJsonBody(request, createTransactionsSchema);
    const created = await createTransactions(ctx, body);
    return NextResponse.json(created, { status: 201 });
  });
}

export function PATCH(request: Request): Promise<NextResponse> {
  return handleV1(request, async (ctx) => {
    const body = await parseJsonBody(request, updateTransactionSchema);
    const updated = await updateTransaction(ctx, body);
    return NextResponse.json(updated);
  });
}
