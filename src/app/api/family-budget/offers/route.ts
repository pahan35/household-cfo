import { type NextRequest, NextResponse } from "next/server";

import type {
  ComparatorGlobalConfig,
  OfferTrack,
} from "@/app/(main)/dashboard/family-budget/offer-comparator/_components/offer-types";
import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { getOfferStore } from "@/server/offers/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OffersRequestBody {
  action?: string;
  track?: OfferTrack;
  tracks?: OfferTrack[];
  globalConfig?: ComparatorGlobalConfig;
  trackId?: string;
  revisionId?: string;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const store = getOfferStore();

  if (id) {
    const track = await store.getTrack(id);
    if (!track) {
      return jsonError(`Track not found: ${id}`, 404);
    }
    return NextResponse.json({ track });
  }

  const { tracks, globalConfig } = await store.loadAll();
  return NextResponse.json({ tracks, globalConfig });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: OffersRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as OffersRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const store = getOfferStore();

  try {
    if (body.action === "save_config" && body.globalConfig) {
      const savedConfig = await store.saveGlobalConfig(body.globalConfig);
      return NextResponse.json({ globalConfig: savedConfig });
    }

    if (body.action === "save_track" && body.track) {
      const savedTrack = await store.saveTrack(body.track);
      return NextResponse.json({ track: savedTrack }, { status: 201 });
    }

    if ((body.action === "save_all" || body.action === "sync") && Array.isArray(body.tracks) && body.globalConfig) {
      await store.saveAll(body.tracks, body.globalConfig);
      return NextResponse.json({ success: true, tracks: body.tracks, globalConfig: body.globalConfig });
    }

    if (body.track) {
      const savedTrack = await store.saveTrack(body.track);
      return NextResponse.json({ track: savedTrack }, { status: 201 });
    }

    if (Array.isArray(body.tracks) && body.globalConfig) {
      await store.saveAll(body.tracks, body.globalConfig);
      return NextResponse.json({ success: true, tracks: body.tracks, globalConfig: body.globalConfig });
    }

    return jsonError("Invalid request body for offers endpoint", 400);
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to process offers operation"), 500);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let body: OffersRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as OffersRequestBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!Array.isArray(body.tracks) || !body.globalConfig) {
    return jsonError("Both tracks array and globalConfig are required for PUT bulk save", 400);
  }

  const store = getOfferStore();
  try {
    await store.saveAll(body.tracks, body.globalConfig);
    return NextResponse.json({ success: true, tracks: body.tracks, globalConfig: body.globalConfig });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to perform bulk save"), 500);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get("trackId") || searchParams.get("id");
  const revisionId = searchParams.get("revisionId");

  if (!trackId) {
    return jsonError("trackId or id parameter is required", 400);
  }

  const store = getOfferStore();

  try {
    if (revisionId) {
      const deleted = await store.deleteRevision(trackId, revisionId);
      if (!deleted) {
        return jsonError(`Revision ${revisionId} not found in track ${trackId}`, 404);
      }
      return NextResponse.json({ success: true, trackId, revisionId });
    }

    const deleted = await store.deleteTrack(trackId);
    if (!deleted) {
      return jsonError(`Track ${trackId} not found`, 404);
    }
    return NextResponse.json({ success: true, id: trackId });
  } catch (err: unknown) {
    return jsonError(getErrorMessage(err, "Failed to delete track or revision"), 500);
  }
}
