export type AppMode = "focused" | "full";

/**
 * Resolves the application mode from environment variables.
 * Explicit NEXT_PUBLIC_APP_MODE ("focused" | "full") takes precedence.
 * Otherwise defaults to "focused" in production / Vercel, and "full" in local development.
 *
 * In Next.js client bundles, `process.env.NEXT_PUBLIC_*` must be referenced directly as a literal
 * expression (e.g. `process.env.NEXT_PUBLIC_APP_MODE`) so Webpack / Turbopack can inline it at build time.
 * Dynamic property lookups on an aliased parameter (e.g. `env.NEXT_PUBLIC_*`) evaluate to undefined in the browser.
 */
export function getAppMode(env?: NodeJS.ProcessEnv): AppMode {
  const explicitMode =
    env && env !== process.env
      ? env.NEXT_PUBLIC_APP_MODE
      : (process.env.NEXT_PUBLIC_APP_MODE ?? env?.NEXT_PUBLIC_APP_MODE);

  if (explicitMode === "focused" || explicitMode === "full") {
    return explicitMode;
  }

  const isProduction =
    env && env !== process.env ? env.NODE_ENV === "production" : process.env.NODE_ENV === "production";

  const isVercel =
    env && env !== process.env
      ? env.VERCEL === "1" || Boolean(env.VERCEL_ENV)
      : process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

  if (isProduction || isVercel) {
    return "focused";
  }

  return "full";
}

/**
 * Convenience helper to check if the application is running in focused mode.
 */
export function isFocusedMode(env?: NodeJS.ProcessEnv): boolean {
  return getAppMode(env) === "focused";
}

/**
 * Resolves the default post-login or home dashboard destination based on application mode.
 */
export function getHomeUrl(env?: NodeJS.ProcessEnv): string {
  return isFocusedMode(env) ? "/dashboard/family-budget" : "/dashboard/default";
}

/**
 * Checks whether a given pathname is within the allowed routes in focused mode.
 */
export function isAllowedFocusedPath(pathname: string): boolean {
  return pathname === "/dashboard/family-budget" || pathname.startsWith("/dashboard/family-budget/");
}
