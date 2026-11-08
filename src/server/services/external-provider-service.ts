import "server-only";

import type {
  ExternalProviderCategory,
  ExternalProviderTransaction,
} from "@/app/(main)/dashboard/family-budget/_components/external-provider-data";
import {
  type CreateTransactionsInputDto,
  normalizeCategoriesInput,
  normalizeTransactionsInput,
  type SnapshotQueryInputDto,
  snapshotQuerySchema,
  type TriggerSyncInputDto,
  triggerSyncSchema,
  type UpdateSyncConfigInputDto,
  type UpdateTransactionInputDto,
  type UpsertCategoriesInputDto,
  updateSyncConfigSchema,
  updateTransactionSchema,
} from "@/lib/schemas/external-provider";
import { type ExternalProviderSyncResult, getExternalProviderAdapter } from "@/server/external-provider/adapter";
import { type ExternalProviderSnapshot, type ExternalProviderSyncConfig, getExternalProviderStore } from "@/server/external-provider/db";
import { isMockAdapterMode } from "@/server/supabase/config";

import { type AuthContext, guard, ServiceError } from "./types";

export async function getSnapshot(_ctx: AuthContext, input?: SnapshotQueryInputDto): Promise<ExternalProviderSnapshot> {
  const parsed = input ? snapshotQuerySchema.parse(input) : undefined;
  return guard("internal", "Failed to get ExternalProvider snapshot", async () => {
    const adapter = getExternalProviderAdapter();
    return adapter.getSnapshot(parsed?.sinceVersion);
  });
}

export async function triggerSync(_ctx: AuthContext, input?: TriggerSyncInputDto): Promise<ExternalProviderSyncResult> {
  const parsed = input ? triggerSyncSchema.parse(input) : undefined;
  return guard("internal", "Failed to trigger ExternalProvider sync", async () => {
    const adapter = getExternalProviderAdapter();
    return adapter.sync(parsed);
  });
}

export async function updateSyncConfig(
  _ctx: AuthContext,
  input: UpdateSyncConfigInputDto,
): Promise<ExternalProviderSyncConfig> {
  const parsed = updateSyncConfigSchema.parse(input);
  return guard("internal", "Failed to update ExternalProvider sync config", async () => {
    const store = getExternalProviderStore();
    return store.updateSyncConfig({
      ...(parsed.hotPullMonths !== undefined ? { hot_pull_months: parsed.hotPullMonths } : {}),
      ...(parsed.autoPollIntervalMinutes !== undefined
        ? { auto_poll_interval_minutes: parsed.autoPollIntervalMinutes }
        : {}),
    });
  });
}

export async function createTransactions(
  _ctx: AuthContext,
  input: CreateTransactionsInputDto,
): Promise<ExternalProviderTransaction[]> {
  const transactions = normalizeTransactionsInput(input);
  return guard("internal", "Failed to create ExternalProvider transactions", async () => {
    const adapter = getExternalProviderAdapter();
    return adapter.createTransactions(transactions as ExternalProviderTransaction[]);
  });
}

export async function updateTransaction(
  _ctx: AuthContext,
  input: UpdateTransactionInputDto,
): Promise<ExternalProviderTransaction> {
  const parsed = updateTransactionSchema.parse(input);
  return guard("internal", "Failed to update ExternalProvider transaction", async () => {
    const adapter = getExternalProviderAdapter();
    return adapter.updateTransaction(parsed as ExternalProviderTransaction);
  });
}

export async function upsertCategories(
  _ctx: AuthContext,
  input: UpsertCategoriesInputDto,
): Promise<ExternalProviderCategory[]> {
  const categories = normalizeCategoriesInput(input);
  return guard("internal", "Failed to upsert ExternalProvider categories", async () => {
    const adapter = getExternalProviderAdapter();
    return adapter.upsertCategories(categories as ExternalProviderCategory[]);
  });
}

export async function resetMockExternalProvider(_ctx: AuthContext): Promise<ExternalProviderSnapshot> {
  if (!isMockAdapterMode()) {
    throw new ServiceError("forbidden", "Resetting ExternalProvider is forbidden when not in mock mode");
  }

  return guard("internal", "Failed to reset mock ExternalProvider", async () => {
    const adapter = getExternalProviderAdapter();
    return adapter.resetToSeed();
  });
}
