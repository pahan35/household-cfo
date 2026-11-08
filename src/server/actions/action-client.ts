import "server-only";

import { cookies } from "next/headers";

import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";

import { isAuthBypassActive } from "@/server/auth/config";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/server/auth/session";
import { type AuthContext, ServiceError } from "@/server/services/types";

/** Base client: surfaces `ServiceError` messages, hides everything else behind a generic message. */
export const actionClient = createSafeActionClient({
  handleServerError(error) {
    if (error instanceof ServiceError) {
      return error.message;
    }
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export async function resolveActionAuth(): Promise<AuthContext | null> {
  if (isAuthBypassActive()) {
    return { subject: "local-dev", source: "bypass" };
  }

  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  return session ? { subject: session.email, source: "session" } : null;
}

/** Authenticated client: rejects before validation/handlers when there is no session. */
export const authActionClient = actionClient.use(async ({ next }) => {
  const auth = await resolveActionAuth();
  if (!auth) {
    throw new ServiceError("unauthorized", "Unauthorized");
  }
  return next({ ctx: { auth } });
});
