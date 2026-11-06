import { type NextRequest, NextResponse } from "next/server";

import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";
import { buildProxyCacheKey, fetchWithProxyCache, invalidateProxyCacheByPathPrefix } from "@/server/external-provider/cache";
import {
  ALLOWED_METHODS,
  isAllowedPath,
  REQUEST_HEADER_ALLOWLIST,
  RESPONSE_HEADER_ALLOWLIST,
  UPSTREAM_ORIGIN,
} from "@/server/external-provider/config";
import { isRedirectError, isStaleUpstreamResponse, notifyCredentialIssue } from "@/server/external-provider/credentials";
import {
  buildUpstreamErrorBody,
  injectUserId,
  MAX_UPSTREAM_ERROR_DETAIL_LENGTH,
  scrubSecrets,
} from "@/server/external-provider/http";
import {
  type ExternalProviderSecretSource,
  getActiveSecrets,
  getExternalProviderSecretSource,
  getUpstreamToken,
  getWebCredentials,
  InvalidSecretSourceError,
  invalidateCredentialCache,
  MissingTokenError,
  type WebCredentials,
} from "@/server/external-provider/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatchAllContext = { params: Promise<{ path: string[] }> };

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

  // Defense-in-depth: require authenticated session or local dev bypass before secret resolution
  if (!isAuthBypassActive()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return jsonError("Unauthorized", 401);
    }
  }

  let secretSource: ExternalProviderSecretSource;
  try {
    secretSource = getExternalProviderSecretSource();
  } catch (error) {
    if (error instanceof InvalidSecretSourceError) {
      return jsonError(error.message, 503);
    }
    throw error;
  }

  // Prefer the web session cookie (Track B); fall back to the legacy Bearer token (Track A).
  let webCreds: WebCredentials | undefined;
  try {
    webCreds = await getWebCredentials();
  } catch (error) {
    if (error instanceof InvalidSecretSourceError) {
      return jsonError(error.message, 503);
    }
    throw error;
  }

  const headers = new Headers({ accept: "application/json" });
  let resolvedSecrets: string[];

  if (webCreds === undefined) {
    let token: string;
    try {
      token = await getUpstreamToken();
    } catch (error) {
      if (error instanceof MissingTokenError) {
        await notifyCredentialIssue({
          reason: "missing",
          source: secretSource,
          status: 503,
          upstreamPath,
          detail: error.message,
        });
        return jsonError(error.message, 503);
      }
      if (error instanceof InvalidSecretSourceError) {
        return jsonError(error.message, 503);
      }
      throw error;
    }
    headers.set("authorization", `Bearer ${token}`);
    resolvedSecrets = [token];
  } else {
    headers.set("cookie", webCreds.cookie);
    resolvedSecrets = webCreds.userId !== undefined ? [webCreds.cookie, webCreds.userId] : [webCreds.cookie];
  }

  // Scrub all resolved and configured environment secrets across both Keychain and env modes
  const secrets = [...new Set([...resolvedSecrets, ...getActiveSecrets()])].filter(Boolean);

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
  if (webCreds !== undefined && requestBody !== undefined && upstreamPath === "/api/transaction/get") {
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
    invalidateProxyCacheByPathPrefix("/stat/ping");
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
        invalidateProxyCacheByPathPrefix("/stat/ping");
      }
      if (isTransactionWrite) {
        invalidateProxyCacheByPathPrefix("/api/transaction");
        invalidateProxyCacheByPathPrefix("/Exchange/Ping");
        invalidateProxyCacheByPathPrefix("/stat/ping");
      }

      const contentType = upstreamResponse.headers.get("content-type");
      const isHtmlPayload = Boolean(contentType?.toLowerCase().includes("text/html"));

      if (!upstreamResponse.ok || isHtmlPayload) {
        const upstreamBody = await upstreamResponse.text().catch(() => "");
        const scrubbedError = scrubSecrets(upstreamBody, ...secrets);

        const isStale = isStaleUpstreamResponse({
          status: upstreamResponse.status,
          contentType,
          bodyText: upstreamBody,
        });

        if (isStale) {
          invalidateCredentialCache();
          const effectiveStatus = upstreamResponse.ok ? 401 : upstreamResponse.status;
          await notifyCredentialIssue({
            reason: "stale",
            source: secretSource,
            status: effectiveStatus,
            upstreamPath,
            detail: scrubbedError.slice(0, MAX_UPSTREAM_ERROR_DETAIL_LENGTH),
          });
          console.error(
            `[External API Proxy] ${method} ${upstreamPath} -> ${effectiveStatus} (stale credentials: ${scrubbedError})`,
          );
          const body = JSON.stringify({
            error: {
              message: "Upstream authentication failed (stale or rejected credentials)",
              code: "stale_credentials",
              detail: scrubbedError.slice(0, MAX_UPSTREAM_ERROR_DETAIL_LENGTH),
            },
          });
          return new NextResponse(body, {
            headers: { "content-type": "application/json" },
            status: effectiveStatus,
          });
        }

        console.error(
          `[External API Proxy] ${method} ${upstreamPath} -> ${upstreamResponse.status} (upstream error: ${scrubbedError})`,
        );
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

      const statusMsg = upstreamResponse.statusText
        ? `${upstreamResponse.status} ${upstreamResponse.statusText}`
        : `${upstreamResponse.status} OK`;
      console.log(`[External API Proxy] ${method} ${upstreamPath} -> ${statusMsg}`);

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

        const contentType = upstreamResponse.headers.get("content-type");
        const isHtmlPayload = Boolean(contentType?.toLowerCase().includes("text/html"));

        if (!upstreamResponse.ok || isHtmlPayload) {
          const upstreamBody = await upstreamResponse.text().catch(() => "");
          const scrubbedError = scrubSecrets(upstreamBody, ...secrets);

          const isStale = isStaleUpstreamResponse({
            status: upstreamResponse.status,
            contentType,
            bodyText: upstreamBody,
          });

          if (isStale) {
            invalidateCredentialCache();
            const effectiveStatus = upstreamResponse.ok ? 401 : upstreamResponse.status;
            await notifyCredentialIssue({
              reason: "stale",
              source: secretSource,
              status: effectiveStatus,
              upstreamPath,
              detail: scrubbedError.slice(0, MAX_UPSTREAM_ERROR_DETAIL_LENGTH),
            });
            console.error(
              `[External API Proxy] ${method} ${upstreamPath} -> ${effectiveStatus} (stale credentials: ${scrubbedError})`,
            );
            const body = JSON.stringify({
              error: {
                message: "Upstream authentication failed (stale or rejected credentials)",
                code: "stale_credentials",
                detail: scrubbedError.slice(0, MAX_UPSTREAM_ERROR_DETAIL_LENGTH),
              },
            });
            return {
              status: effectiveStatus,
              headers: [["content-type", "application/json"]],
              body: new TextEncoder().encode(body),
              expiresAt: 0,
            };
          }

          console.error(
            `[External API Proxy] ${method} ${upstreamPath} -> ${upstreamResponse.status} (upstream error: ${scrubbedError})`,
          );
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
    const scrubbed = scrubSecrets(message, ...secrets);

    if (isRedirectError(error)) {
      invalidateCredentialCache();
      await notifyCredentialIssue({
        reason: "stale",
        source: secretSource,
        status: 401,
        upstreamPath,
        detail: scrubbed,
      });
      console.error(`[External API Proxy] ${method} ${upstreamPath} -> 401 (redirect error: ${scrubbed})`);
      return new NextResponse(
        JSON.stringify({
          error: {
            message: "Upstream authentication failed (unexpected redirect to login)",
            code: "stale_credentials",
            detail: scrubbed,
          },
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      );
    }

    console.error(`[External API Proxy] ${method} ${upstreamPath} -> Error: ${scrubbed}`);
    return jsonError(`Upstream request failed: ${scrubbed}`, 502);
  }
}

export const DELETE = handler;
export const GET = handler;
export const PATCH = handler;
export const POST = handler;
export const PUT = handler;
