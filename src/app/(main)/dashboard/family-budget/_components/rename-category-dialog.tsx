"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateCategoriesOrder } from "./external-provider-client";
import { CategoryType, type ExternalProviderCategory, isExpenseCategory } from "./external-provider-data";

export interface RenameCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExternalProviderCategory | null;
  allCategories: ExternalProviderCategory[];
  onSuccess?: (updatedCategory: ExternalProviderCategory, allUpdatedCategories: ExternalProviderCategory[]) => void;
}

export function RenameCategoryDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  onSuccess,
}: RenameCategoryDialogProps) {
  const inputId = useId();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && category) {
      setName(category.name ?? "");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, category]);

  const isExpense = category ? isExpenseCategory(category) : true;
  const scopeLabel = isExpense ? "Expense" : "Income";

  const sameScopeCategories = useMemo(() => {
    if (!category) return [];
    const isExp = isExpenseCategory(category);
    return allCategories.filter((c) => {
      if (c.deleted || c.id === category.id) return false;
      return isExp ? isExpenseCategory(c) : Number(c.categoryType) === CategoryType.Income;
    });
  }, [allCategories, category]);

  const trimmedName = name.trim();
  const normalizedTarget = trimmedName.toLowerCase();
  const isUnchanged = category ? trimmedName === (category.name ?? "").trim() : false;
  const isEmpty = trimmedName.length === 0;

  const collisionCategory = useMemo(() => {
    if (isEmpty || isUnchanged) return null;
    return sameScopeCategories.find((c) => c.name.trim().toLowerCase() === normalizedTarget) ?? null;
  }, [isEmpty, isUnchanged, sameScopeCategories, normalizedTarget]);

  const isCollision = Boolean(collisionCategory);
  const canSubmit = !isEmpty && !isUnchanged && !isCollision && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !category) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updatedCategory: ExternalProviderCategory = {
        ...category,
        name: trimmedName,
      };
      const allUpdatedCategories = allCategories.map((c) => (c.id === category.id ? updatedCategory : c));

      await updateCategoriesOrder([updatedCategory], { allUpdatedCategories });
      onSuccess?.(updatedCategory, allUpdatedCategories);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
            <DialogDescription>
              Rename <span className="font-semibold text-foreground">{category?.name}</span> ({scopeLabel} category).
              Changes are synced directly upstream to ExternalProvider.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId} className="text-sm font-medium">
              Category Name
            </Label>
            <Input
              id={inputId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
              autoFocus
              disabled={isSubmitting}
            />
            {isCollision && collisionCategory && (
              <p className="text-destructive text-xs">
                A category named &quot;{collisionCategory.name.trim()}&quot; already exists in{" "}
                {scopeLabel.toLowerCase()}s.
              </p>
            )}
            {isEmpty && (
              <p className="text-muted-foreground text-xs">Category name cannot be empty or whitespace only.</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Saving..." : "Save Name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
