import { mutate } from "swr";

export const EXTERNAL_PROVIDER_QUERY_KEY = "external-provider";

/** Revalidates every ExternalProvider SWR query (categories, currencies, settings). */
export function revalidateExternalProviderQueries(): Promise<unknown[]> {
  return mutate((key) => Array.isArray(key) && key[0] === EXTERNAL_PROVIDER_QUERY_KEY);
}
