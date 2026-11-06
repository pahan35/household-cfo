import { type NextRequest, NextResponse } from "next/server";

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

  // Allow local development bypass when active
  if (isAuthBypassActive()) {
    return NextResponse.next();
  }

  // Verify session cookie
  const session = await getSessionFromRequest(request);
  if (session) {
    return NextResponse.next();
  }

  // Unauthenticated API request
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  // Unauthenticated page request -> redirect to login
  const loginUrl = new URL("/auth/login", request.nextUrl.origin);
  if (pathname !== "/" && pathname !== "/dashboard" && pathname !== "/dashboard/default") {
    loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
  }

  return NextResponse.redirect(loginUrl, 302);
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
