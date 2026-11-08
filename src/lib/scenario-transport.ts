/**
 * Pluggable remote transport for scenario repositories.
 *
 * Repositories own the offline-first logic (localStorage cache, reconciliation, offline fallbacks);
 * a transport only moves bytes to/from the server. Every method MUST throw on failure so the
 * repository can fall back to local state.
 */
export interface ScenarioTransport<TScenario, TCreate, TUpdate> {
  list(signal?: AbortSignal): Promise<TScenario[]>;
  create(input: TCreate): Promise<TScenario>;
  update(id: string, updates: TUpdate): Promise<TScenario>;
  delete(id: string): Promise<void>;
  setPrimary(id: string): Promise<TScenario>;
  duplicate(id: string, name?: string): Promise<TScenario>;
}

/** Transport over the legacy `/api/family-budget/<kind>/scenarios` REST routes. */
export function createFetchScenarioTransport<TScenario, TCreate, TUpdate>(
  fetchFn: typeof fetch,
  url: string,
): ScenarioTransport<TScenario, TCreate, TUpdate> {
  async function send(method: string, body: unknown, failure: string): Promise<TScenario> {
    const res = await fetchFn(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`${failure}: HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.scenario as TScenario;
  }

  return {
    async list(signal) {
      const res = await fetchFn(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal,
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch scenarios: HTTP ${res.status}`);
      }
      const data = await res.json();
      return (data.scenarios ?? []) as TScenario[];
    },
    create: (input) => send("POST", input, "Failed to create scenario remotely"),
    update: (id, updates) => send("PATCH", { id, ...(updates as object) }, "Failed to update scenario remotely"),
    async delete(id) {
      const res = await fetchFn(`${url}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete scenario remotely: HTTP ${res.status}`);
      }
    },
    setPrimary: (id) => send("POST", { action: "set_primary", id }, "Failed to set primary scenario remotely"),
    duplicate: (id, name) => send("POST", { action: "duplicate", id, name }, "Failed to duplicate scenario remotely"),
  };
}

/** Minimal shape of a `next-safe-action` result that this module needs. */
export interface SafeActionResultLike<T> {
  data?: T;
  serverError?: string;
  validationErrors?: unknown;
}

/** Unwraps a safe-action result, throwing on server, validation or missing-data failures. */
export function unwrapAction<T>(result: SafeActionResultLike<T> | undefined, failure: string): T {
  if (result?.data === undefined) {
    throw new Error(result?.serverError ?? (result?.validationErrors ? `${failure}: invalid input` : failure));
  }
  return result.data;
}

export interface ScenarioActionOperations<TScenario, TCreate, TUpdate> {
  list: (input: Record<string, never>) => Promise<SafeActionResultLike<{ scenarios: TScenario[] }>>;
  create: (input: TCreate) => Promise<SafeActionResultLike<{ scenario: TScenario }>>;
  update: (input: TUpdate & { id: string }) => Promise<SafeActionResultLike<{ scenario: TScenario }>>;
  delete: (input: { id: string }) => Promise<SafeActionResultLike<{ id: string }>>;
  setPrimary: (input: { id: string }) => Promise<SafeActionResultLike<{ scenario: TScenario }>>;
  duplicate: (input: { id: string; name?: string }) => Promise<SafeActionResultLike<{ scenario: TScenario }>>;
}

/** Transport over Next.js Server Actions (via `next-safe-action`). */
export function createActionScenarioTransport<TScenario, TCreate, TUpdate>(
  actions: ScenarioActionOperations<TScenario, TCreate, TUpdate>,
  options?: { onMutated?: () => unknown },
): ScenarioTransport<TScenario, TCreate, TUpdate> {
  const notify = () => {
    void options?.onMutated?.();
  };

  return {
    async list() {
      const res = await actions.list({});
      return unwrapAction(res, "Failed to list scenarios").scenarios;
    },
    async create(input) {
      const res = await actions.create(input);
      const scenario = unwrapAction(res, "Failed to create scenario").scenario;
      notify();
      return scenario;
    },
    async update(id, updates) {
      const res = await actions.update({ id, ...(updates as object) } as TUpdate & { id: string });
      const scenario = unwrapAction(res, "Failed to update scenario").scenario;
      notify();
      return scenario;
    },
    async delete(id) {
      const res = await actions.delete({ id });
      unwrapAction(res, "Failed to delete scenario");
      notify();
    },
    async setPrimary(id) {
      const res = await actions.setPrimary({ id });
      const scenario = unwrapAction(res, "Failed to set primary scenario").scenario;
      notify();
      return scenario;
    },
    async duplicate(id, name) {
      const res = await actions.duplicate({ id, name });
      const scenario = unwrapAction(res, "Failed to duplicate scenario").scenario;
      notify();
      return scenario;
    },
  };
}
