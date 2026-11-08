import "server-only";

export type ExternalProviderAdapterMode = "external-provider" | "mock";

export class InvalidAdapterModeError extends Error {
  readonly statusCode: number = 503;

  constructor(value: string) {
    super(`Invalid EXTERNAL_API_ADAPTER: "${value}". Expected "external-provider" or "mock".`);
    this.name = "InvalidAdapterModeError";
  }
}

export function getExternalProviderAdapterMode(): ExternalProviderAdapterMode {
  const raw = process.env.EXTERNAL_API_ADAPTER?.trim().toLowerCase();
  if (!raw) {
    return "external-provider";
  }
  if (raw === "external-provider") {
    return "external-provider";
  }
  if (raw === "mock") {
    return "mock";
  }
  throw new InvalidAdapterModeError(process.env.EXTERNAL_API_ADAPTER ?? "");
}

export function isMockAdapterMode(): boolean {
  return getExternalProviderAdapterMode() === "mock";
}

export interface SupabaseCredentials {
  url: string;
  key: string;
}

/**
 * Resolves Supabase credentials according to EXTERNAL_API_ADAPTER mode.
 * - In "external-provider" (default) mode: reads SUPABASE_URL and SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY.
 * - In "mock" mode: strictly reads SUPABASE_MOCK_URL and SUPABASE_MOCK_SECRET_KEY / SUPABASE_MOCK_SERVICE_ROLE_KEY,
 *   never touching production SUPABASE_URL or production secret keys.
 */
export function resolveSupabaseCredentials(): SupabaseCredentials | null {
  const mode = getExternalProviderAdapterMode();

  if (mode === "mock") {
    const url = process.env.SUPABASE_MOCK_URL?.trim();
    const key = (process.env.SUPABASE_MOCK_SECRET_KEY ?? process.env.SUPABASE_MOCK_SERVICE_ROLE_KEY)?.trim();
    if (url && key) {
      return { url, key };
    }
    return null;
  }

  // "external-provider" mode (default)
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (url && key) {
    return { url, key };
  }
  return null;
}
