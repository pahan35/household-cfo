"use client";

import { CategoryOrganizationDialog } from "./category-organization-dialog";
import type { ExternalProviderCategory, ExternalProviderTransaction } from "./external-provider-data";

export interface SmartOrderOptimizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExternalProviderCategory[];
  transactions?: ExternalProviderTransaction[];
  defaultCurrency?: string;
  onApplied?: (updatedCategories: ExternalProviderCategory[]) => void;
}

/**
 * Legacy wrapper forwarding to unified CategoryOrganizationDialog.
 */
export function SmartOrderOptimizerDialog(props: SmartOrderOptimizerDialogProps) {
  return <CategoryOrganizationDialog {...props} initialStrategy="smart-order" />;
}
