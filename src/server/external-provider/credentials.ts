import "server-only";

import type { ExternalProviderSecretSource } from "./token";

export type CredentialIssueReason = "missing" | "stale";

export type CredentialIssue = {
  reason: CredentialIssueReason;
  source: ExternalProviderSecretSource;
  status: number;
  upstreamPath?: string;
  detail?: string;
};

export type CredentialIssueHandler = (issue: CredentialIssue) => void | Promise<void>;

const issueHandlers = new Set<CredentialIssueHandler>();

/**
 * Registers an observer for credential issues (missing or stale secrets).
 * Returns an unregister function.
 */
export function onCredentialIssue(handler: CredentialIssueHandler): () => void {
  issueHandlers.add(handler);
  return () => {
    issueHandlers.delete(handler);
  };
}

/**
 * Resets registered credential issue handlers (primarily for testing).
 */
export function resetCredentialIssueHandlers(): void {
  issueHandlers.clear();
}

/**
 * Dispatches a credential issue notification to all registered handlers.
 */
export async function notifyCredentialIssue(issue: CredentialIssue): Promise<void> {
  const handlers = [...issueHandlers];
  await Promise.all(
    handlers.map(async (handler) => {
      try {
        await handler(issue);
      } catch (err) {
        console.error("[ExternalProvider] Failed to execute credential issue handler:", err);
      }
    }),
  );
}

/**
 * Determines whether an upstream HTTP response indicates that ExternalProvider
 * credentials are expired, unauthorized, or invalid.
 */
export function isStaleUpstreamResponse(params: {
  status: number;
  contentType?: string | null;
  bodyText?: string;
}): boolean {
  const { status, contentType, bodyText } = params;

  // 401 Unauthorized or 403 Forbidden
  if (status === 401 || status === 403) {
    return true;
  }

  // HTTP redirects (301, 302, 307, 308) redirecting to login/auth
  if (status >= 300 && status < 400) {
    return true;
  }

  // HTML response returned when JSON was expected (indicative of ASP.NET login page)
  if (contentType?.toLowerCase().includes("text/html")) {
    return true;
  }

  // Response body contains HTML document markup
  if (bodyText) {
    const trimmed = bodyText.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html")) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a caught fetch exception was triggered by an unexpected redirect.
 */
export function isRedirectError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("redirect") || msg.includes("unexpected redirect");
  }
  return false;
}
