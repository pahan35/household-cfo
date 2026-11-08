"use client";

import useSWR, { mutate, type SWRResponse } from "swr";

import type { ScenarioKind } from "@/lib/schemas/scenarios";

/**
 * SWR read hooks for persisted simulator scenarios, backed by the versioned REST API
 * (`/api/v1/scenarios/<kind>`). The web session cookie authenticates these calls.
 * Mutations go through Server Actions and then call `revalidateScenarios(kind)`.
 */

export const SCENARIOS_QUERY_KEY = "scenarios";

class ScenarioFetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ScenarioFetchError";
    this.status = status;
  }
}

async function fetchScenarios<T>(kind: ScenarioKind): Promise<T[]> {
  const res = await fetch(`/api/v1/scenarios/${kind}`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new ScenarioFetchError(`Failed to fetch ${kind} scenarios: HTTP ${res.status}`, res.status);
  }
  const body = (await res.json()) as { scenarios?: T[] };
  return body.scenarios ?? [];
}

export function useScenariosQuery<T = unknown>(kind: ScenarioKind): SWRResponse<T[], Error> {
  return useSWR<T[], Error>([SCENARIOS_QUERY_KEY, kind], () => fetchScenarios<T>(kind), {
    dedupingInterval: 2_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
}

export function revalidateScenarios(kind?: ScenarioKind): Promise<unknown[]> {
  return mutate((key) => Array.isArray(key) && key[0] === SCENARIOS_QUERY_KEY && (!kind || key[1] === kind));
}
