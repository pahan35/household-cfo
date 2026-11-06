export type AppMode = "focused" | "full";

/**
 * Resolves the application mode from environment variables.
 * Explicit NEXT_PUBLIC_APP_MODE ("focused" | "full") takes precedence.
 * Otherwise defaults to "focused" in production / Vercel, and "full" in local development.
 */
export function getAppMode(env: NodeJS.ProcessEnv = process.env): AppMode {
  if (env.NEXT_PUBLIC_APP_MODE === "focused" || env.NEXT_PUBLIC_APP_MODE === "full") {
    return env.NEXT_PUBLIC_APP_MODE;
  }

  if (env.NODE_ENV === "production" || env.VERCEL === "1" || env.VERCEL_ENV) {
    return "focused";
  }

  return "full";
}

/**
 * Convenience helper to check if the application is running in focused mode.
 */
export function isFocusedMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAppMode(env) === "focused";
}

/**
 * Resolves the default post-login or home dashboard destination based on application mode.
 */
export function getHomeUrl(env: NodeJS.ProcessEnv = process.env): string {
  return isFocusedMode(env) ? "/dashboard/family-budget" : "/dashboard/default";
}

/**
 * Checks whether a given pathname is within the allowed routes in focused mode.
 */
export function isAllowedFocusedPath(pathname: string): boolean {
  return pathname === "/dashboard/family-budget" || pathname.startsWith("/dashboard/family-budget/");
}
