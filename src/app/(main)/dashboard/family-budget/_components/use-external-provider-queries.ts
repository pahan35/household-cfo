"use client";

import useSWR, { type SWRResponse } from "swr";

import { getCategories, getCurrencies, getSettings } from "./external-provider-client";
import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
} from "./external-provider-data";
import { EXTERNAL_PROVIDER_QUERY_KEY } from "./external-provider-query-cache";

/**
 * Shared SWR read hooks for ExternalProvider reference data.
 *
 * All widgets that call the same hook share one cache entry and one in-flight request
 * (SWR request deduplication), serve stale data instantly, and revalidate on window focus.
 * `revalidateExternalProviderQueries()` (external-provider-query-cache) is invoked by the sync provider after every completed sync.
 */

const QUERY_OPTIONS = {
  dedupingInterval: 2_000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  keepPreviousData: true,
} as const;

function useExternalProviderQuery<T>(name: string, fetcher: () => Promise<T>): SWRResponse<T, Error> {
  return useSWR<T, Error>([EXTERNAL_PROVIDER_QUERY_KEY, name], fetcher, QUERY_OPTIONS);
}

export function useCategoriesQuery(): SWRResponse<ExternalProviderCategory[], Error> {
  return useExternalProviderQuery("categories", () => getCategories());
}

export function useCurrenciesQuery(): SWRResponse<ExternalProviderCurrency[], Error> {
  return useExternalProviderQuery("currencies", () => getCurrencies());
}

export function useSettingsQuery(): SWRResponse<ExternalProviderSettings, Error> {
  return useExternalProviderQuery("settings", () => getSettings());
}
