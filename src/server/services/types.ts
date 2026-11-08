/**
 * Transport-agnostic building blocks shared by every domain service.
 * Services MUST NOT import `next/server`, `next/headers` or use `"use server"`.
 */

export type AuthSource = "session" | "bearer" | "bypass";

export interface AuthContext {
  /** Stable identifier of the caller (email, token label, or `local-dev`). */
  subject: string;
  source: AuthSource;
}

export type ServiceErrorCode = "unauthorized" | "not_found" | "invalid" | "conflict" | "internal";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  internal: 500,
};

export function serviceErrorStatus(err: unknown): number {
  return err instanceof ServiceError ? STATUS_BY_CODE[err.code] : 500;
}

/** Wraps store failures with a `ServiceError` of the given code, preserving the message. */
export async function guard<T>(code: ServiceErrorCode, fallback: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    throw new ServiceError(code, err instanceof Error ? err.message : fallback);
  }
}
