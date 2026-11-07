import "server-only";

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /cookie/i,
  /authorization/i,
  /secret/i,
  /password/i,
  /key$/i,
  /keychain/i,
  /credential/i,
  /session/i,
  /database_url/i,
];

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitizeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // Scrub potential Bearer tokens or Cookie headers embedded in strings
    let sanitized = value.replace(/Bearer\s+[\w\-._~+/]+=*/gi, `Bearer ${REDACTED}`);
    sanitized = sanitized.replace(/(Cookie:\s*)([^\r\n]+)/gi, `$1${REDACTED}`);
    return sanitized;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogValue(value.message),
      stack: sanitizeLogValue(value.stack),
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeLogValue(item, seen));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveKey(k)) {
        sanitizedObj[k] = REDACTED;
      } else {
        sanitizedObj[k] = sanitizeLogValue(v, seen);
      }
    }
    return sanitizedObj;
  }

  return String(value);
}

export interface LogContext {
  [key: string]: unknown;
}

function formatLogMessage(
  level: "info" | "warn" | "error",
  message: string,
  context?: LogContext | Error | unknown,
): string {
  const isProdOrVercel = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined) {
    payload.context = sanitizeLogValue(context);
  }

  if (isProdOrVercel) {
    // Vercel runtime logs index single-line JSON automatically
    return JSON.stringify(payload);
  }

  // Readable output in local dev
  const contextStr = context !== undefined ? `\n${JSON.stringify(sanitizeLogValue(context), null, 2)}` : "";
  return `[${payload.timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const serverLogger = {
  info(message: string, context?: LogContext | Error | unknown): void {
    console.info(formatLogMessage("info", message, context));
  },

  warn(message: string, context?: LogContext | Error | unknown): void {
    console.warn(formatLogMessage("warn", message, context));
  },

  error(message: string, context?: LogContext | Error | unknown): void {
    console.error(formatLogMessage("error", message, context));
  },
};
