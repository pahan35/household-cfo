import { type NextRequest, NextResponse } from "next/server";

import { getHomeUrl } from "@/config/app-mode";
import { getAuthConfig, getCanonicalAuthUrl, isAllowedPreviewOrigin, isEmailAllowed } from "@/server/auth/config";
import {
  attachSessionCookie,
  clearSessionCookie,
  createOAuthStateToken,
  createSessionToken,
  getSessionFromRequest,
  type OAuthStatePayload,
  type SessionUser,
  verifyOAuthStateToken,
} from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatchAllContext = { params: Promise<{ auth: string[] }> };

const OAUTH_STATE_COOKIE = "family_budget_oauth_state";

function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`.toLowerCase();
}

function getInitiationRedirectUri(request: NextRequest, env = process.env): string {
  if (env.GOOGLE_REDIRECT_URI) {
    return env.GOOGLE_REDIRECT_URI;
  }
  const canonical = getCanonicalAuthUrl(env);
  const currentOrigin = getRequestOrigin(request);

  // If canonical URL is configured and this request is on a preview/different origin,
  // tell Google to redirect to canonical callback.
  if (canonical && currentOrigin !== canonical) {
    return `${canonical}/api/auth/callback`;
  }

  return `${currentOrigin}/api/auth/callback`;
}

function getExchangeRedirectUri(
  request: NextRequest,
  verifiedState?: OAuthStatePayload | null,
  env = process.env,
): string {
  if (env.GOOGLE_REDIRECT_URI) {
    return env.GOOGLE_REDIRECT_URI;
  }
  if (verifiedState?.canonicalUrl) {
    return `${verifiedState.canonicalUrl}/api/auth/callback`;
  }
  const canonical = getCanonicalAuthUrl(env);
  const currentOrigin = getRequestOrigin(request);
  if (canonical && currentOrigin !== canonical) {
    return `${canonical}/api/auth/callback`;
  }
  return `${currentOrigin}/api/auth/callback`;
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

async function handleLogin(request: NextRequest): Promise<NextResponse> {
  const config = getAuthConfig();
  if (!config.clientId) {
    return NextResponse.json({ error: { message: "Google OAuth client ID is not configured." } }, { status: 500 });
  }

  const defaultHome = getHomeUrl();
  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get("returnTo") || defaultHome;

  // Prevent open-redirects: returnTo must start with "/" and not "//"
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : defaultHome;

  const nonce = generateRandomString(32);
  const redirectUri = getInitiationRedirectUri(request);
  const currentOrigin = getRequestOrigin(request);
  const canonical = getCanonicalAuthUrl();
  const isRelay = Boolean(canonical && currentOrigin !== canonical);

  const signedState = await createOAuthStateToken({
    state: nonce,
    returnTo: safeReturnTo,
    origin: isRelay ? currentOrigin : undefined,
    canonicalUrl: canonical ?? undefined,
  });

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", config.clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", signedState);
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("access_type", "online");

  const response = NextResponse.redirect(googleAuthUrl.toString(), 302);
  const statePayload = JSON.stringify({ state: nonce, returnTo: safeReturnTo });

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
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Verify HMAC-signed state token or local cookie state
  const verifiedState = state ? await verifyOAuthStateToken(state) : null;
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  let parsedCookieState: { state: string; returnTo?: string } | null = null;
  if (stateCookie) {
    try {
      parsedCookieState = JSON.parse(stateCookie);
    } catch {
      // malformed cookie
    }
  }

  // Check state mismatch against local cookie if cookie is present
  if (parsedCookieState) {
    const actualState = verifiedState ? verifiedState.state : state;
    if (parsedCookieState.state !== actualState) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin);
      loginUrl.searchParams.set("error", "state_mismatch");
      return NextResponse.redirect(loginUrl.toString(), 302);
    }
  }

  // Resolve active state payload
  let activeState: OAuthStatePayload | null = verifiedState;
  if (!activeState && state && parsedCookieState && parsedCookieState.state === state) {
    activeState = {
      state,
      returnTo: parsedCookieState.returnTo || getHomeUrl(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
  }

  // If Google reported an error during user consent
  if (errorParam) {
    if (activeState?.origin && isAllowedPreviewOrigin(activeState.origin)) {
      const previewLoginUrl = new URL("/auth/login", activeState.origin);
      previewLoginUrl.searchParams.set("error", errorParam);
      return NextResponse.redirect(previewLoginUrl.toString(), 302);
    }
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", errorParam);
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  // Check state validity
  if (!state || !activeState) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  // Canonical Relay Check: If canonical callback receives a request intended for a preview origin
  const currentOrigin = getRequestOrigin(request);
  if (activeState.origin && activeState.origin !== currentOrigin) {
    // Validate target origin
    if (!isAllowedPreviewOrigin(activeState.origin)) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin);
      loginUrl.searchParams.set("error", "disallowed_relay_origin");
      return NextResponse.redirect(loginUrl.toString(), 302);
    }

    if (!code) {
      const previewLoginUrl = new URL("/auth/login", activeState.origin);
      previewLoginUrl.searchParams.set("error", "missing_code");
      return NextResponse.redirect(previewLoginUrl.toString(), 302);
    }

    // Forward code and state to preview callback
    const previewCallbackUrl = new URL("/api/auth/callback", activeState.origin);
    previewCallbackUrl.searchParams.set("code", code);
    previewCallbackUrl.searchParams.set("state", state);
    return NextResponse.redirect(previewCallbackUrl.toString(), 302);
  }

  let returnTo = getHomeUrl();
  if (activeState.returnTo?.startsWith("/") && !activeState.returnTo.startsWith("//")) {
    returnTo = activeState.returnTo;
  }

  if (!code) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl.toString(), 302);
  }

  const config = getAuthConfig();
  const exchangeRedirectUri = getExchangeRedirectUri(request, activeState);

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: exchangeRedirectUri,
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
