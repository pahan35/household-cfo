import { type NextRequest, NextResponse } from "next/server";

import { isAllowedFocusedPath, isFocusedMode } from "@/config/app-mode";
import { isAuthBypassActive } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";

const PUBLIC_PATH_PREFIXES = ["/_next", "/auth", "/api/auth", "/unauthorized"];

const STATIC_FILE_EXTENSIONS = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff|woff2|ttf|eot)$/i;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") {
    return true;
  }

  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  if (STATIC_FILE_EXTENSIONS.test(pathname)) {
    return true;
  }

  return false;
}

/**
 * Next.js 16 Proxy: runs before requests complete.
 * Enforces session authentication or local development bypass.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Allow static files, auth endpoints, and public pages
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check authorization (either local bypass or valid session token)
  const isAuthorized = isAuthBypassActive() || Boolean(await getSessionFromRequest(request));

  if (!isAuthorized) {
    // Unauthenticated API request
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    // Unauthenticated page request -> redirect to login
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    const isDefaultHome = pathname === "/" || pathname === "/dashboard" || pathname === "/dashboard/default";
    const isDisallowedFocused = isFocusedMode() && !isAllowedFocusedPath(pathname);
    if (!isDefaultHome && !isDisallowedFocused) {
      loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    }

    return NextResponse.redirect(loginUrl, 302);
  }

  // Enforce focused deployment mode boundary for authorized page requests
  if (isFocusedMode() && !pathname.startsWith("/api/") && !isAllowedFocusedPath(pathname)) {
    const targetUrl = new URL("/dashboard/family-budget", request.nextUrl.origin);
    return NextResponse.redirect(targetUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
