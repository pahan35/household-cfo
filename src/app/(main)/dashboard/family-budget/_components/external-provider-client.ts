import {
  type ExternalProviderCategory,
  type ExternalProviderSettings,
  ExchangeKey,
  type ExchangePingResponseEnvelope,
  extractExchangeEntities,
  type SettingsResponseEnvelope,
  type StatPingData,
  type StatPingResponseEnvelope,
  type TransactionPageResponse,
} from "./external-provider-data";

export class ExternalProviderClientError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ExternalProviderClientError";
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 503) {
      throw new ExternalProviderClientError(
        "ExternalProvider service unavailable or session expired. Please check your credentials.",
        503,
      );
    }
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errJson = (await response.json()) as { error?: { message?: string }; message?: string };
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      } else if (errJson.message) {
        errorDetail = errJson.message;
      }
    } catch {
      // response body was not JSON
    }
    throw new ExternalProviderClientError(errorDetail, response.status);
  }

  const json = (await response.json()) as T;
  return json;
}

export async function getSettings(options?: { signal?: AbortSignal }): Promise<ExternalProviderSettings> {
  const response = await fetch("/api/external-provider/settings/get", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: options?.signal,
  });

  const body = await handleResponse<SettingsResponseEnvelope>(response);
  return body.data ?? {};
}

export async function getCategories(options?: { signal?: AbortSignal }): Promise<ExternalProviderCategory[]> {
  const response = await fetch("/api/external-provider/Exchange/Ping", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          key: ExchangeKey.Category,
          entityJson: null,
        },
      ],
    }),
    signal: options?.signal,
  });

  const body = await handleResponse<ExchangePingResponseEnvelope>(response);
  const items = body.data?.items ?? [];
  return extractExchangeEntities<ExternalProviderCategory>(items, ExchangeKey.Category);
}

export async function getTransactionPage(options?: {
  skip?: number;
  take?: number;
  period?: { from?: string | null; to?: string | null };
  signal?: AbortSignal;
}): Promise<TransactionPageResponse> {
  const skip = options?.skip ?? 0;
  const take = options?.take ?? 20;

  const payload: Record<string, unknown> = {
    skip,
    take,
  };
  if (options?.period) {
    payload.period = options.period;
  }

  const response = await fetch("/api/external-provider/api/transaction/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  const body = await handleResponse<TransactionPageResponse>(response);
  return {
    transactions: body.transactions ?? [],
    importedTransactions: body.importedTransactions ?? [],
    hasMoreData: Boolean(body.hasMoreData),
  };
}

export async function getBudgetSelection(options: { from: string; signal?: AbortSignal }): Promise<StatPingData> {
  const budgetPayload = {
    echo: '{"selfSufficientRequest":true}',
    selection: {
      periodtype: 0,
      statisticType: 0,
      period: {
        from: options.from,
        to: null,
        Before: 40,
        After: null,
      },
      filter: null,
    },
  };

  const params = new URLSearchParams({
    data: JSON.stringify(budgetPayload),
    ts: Date.now().toString(),
  });

  const response = await fetch(`/api/external-provider/stat/ping?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: options.signal,
  });

  const body = await handleResponse<StatPingResponseEnvelope>(response);
  return body.data ?? {};
}
