import "server-only";

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
]);

const HIGH_ENTROPY_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/g;

export const MAX_UPSTREAM_ERROR_DETAIL_LENGTH = 500;

/**
 * Removes every live secret (Bearer token, cookie header value, user id) plus
 * any long opaque token-shaped substring from text that is about to be logged
 * or returned to the browser. Upstream error bodies occasionally echo request
 * headers back to the caller.
 */
export function scrubSecrets(input: string, ...secrets: string[]): string {
  let scrubbed = input;
  for (const secret of secrets) {
    if (secret.length > 0) {
      scrubbed = scrubbed.split(secret).join("[redacted]");
    }
  }
  return scrubbed.replace(HIGH_ENTROPY_TOKEN_PATTERN, "[redacted]");
}

export function redactHeaders(headers: Headers): Record<string, string> {
  const redacted: Record<string, string> = {};
  headers.forEach((value, name) => {
    redacted[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? "[redacted]" : value;
  });
  return redacted;
}

export function buildUpstreamErrorBody(
  status: number,
  statusText: string,
  upstreamBody: string,
  secrets: string[],
): string {
  return JSON.stringify({
    error: {
      message: `Upstream request failed with ${status} ${statusText}`.trim(),
      detail: scrubSecrets(upstreamBody, ...secrets).slice(0, MAX_UPSTREAM_ERROR_DETAIL_LENGTH),
    },
  });
}
