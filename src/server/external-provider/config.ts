import "server-only";

export const UPSTREAM_ORIGIN = process.env.EXTERNAL_API_BASE_URL?.trim() || "https://api.external-provider.example.com";

export const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Upstream path prefixes this proxy is permitted to forward.
 *
 * All prefixes below were verified against the live web backend on
 * 2026-10-24 (see docs/externalProvider/NOTES.md). A prefix also permits everything
 * nested beneath it; add new ones explicitly as endpoints are validated.
 */
export const PATH_ALLOWLIST: string[] = ["/Exchange", "/api/transaction", "/settings", "/stat"];

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
