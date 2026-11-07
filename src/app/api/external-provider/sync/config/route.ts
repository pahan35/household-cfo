import { type NextRequest, NextResponse } from "next/server";

import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getExternalProviderStore } from "@/server/external-provider/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

const ALLOWED_HOT_PULL_MONTHS = new Set([1, 3, 6, 12]);
const ALLOWED_AUTO_POLL_INTERVALS = new Set([0, 5, 15, 60]);

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: { hot_pull_months?: unknown; auto_poll_interval_minutes?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updates: Record<string, number> = {};

  if (body.hot_pull_months !== undefined) {
    const val = Number(body.hot_pull_months);
    if (!ALLOWED_HOT_PULL_MONTHS.has(val)) {
      return jsonError(`Invalid hot_pull_months: ${val}. Must be 1, 3, 6, or 12.`, 400);
    }
    updates.hot_pull_months = val;
  }

  if (body.auto_poll_interval_minutes !== undefined) {
    const val = Number(body.auto_poll_interval_minutes);
    if (!ALLOWED_AUTO_POLL_INTERVALS.has(val)) {
      return jsonError(`Invalid auto_poll_interval_minutes: ${val}. Must be 0, 5, 15, or 60.`, 400);
    }
    updates.auto_poll_interval_minutes = val;
  }

  const store = getExternalProviderStore();
  const updatedConfig = await store.updateSyncConfig(updates);

  return NextResponse.json({
    success: true,
    syncConfig: updatedConfig,
  });
}
