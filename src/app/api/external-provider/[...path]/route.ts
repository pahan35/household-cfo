import { type NextRequest, NextResponse } from "next/server";

import { buildProxyCacheKey, fetchWithProxyCache, invalidateProxyCacheByPathPrefix } from "@/server/external-provider/cache";
import {
  ALLOWED_METHODS,
  isAllowedPath,
  REQUEST_HEADER_ALLOWLIST,
  RESPONSE_HEADER_ALLOWLIST,
  UPSTREAM_ORIGIN,
} from "@/server/external-provider/config";
import { buildUpstreamErrorBody, scrubSecrets } from "@/server/external-provider/http";
import { getUpstreamToken, getWebCredentials, MissingTokenError } from "@/server/external-provider/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatchAllContext = { params: Promise<{ path: string[] }> };

/**
 * Adds `userId` to a JSON request body for upstream routes that require it
 * (`/api/transaction/get`). The value comes from the keychain and is injected
 * server-side; malformed or empty bodies are passed through untouched.
 */
function injectUserId(rawBody: ArrayBuffer, userId: string | undefined): ArrayBuffer {
  if (rawBody.byteLength === 0 || userId === undefined || userId.length === 0) {
    return rawBody;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(rawBody)) as Record<string, unknown>;
    parsed.userId = /^\d+$/.test(userId) ? Number(userId) : userId;
    const encoded = new TextEncoder().encode(JSON.stringify(parsed));
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  } catch {
    return rawBody;
  }
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

/**
 * Server-side proxy for the upstream ExternalProvider API.
 *
 * The upstream token is resolved on the server and never leaves it. Callers use
 * this route unauthenticated, so no browser-visible code or client bundle ever
 * holds the credential.
 */
