"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { cn } from "cn";
import { AlertTriangle, ArrowRight, CheckCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  generateProposedCategoryRenames,
  type ProposedCategoryRename,
} from "./external-provider-data";

interface PendingRenameItem extends ProposedCategoryRename {
  selected: boolean;
  editedName: string;
}

export interface CategoryRenamingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExternalProviderCategory[];
  defaultCurrency?: string;
  transactions?: ExternalProviderTransaction[];
  onRenamed?: (updatedCategories: ExternalProviderCategory[]) => void;
}

export function CategoryRenamingDialog({
  open,
  onOpenChange,
  categories,
  defaultCurrency = "PLN",
  transactions,
  onRenamed,
}: CategoryRenamingDialogProps) {
  const selectAllId = useId();
  const [items, setItems] = useState<PendingRenameItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-generate proposed renames whenever dialog opens or input categories change
  useEffect(() => {
    if (!open) return;

    const proposed = generateProposedCategoryRenames(categories, {
      defaultCurrency,
      transactions,
    });

    setItems(
      proposed.map((p) => ({
        ...p,
        selected: !p.isCollision,
        editedName: p.proposedName,
      })),
    );
  }, [open, categories, defaultCurrency, transactions]);

  const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items]);
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  function handleToggleAll(checked: boolean) {
    setItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  }

  function handleToggleItem(id: string, checked: boolean) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: checked } : item)));
  }

  function handleEditName(id: string, newName: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, editedName: newName } : item)));
  }

  async function handleApply() {
    const toApply = items.filter((i) => i.selected && i.editedName.trim().length > 0);
    if (toApply.length === 0) return;

    setIsSubmitting(true);
    try {
      const modifiedMap = new Map<string, string>();
      for (const item of toApply) {
        modifiedMap.set(item.id, item.editedName.trim());
      }

      const modifiedCategories: ExternalProviderCategory[] = [];
      const allUpdatedCategories: ExternalProviderCategory[] = categories.map((cat) => {
        const targetName = modifiedMap.get(cat.id);
        if (targetName) {
          const updatedCat = { ...cat, name: targetName };
          modifiedCategories.push(updatedCat);
          return updatedCat;
        }
        return cat;
      });

      await updateCategoriesOrder(modifiedCategories, { allUpdatedCategories });

      toast.success(
        `Renamed ${modifiedCategories.length} ${
          modifiedCategories.length === 1 ? "category" : "categories"
        } successfully`,
      );
      onRenamed?.(allUpdatedCategories);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category names in ExternalProvider");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="gap-1.5 pb-2 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">Category Normalization Assistant</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Standardizes category names according to the Clean Default convention: strips redundant default currency
            suffixes (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">PLN</code>), translates
            legacy Ukrainian categories, and appends explicit currency tags for foreign or legacy categories (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">UAH</code>).
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">All categories are normalized</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                No default currency suffixes or unstandardized legacy names were detected among your active categories.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2 flex-1 min-h-0">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={selectAllId}
                  checked={allSelected}
                  onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
                />
                <Label htmlFor={selectAllId} className="cursor-pointer font-medium text-foreground select-none">
                  Select all ({items.length} proposed)
                </Label>
              </div>
              <span className="tabular-nums">
                {selectedCount} of {items.length} selected
              </span>
            </div>

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 border rounded-md p-2 bg-muted/10">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border p-2.5 text-xs transition-colors bg-card",
                    item.selected ? "border-primary/40 shadow-xs" : "border-border/50 opacity-60",
                    item.isCollision && "border-amber-500/50 bg-amber-500/5",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Checkbox
                      id={`rename-${item.id}`}
                      checked={item.selected}
                      onCheckedChange={(checked) => handleToggleItem(item.id, Boolean(checked))}
                    />
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[180px]">
                          {item.currentName}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1">
                          {item.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className={cn(
                                "h-4 px-1.5 text-[9px] font-medium leading-none",
                                tag.includes("Strip") &&
                                  "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                                tag.includes("Translate") &&
                                  "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                                tag.includes("Add") &&
                                  "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
                              )}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {item.isCollision && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="size-3 shrink-0" />
                          <span>Potential collision: another category shares this target name</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:w-56 shrink-0 pl-6 sm:pl-0">
                    <Input
                      value={item.editedName}
                      onChange={(e) => handleEditName(item.id, e.target.value)}
                      disabled={!item.selected || isSubmitting}
                      className="h-7 text-xs font-medium"
                      placeholder="Target name..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {items.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={selectedCount === 0 || isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Updating ExternalProvider...</span>
                </>
              ) : (
                <span>
                  Apply {selectedCount} {selectedCount === 1 ? "Rename" : "Renames"}
                </span>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
