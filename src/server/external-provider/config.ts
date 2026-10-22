import "server-only";

export const UPSTREAM_ORIGIN = process.env.EXTERNAL_API_BASE_URL?.trim() || "https://api.external-provider.example.com";

export const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Upstream path prefixes this proxy is permitted to forward.
 *
 * This list is intentionally empty so the proxy fails closed. Populate it with
 * the exact prefixes the frontend needs, for example ["/api/v1/accounts"].
 * A prefix also permits everything nested beneath it.
 */
export const PATH_ALLOWLIST: string[] = ["/Exchange", "/api/transaction", "/settings", "/stat"]; // TEMP probe (2026-10-22) — keep uncommitted, restore []

export const REQUEST_HEADER_ALLOWLIST = ["accept", "content-type", "if-match", "if-modified-since", "if-none-match"];

export const RESPONSE_HEADER_ALLOWLIST = ["cache-control", "content-type", "etag", "last-modified", "retry-after"];

export function isAllowedMethod(method: string): boolean {
  return ALLOWED_METHODS.has(method);
}

export function isAllowedPath(pathname: string): boolean {
  return PATH_ALLOWLIST.filter((prefix) => prefix.length > 0).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
