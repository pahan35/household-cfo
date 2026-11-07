import { type NextRequest, NextResponse } from "next/server";

import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getExternalProviderStore } from "@/server/external-provider/db";
import { runExternalProviderSync, type SyncTier } from "@/server/external-provider/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  const { searchParams } = new URL(request.url);
  const sinceVersionParam = searchParams.get("sinceVersion");
  const sinceVersion = sinceVersionParam !== null ? Number(sinceVersionParam) : null;

  const store = getExternalProviderStore();
  let config = await store.getSyncConfig();

  // If database has never had a full sync, trigger bootstrap
  if (!config.last_full_reconcile_at && config.sync_version === 0) {
    await runExternalProviderSync({ tier: "cold" });
    config = await store.getSyncConfig();
  }

  if (sinceVersion !== null && !Number.isNaN(sinceVersion) && sinceVersion === config.sync_version) {
    return NextResponse.json({
      upToDate: true,
      syncVersion: config.sync_version,
      syncConfig: config,
    });
  }

  const snapshot = await store.getFullSnapshot();
  return NextResponse.json({
    upToDate: false,
    syncVersion: config.sync_version,
    syncConfig: config,
    snapshot,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: { tier?: SyncTier; force?: boolean } = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text);
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const tier = body.tier ?? "hot";
  if (!["hot", "warm", "cold"].includes(tier)) {
    return jsonError(`Invalid sync tier: "${tier}". Expected "hot", "warm", or "cold".`, 400);
  }

  const syncResult = await runExternalProviderSync({
    tier,
    force: body.force ?? true,
  });

  const store = getExternalProviderStore();
  const snapshot = await store.getFullSnapshot();

  return NextResponse.json({
    ...syncResult,
    snapshot,
  });
}
