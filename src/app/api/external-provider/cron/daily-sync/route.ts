import { type NextRequest, NextResponse } from "next/server";

import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getExternalProviderStore } from "@/server/external-provider/db";
import { runExternalProviderSync } from "@/server/external-provider/sync";
import { serverLogger } from "@/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}

async function handleCron(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else if (isAuthBypassActive()) {
    authorized = true;
  } else {
    const session = await getSessionFromRequest(request);
    if (session) {
      authorized = true;
    }
  }

  if (!authorized) {
    return jsonError("Unauthorized", 401);
  }

  const nowIso = new Date().toISOString();
  const store = getExternalProviderStore();

  const syncResult = await runExternalProviderSync({
    tier: "hot",
    escalateIfBalanceChanged: true,
  });

  await store.updateSyncConfig({
    last_cron_run_at: nowIso,
  });

  if (!syncResult.success) {
    serverLogger.error("Vercel Cron daily sync failed", {
      tier: syncResult.tier,
      error: syncResult.error,
    });
    return NextResponse.json(
      {
        error: {
          message: syncResult.error ?? "Cron daily sync failed",
          syncResult,
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    last_cron_run_at: nowIso,
    syncResult,
  });
}
