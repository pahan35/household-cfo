import { type NextRequest, NextResponse } from "next/server";

import { getAllowedUserEmails, getAuthConfig, isEmailAllowed } from "@/server/auth/config";
import {
  attachSessionCookie,
  clearSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  type SessionUser,
} from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatchAllContext = { params: Promise<{ auth: string[] }> };

const OAUTH_STATE_COOKIE = "family_budget_oauth_state";

function getRedirectUri(request: NextRequest, env = process.env): string {
  if (env.GOOGLE_REDIRECT_URI) {
    return env.GOOGLE_REDIRECT_URI;
  }
  const host = request.headers.get("x-forwarded-host") || request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}/api/auth/callback`;
}

function generateRandomString(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: NextRequest, context: CatchAllContext): Promise<NextResponse> {
  return handleAuth(request, context);
}

export async function POST(request: NextRequest, context: CatchAllContext): Promise<NextResponse> {
  return handleAuth(request, context);
}

async function handleAuth(request: NextRequest, context: CatchAllContext): Promise<NextResponse> {
  const { auth: segments } = await context.params;
  const action = segments[0]?.toLowerCase();

  switch (action) {
    case "login":
    case "signin":
      return handleLogin(request);

    case "callback":
      return handleCallback(request);

    case "logout":
    case "signout":
      return handleLogout(request);

    case "session":
    case "me":
      return handleGetSession(request);

    default:
      return NextResponse.json({ error: { message: `Unknown auth action: ${action}` } }, { status: 404 });
  }
}

function handleLogin(request: NextRequest): NextResponse {
  const config = getAuthConfig();
  if (!config.clientId) {
    return NextResponse.json({ error: { message: "Google OAuth client ID is not configured." } }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get("returnTo") || "/dashboard/default";

  // Prevent open-redirects: returnTo must start with "/" and not "//"
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard/default";

  const state = generateRandomString(32);
  const redirectUri = getRedirectUri(request);

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", config.clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("access_type", "online");

  const response = NextResponse.redirect(googleAuthUrl.toString(), 302);
  const statePayload = JSON.stringify({ state, returnTo: safeReturnTo });

  response.cookies.set(OAUTH_STATE_COOKIE, statePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}

async function handleCallback(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const errorParam = searchParams.get("error");
  if (errorParam) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", errorParam);
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let returnTo = "/dashboard/default";

  if (!state || !stateCookie) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  try {
    const parsedState = JSON.parse(stateCookie) as { state: string; returnTo?: string };
    if (parsedState.state !== state) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin);
      loginUrl.searchParams.set("error", "state_mismatch");
      return NextResponse.redirect(loginUrl.toString(), 302);
    }
    if (parsedState.returnTo && parsedState.returnTo.startsWith("/") && !parsedState.returnTo.startsWith("//")) {
      returnTo = parsedState.returnTo;
    }
  } catch {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "malformed_state");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  if (!code) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  const config = getAuthConfig();
  const redirectUri = getRedirectUri(request);

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "token_exchange_failed");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokenData.access_token) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "missing_access_token");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  // Fetch Google User Profile
  const userinfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userinfoRes.ok) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "userinfo_failed");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  const profile = (await userinfoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  // Require verified email
  if (!profile.email || profile.email_verified !== true) {
    const unauthorizedUrl = new URL("/unauthorized", request.nextUrl.origin);
    unauthorizedUrl.searchParams.set("reason", "unverified_email");
    const response = NextResponse.redirect(unauthorizedUrl.toString(), 302);
    clearSessionCookie(response);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  // Require presence in ALLOWED_USER_EMAILS
  if (!isEmailAllowed(profile.email)) {
    const unauthorizedUrl = new URL("/unauthorized", request.nextUrl.origin);
    const response = NextResponse.redirect(unauthorizedUrl.toString(), 302);
    clearSessionCookie(response);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  // Success: create signed session
  const user: SessionUser = {
    email: profile.email.toLowerCase(),
    name: profile.name,
    picture: profile.picture,
  };

  const sessionToken = await createSessionToken(user);
  const targetUrl = new URL(returnTo, request.nextUrl.origin);
  const response = NextResponse.redirect(targetUrl.toString(), 302);

  attachSessionCookie(response, sessionToken);
  response.cookies.delete(OAUTH_STATE_COOKIE);

  return response;
}

function handleLogout(request: NextRequest): NextResponse {
  const loginUrl = new URL("/auth/login", request.nextUrl.origin);
  const response = NextResponse.redirect(loginUrl.toString(), 302);
  clearSessionCookie(response);
  return response;
}

async function handleGetSession(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
