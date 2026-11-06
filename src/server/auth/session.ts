import type { NextRequest, NextResponse } from "next/server";

import { isFocusedMode } from "@/config/app-mode";
import { rootUser } from "@/data/users";

import { FatalAuthConfigError, isEmailAllowed, isVercelOrProd } from "./config";

export const AUTH_COOKIE_NAME = "family_budget_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface SessionPayload {
  email: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.AUTH_SECRET;
  if (!secret) {
    if (isVercelOrProd(env)) {
      throw new FatalAuthConfigError("CRITICAL SECURITY ERROR: AUTH_SECRET must be configured in production/Vercel.");
    }
    return "dev-insecure-auth-secret-family-budget-local-development-only-32bytes";
  }
  return secret;
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/**
 * Creates a signed JWT session token for the given user.
 */
export async function createSessionToken(
  user: SessionUser,
  options?: {
    secret?: string;
    expiresInSeconds?: number;
    now?: number;
  },
): Promise<string> {
  const secret = options?.secret ?? getSessionSecret();
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  const expiresIn = options?.expiresInSeconds ?? SESSION_MAX_AGE_SECONDS;

  const header = { alg: "HS256", typ: "JWT" };
  const payload: SessionPayload = {
    email: user.email.trim().toLowerCase(),
    name: user.name,
    picture: user.picture,
    iat: now,
    exp: now + expiresIn,
  };

  const enc = new TextEncoder();
  const encodedHeader = toBase64Url(enc.encode(JSON.stringify(header)));
  const encodedPayload = toBase64Url(enc.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const encodedSignature = toBase64Url(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verifies a signed session token.
 * Validates HMAC signature, expiration, and ensures user email is currently
 * authorized in ALLOWED_USER_EMAILS.
 */
export async function verifySessionToken(
  token: string,
  options?: {
    secret?: string;
    env?: Record<string, string | undefined>;
    now?: number;
  },
): Promise<SessionUser | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const env = options?.env ?? process.env;
  const secret = options?.secret ?? getSessionSecret(env);
  const now = options?.now ?? Math.floor(Date.now() / 1000);

  try {
    const key = await getCryptoKey(secret);
    const enc = new TextEncoder();
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;
    const signatureBytes = fromBase64Url(encodedSignature);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      enc.encode(dataToVerify),
    );
    if (!isValid) {
      return null;
    }

    const payloadJson = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const payload = JSON.parse(payloadJson) as Partial<SessionPayload>;

    if (!payload.email || typeof payload.email !== "string") {
      return null;
    }

    if (typeof payload.exp !== "number" || payload.exp <= now) {
      return null;
    }

    // Re-check that email is still present in ALLOWED_USER_EMAILS
    if (!isEmailAllowed(payload.email, env)) {
      return null;
    }

    return {
      email: payload.email.toLowerCase(),
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the session user from an incoming NextRequest.
 */
export async function getSessionFromRequest(
  request: NextRequest | Request,
  env: Record<string, string | undefined> = process.env,
): Promise<SessionUser | null> {
  let token: string | undefined;

  if ("cookies" in request && typeof request.cookies?.get === "function") {
    token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  } else {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      if (match) {
        token = match.substring(AUTH_COOKIE_NAME.length + 1);
      }
    }
  }

  if (!token) {
    return null;
  }

  return verifySessionToken(token, { env });
}

/**
 * Attaches the signed session cookie to an outgoing NextResponse.
 */
export function attachSessionCookie(
  response: NextResponse,
  token: string,
  env: Record<string, string | undefined> = process.env,
): void {
  const isSecure = env.NODE_ENV === "production" || env.VERCEL === "1";
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the session cookie on an outgoing NextResponse.
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
}

/**
 * Resolves the authenticated user for the dashboard shell from cookies.
 * Falls back cleanly in local development when auth bypass is active.
 */
export async function getDashboardUserFromCookies(
  cookieStore: { get(name: string): { value: string } | undefined },
  env: Record<string, string | undefined> = process.env,
): Promise<DashboardUser> {
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    const session = await verifySessionToken(token, { env });
    if (session) {
      return {
        id: session.email,
        name: session.name ?? session.email.split("@")[0] ?? "Family Member",
        email: session.email,
        avatar: session.picture ?? "",
        role: "Family Member",
      };
    }
  }

  // Fallback when no valid session cookie (e.g. local development)
  if (isFocusedMode(env as NodeJS.ProcessEnv)) {
    return {
      id: "local-dev",
      name: "Local Dev",
      email: "dev@localhost",
      avatar: "",
      role: "Developer",
    };
  }

  return {
    id: rootUser.id,
    name: rootUser.name,
    email: rootUser.email,
    avatar: rootUser.avatar,
    role: rootUser.role,
  };
}