async function handler(request: NextRequest, context: CatchAllContext): Promise<NextResponse> {
  const { path: segments } = await context.params;
  const method = request.method.toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    return jsonError(`Method ${method} is not allowed by the proxy.`, 405);
  }

  const upstreamPath = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;

  if (!isAllowedPath(upstreamPath)) {
    return jsonError(`Path ${upstreamPath} is not in the proxy allowlist.`, 403);
  }

  // Prefer the user's keychain-stored web session cookie (Track B); fall back
  // to the legacy keychain Bearer token (Track A negative control).
  const webCreds = await getWebCredentials();
  const headers = new Headers({ accept: "application/json" });
  let secrets: string[];

  if (webCreds === undefined) {
    let token: string;
    try {
      token = await getUpstreamToken();
    } catch (error) {
      if (error instanceof MissingTokenError) {
        return jsonError(error.message, 503);
      }
      throw error;
    }
    headers.set("authorization", `Bearer ${token}`);
    secrets = [token];
  } else {
    headers.set("cookie", webCreds.cookie);
    secrets = webCreds.userId !== undefined ? [webCreds.cookie, webCreds.userId] : [webCreds.cookie];
  }

  const target = new URL(upstreamPath, UPSTREAM_ORIGIN);
  target.search = request.nextUrl.search;

  if (upstreamPath === "/stat/ping" && target.searchParams.has("ts")) {
    target.searchParams.delete("ts");
  }

  for (const name of REQUEST_HEADER_ALLOWLIST) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  let requestBody = method === "GET" ? undefined : await request.arrayBuffer();
  if (webCreds !== undefined && requestBody !== undefined && upstreamPath.startsWith("/api/transaction/")) {
    requestBody = injectUserId(requestBody, webCreds.userId);
  }

  let isExchangeWritePayload = false;
  if (upstreamPath === "/Exchange/Ping" && method === "POST" && requestBody && requestBody.byteLength > 0) {
    try {
      const parsedBody = JSON.parse(new TextDecoder().decode(requestBody)) as {
        items?: Array<{ entityJson?: unknown }>;
      };
      if (Array.isArray(parsedBody.items)) {
        isExchangeWritePayload = parsedBody.items.some(
          (item) => item.entityJson !== null && item.entityJson !== undefined,
        );
      }
    } catch {
      // malformed or non-JSON body
    }
  }

  const isTransactionWrite =
    method === "POST" && (upstreamPath === "/api/transaction/create" || upstreamPath === "/api/transaction/update");

  if (isExchangeWritePayload) {
    invalidateProxyCacheByPathPrefix("/Exchange/Ping");
  }
  if (isTransactionWrite) {
    invalidateProxyCacheByPathPrefix("/api/transaction");
    invalidateProxyCacheByPathPrefix("/Exchange/Ping");
    invalidateProxyCacheByPathPrefix("/stat/ping");
  }

  const cacheControl = request.headers.get("cache-control")?.toLowerCase() ?? "";
  const bypassCache =
    cacheControl.includes("no-cache") ||
    cacheControl.includes("max-age=0") ||
    isExchangeWritePayload ||
    isTransactionWrite;
  const isCacheable = (method === "GET" || method === "POST") && !isExchangeWritePayload && !isTransactionWrite;

  try {
    if (!isCacheable) {
      const upstreamResponse = await fetch(target, {
        method,
        headers,
        body: requestBody,
        cache: "no-store",
        redirect: "error",
      });

      if (isExchangeWritePayload) {
        invalidateProxyCacheByPathPrefix("/Exchange/Ping");
      }
      if (isTransactionWrite) {
        invalidateProxyCacheByPathPrefix("/api/transaction");
        invalidateProxyCacheByPathPrefix("/Exchange/Ping");
        invalidateProxyCacheByPathPrefix("/stat/ping");
      }

      if (!upstreamResponse.ok) {
        const upstreamBody = await upstreamResponse.text().catch(() => "");
        const body = buildUpstreamErrorBody(
          upstreamResponse.status,
          upstreamResponse.statusText,
          upstreamBody,
          secrets,
        );

        return new NextResponse(body, {
          headers: { "content-type": "application/json" },
          status: upstreamResponse.status,
        });
      }

      const responseHeaders = new Headers();
      for (const name of RESPONSE_HEADER_ALLOWLIST) {
        const value = upstreamResponse.headers.get(name);
        if (value !== null) {
          responseHeaders.set(name, value);
        }
      }

      return new NextResponse(upstreamResponse.body, {
        headers: responseHeaders,
        status: upstreamResponse.status,
      });
    }

    const cacheKey = buildProxyCacheKey(method, upstreamPath, target.search, requestBody);
    const cachedResponse = await fetchWithProxyCache(
      cacheKey,
      async () => {
        const upstreamResponse = await fetch(target, {
          method,
          headers,
          body: requestBody,
          cache: "no-store",
          redirect: "error",
        });

        if (!upstreamResponse.ok) {
          const upstreamBody = await upstreamResponse.text().catch(() => "");
          const body = buildUpstreamErrorBody(
            upstreamResponse.status,
            upstreamResponse.statusText,
            upstreamBody,
            secrets,
          );

          return {
            status: upstreamResponse.status,
            headers: [["content-type", "application/json"]],
            body: new TextEncoder().encode(body),
            expiresAt: 0,
          };
        }

        const responseHeaders: [string, string][] = [];
        for (const name of RESPONSE_HEADER_ALLOWLIST) {
          const value = upstreamResponse.headers.get(name);
          if (value !== null) {
            responseHeaders.push([name, value]);
          }
        }

        const bodyBuffer = await upstreamResponse.arrayBuffer();
        return {
          status: upstreamResponse.status,
          headers: responseHeaders,
          body: new Uint8Array(bodyBuffer),
          expiresAt: 0,
        };
      },
      { bypassCache },
    );

    const responseHeaders = new Headers(cachedResponse.headers);
    return new NextResponse(Buffer.from(cachedResponse.body), {
      headers: responseHeaders,
      status: cachedResponse.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(`Upstream request failed: ${scrubSecrets(message, ...secrets)}`, 502);
  }
}

export const DELETE = handler;
export const GET = handler;
export const PATCH = handler;
export const POST = handler;
export const PUT = handler;
