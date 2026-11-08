import { z } from "zod";

/**
 * Shared DTO contracts for ExternalProvider transactions, categories, and sync operations.
 */

export const externalProviderTransactionSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string().optional(),
  sourceType: z.number().int().optional(),
  sourceAmount: z.number().optional(),
  destinationId: z.string().optional(),
  destinationType: z.number().int().optional(),
  destinationAmount: z.number().optional(),
  comment: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  dateTimestamp: z.number().optional(),
  dateTimestampISO: z.string().optional(),
  deleted: z.boolean().optional(),
});
export type ExternalProviderTransactionInputDto = z.input<typeof externalProviderTransactionSchema>;
export type ExternalProviderTransactionDto = z.output<typeof externalProviderTransactionSchema>;

export const createTransactionsSchema = z.union([
  z.object({ transactions: z.array(externalProviderTransactionSchema).min(1) }),
  z.array(externalProviderTransactionSchema).min(1),
  externalProviderTransactionSchema,
]);
export type CreateTransactionsInputDto = z.input<typeof createTransactionsSchema>;
export type CreateTransactionsDto = z.output<typeof createTransactionsSchema>;

export function normalizeTransactionsInput(input: unknown): ExternalProviderTransactionDto[] {
  const parsed = createTransactionsSchema.parse(input);
  if (Array.isArray(parsed)) return parsed;
  if ("transactions" in parsed && Array.isArray(parsed.transactions)) return parsed.transactions;
  return [parsed as ExternalProviderTransactionDto];
}

export const updateTransactionSchema = externalProviderTransactionSchema.extend({
  id: z.string().min(1),
});
export type UpdateTransactionInputDto = z.input<typeof updateTransactionSchema>;
export type UpdateTransactionDto = z.output<typeof updateTransactionSchema>;

export const externalProviderCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  categoryType: z.number().int(),
  currencyId: z.string().optional(),
  limitAmount: z.number().optional(),
  amount: z.number().optional(),
  currentAmount: z.number().optional(),
  order: z.number().int().optional(),
  deleted: z.boolean().optional(),
  icon: z.string().optional(),
});
export type ExternalProviderCategoryInputDto = z.input<typeof externalProviderCategorySchema>;
export type ExternalProviderCategoryDto = z.output<typeof externalProviderCategorySchema>;

export const upsertCategoriesSchema = z.union([
  z.object({ categories: z.array(externalProviderCategorySchema).min(1) }),
  z.array(externalProviderCategorySchema).min(1),
  externalProviderCategorySchema,
]);
export type UpsertCategoriesInputDto = z.input<typeof upsertCategoriesSchema>;
export type UpsertCategoriesDto = z.output<typeof upsertCategoriesSchema>;

export function normalizeCategoriesInput(input: unknown): ExternalProviderCategoryDto[] {
  const parsed = upsertCategoriesSchema.parse(input);
  if (Array.isArray(parsed)) return parsed;
  if ("categories" in parsed && Array.isArray(parsed.categories)) return parsed.categories;
  return [parsed as ExternalProviderCategoryDto];
}

export const triggerSyncSchema = z.object({
  tier: z.enum(["hot", "warm", "cold"]).optional(),
  force: z.boolean().optional(),
  hotPullMonths: z.number().int().positive().optional(),
  escalateIfBalanceChanged: z.boolean().optional(),
});
export type TriggerSyncInputDto = z.input<typeof triggerSyncSchema>;
export type TriggerSyncDto = z.output<typeof triggerSyncSchema>;

export const updateSyncConfigSchema = z.object({
  hotPullMonths: z.number().int().positive().optional(),
  autoPollIntervalMinutes: z.number().int().nonnegative().optional(),
});
export type UpdateSyncConfigInputDto = z.input<typeof updateSyncConfigSchema>;
export type UpdateSyncConfigDto = z.output<typeof updateSyncConfigSchema>;

export const snapshotQuerySchema = z.object({
  sinceVersion: z.coerce.number().int().nonnegative().optional(),
});
export type SnapshotQueryInputDto = z.input<typeof snapshotQuerySchema>;
export type SnapshotQueryDto = z.output<typeof snapshotQuerySchema>;
