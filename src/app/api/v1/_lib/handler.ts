import "server-only";

import { NextResponse } from "next/server";

import type { z } from "zod";

import { resolveRequestAuth } from "@/server/auth/mobile";
import { type AuthContext, ServiceError, serviceErrorStatus } from "@/server/services/types";

export function jsonError(message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ error: { message, ...(details === undefined ? {} : { details }) } }, { status });
}

/** Authenticates the request and maps `ServiceError`/unexpected failures to JSON responses. */
export async function handleV1(
  request: Request,
  handler: (ctx: AuthContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const ctx = await resolveRequestAuth(request);
  if (!ctx) {
    return jsonError("Unauthorized", 401);
  }

  try {
    return await handler(ctx);
  } catch (err) {
    if (err instanceof ServiceError) {
      return jsonError(err.message, serviceErrorStatus(err));
    }
    return jsonError("Internal server error", 500);
  }
}

/** Parses and validates a JSON body; throws a 400 `ServiceError` on failure. */
export async function parseJsonBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    const text = await request.text();
    raw = text.trim().length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new ServiceError("invalid", "Invalid JSON body");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ServiceError("invalid", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
