"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Archive, Check, FolderEdit, Plus, Search, Settings2, Trash2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CategoryType,
  type ExternalProviderCategory,
  extractCanonicalBaseName,
  formatMoney,
  isAccountType,
  isArchivedCategoryName,
  type StatCategoryPoint,
} from "./external-provider-data";
import type { ExclusionPreset } from "./expense-transforms";
import type { useExclusionPresets } from "./use-exclusion-presets";

export interface PresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: ExternalProviderCategory[];
  statCategories?: StatCategoryPoint[];
  defaultCurrency?: string;
  presetController: ReturnType<typeof useExclusionPresets>;
}

/**
 * Filters categories to omit account types, income sources, and savings goals.
 */
export function filterExpenseCategories(
  categories: ExternalProviderCategory[],
  statCategories: StatCategoryPoint[] = [],
): ExternalProviderCategory[] {
  const categoryMap = new Map<string, ExternalProviderCategory>();
  for (const cat of categories) {
    if (cat.deleted) continue;
    if (isAccountType(cat.categoryType)) continue;
    const typeNum = Number(cat.categoryType);
    if (typeNum === CategoryType.Income) continue;
    if (typeNum === CategoryType.Goal || typeNum === CategoryType.ClassicGoal) continue;

    categoryMap.set(cat.id, cat);
  }

  for (const sc of statCategories) {
    if (!categoryMap.has(sc.id)) {
      const originalCat = categories.find((c) => c.id === sc.id);
      if (originalCat) {
        const typeNum = Number(originalCat.categoryType);
        if (
          originalCat.deleted ||
          isAccountType(originalCat.categoryType) ||
          typeNum === CategoryType.Income ||
          typeNum === CategoryType.Goal ||
          typeNum === CategoryType.ClassicGoal
        ) {
          continue;
        }
      }

      const title = sc.title ?? sc.name ?? "Expense";
      categoryMap.set(sc.id, {
        id: sc.id,
        name: title,
        categoryType: CategoryType.Expense,
        amount: 0,
        limitAmount: sc.limitAmount,
      });
    }
  }

  return Array.from(categoryMap.values());
}

/**
 * Checks whether an archived category should be considered active in the preset dialog.
 */
export function isPresetCategoryActive(cat: ExternalProviderCategory, spend: number, isExcluded: boolean): boolean {
  const isArchived = isArchivedCategoryName(cat.name);
  if (!isArchived) return true;
  const hasLimit = (cat.limitAmount ?? 0) > 0;
  return spend > 0 || hasLimit || isExcluded;
}

/**
 * Sanitizes category display name and detects archive prefix.
 */
export function sanitizePresetCategoryName(
  name: string,
  defaultCurrency = "PLN",
): { displayName: string; isArchived: boolean } {
  const isArchived = isArchivedCategoryName(name);
  const rawDisplayName = extractCanonicalBaseName(name, defaultCurrency);
  const displayName = isArchived ? rawDisplayName.replace(/^_+/, "").trim() : rawDisplayName;
  return { displayName, isArchived };
}

export function PresetDialog({
  open,
  onOpenChange,
  categories = [],
  statCategories = [],
  defaultCurrency = "PLN",
  presetController,
}: PresetDialogProps) {
  const {
    presets,
    activePreset,
    activePresetId,
    setActivePresetId,
    updatePreset,
    createPreset,
    deletePreset,
    renamePreset,
  } = presetController;

  const [selectedPresetId, setSelectedPresetId] = useState<string>(activePresetId);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const searchInputId = useId();

  // Find the currently selected preset object
  const currentEditingPreset = useMemo(() => {
    return presets.find((p) => p.id === selectedPresetId) ?? activePreset;
  }, [presets, selectedPresetId, activePreset]);

  // Working copy of excluded category IDs for the currently inspected preset
  const [draftExclusions, setDraftExclusions] = useState<string[]>(() => currentEditingPreset.expenseExclusions);

  // Synchronize draft exclusions and preset state whenever dialog opens or active preset changes
  useEffect(() => {
    if (open) {
      setSelectedPresetId(activePresetId);
      const target = presets.find((p) => p.id === activePresetId) ?? activePreset;
      setDraftExclusions(target.expenseExclusions);
      setRenameValue(target.name);
      setIsCreatingNew(false);
      setIsRenaming(false);
      setSearchQuery("");
      setShowArchived(false);
    }
  }, [open, activePresetId, activePreset, presets]);

  // Sync draft exclusions when inspected preset changes
  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    const target = presets.find((p) => p.id === id);
    if (target) {
      setDraftExclusions(target.expenseExclusions);
      setRenameValue(target.name);
    }
    setIsCreatingNew(false);
    setIsRenaming(false);
  };

  // Map stat points by category ID to show period spend
  const spendMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const sc of statCategories) {
      const raw = sc.value ?? sc.amount ?? sc.currentAmount;
      const amount = Math.max(0, Number(raw) || 0);
      map.set(sc.id, amount);
    }
    return map;
  }, [statCategories]);

  // Extract all non-deleted true expense categories (excluding accounts, income, and goals)
  const expenseCategories = useMemo(() => {
    const list = filterExpenseCategories(categories, statCategories);

    // Sort: categories in draftExclusions first, then descending by period spend
    return list.sort((a, b) => {
      const aExcluded = draftExclusions.includes(a.id);
      const bExcluded = draftExclusions.includes(b.id);
      if (aExcluded && !bExcluded) return -1;
      if (!aExcluded && bExcluded) return 1;

      const spendA = spendMap.get(a.id) ?? 0;
      const spendB = spendMap.get(b.id) ?? 0;
      return spendB - spendA;
    });
  }, [categories, statCategories, draftExclusions, spendMap]);

  // Count hidden inactive archived categories
  const hiddenArchivedCount = useMemo(() => {
    let count = 0;
    for (const cat of expenseCategories) {
      if (!isArchivedCategoryName(cat.name)) continue;
      const spend = spendMap.get(cat.id) ?? 0;
      const isExcluded = draftExclusions.includes(cat.id);
      if (!isPresetCategoryActive(cat, spend, isExcluded)) {
        count += 1;
      }
    }
    return count;
  }, [expenseCategories, spendMap, draftExclusions]);

  // Categories visible according to archive toggle
  const visibleCategories = useMemo(() => {
    if (showArchived) return expenseCategories;
    return expenseCategories.filter((cat) => {
      const spend = spendMap.get(cat.id) ?? 0;
      const isExcluded = draftExclusions.includes(cat.id);
      return isPresetCategoryActive(cat, spend, isExcluded);
    });
  }, [expenseCategories, showArchived, spendMap, draftExclusions]);

  // Filtered categories based on search input
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleCategories;
    return visibleCategories.filter((cat) => {
      const name = cat.name.toLowerCase();
      const baseName = extractCanonicalBaseName(cat.name, defaultCurrency).toLowerCase();
      return name.includes(q) || baseName.includes(q);
    });
  }, [visibleCategories, searchQuery, defaultCurrency]);

  // Metric stats for draft selection
  const draftExcludedStats = useMemo(() => {
    let count = 0;
    let sum = 0;
    for (const cat of expenseCategories) {
      if (draftExclusions.includes(cat.id)) {
        count += 1;
        sum += spendMap.get(cat.id) ?? 0;
      }
    }
    return { count, sum };
  }, [expenseCategories, draftExclusions, spendMap]);

  const toggleCategory = (categoryId: string) => {
    setDraftExclusions((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const handleSaveAndApply = () => {
    const updated: ExclusionPreset = {
      ...currentEditingPreset,
      expenseExclusions: draftExclusions,
    };
    updatePreset(updated);
    setActivePresetId(updated.id);
    onOpenChange(false);
  };

  const handleCreateNew = () => {
    if (!newPresetName.trim()) return;
    const created = createPreset(newPresetName.trim(), draftExclusions, currentEditingPreset.incomeDeductions);
    setSelectedPresetId(created.id);
    setNewPresetName("");
    setIsCreatingNew(false);
  };

  const handleRename = () => {
    if (!renameValue.trim()) return;
    renamePreset(selectedPresetId, renameValue.trim());
    setIsRenaming(false);
  };

  const handleDelete = () => {
    deletePreset(selectedPresetId);
    setSelectedPresetId(activePresetId);
    setDraftExclusions(activePreset.expenseExclusions);
    setIsRenaming(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-xl flex-col gap-4 p-5 sm:max-w-xl">
        <DialogHeader className="gap-1 border-b pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4.5 text-primary" />
            <DialogTitle className="text-base font-semibold">Exclusion Presets & Fixed Obligations</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs">
            Exclude non-controllable obligations (Rent, Insurance PLN, tuition, loans) from living expenses. Excluded
            categories are omitted from controllable spending and deducted from the income pool.
          </DialogDescription>
        </DialogHeader>

        {/* Preset Management Strip */}
        <div className="bg-muted/40 flex flex-col gap-2.5 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Select Preset:</Label>
              <Select value={selectedPresetId} onValueChange={handleSelectPreset}>
                <SelectTrigger className="h-8 min-w-44 text-xs">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectLabel>Exclusion Presets</SelectLabel>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} {p.id === activePresetId ? " (Active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              {!isCreatingNew && !isRenaming && (
                <>
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsRenaming(true);
                      setRenameValue(currentEditingPreset.name);
                    }}
                  >
                    <FolderEdit className="size-3.5" />
                    Rename
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsCreatingNew(true);
                      setNewPresetName("");
                    }}
                  >
                    <Plus className="size-3.5" />
                    New
                  </Button>
                  {presets.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive size-7"
                      title="Delete or reset this preset"
                      onClick={handleDelete}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Delete Preset</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Inline Rename Form */}
          {isRenaming && (
            <div className="flex items-center gap-2 pt-1 border-t">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter preset name"
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
              />
              <Button size="xs" className="h-7 text-xs" onClick={handleRename}>
                Save
              </Button>
              <Button size="xs" variant="ghost" className="h-7 text-xs" onClick={() => setIsRenaming(false)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Inline Create New Preset Form */}
          {isCreatingNew && (
            <div className="flex items-center gap-2 pt-1 border-t">
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="New preset name (e.g. No Rent & Insurance)"
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateNew();
                  if (e.key === "Escape") setIsCreatingNew(false);
                }}
              />
              <Button size="xs" className="h-7 text-xs" onClick={handleCreateNew}>
                Create
              </Button>
              <Button size="xs" variant="ghost" className="h-7 text-xs" onClick={() => setIsCreatingNew(false)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Excluded Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary" className="text-[11px] font-normal">
              {draftExcludedStats.count} {draftExcludedStats.count === 1 ? "category" : "categories"} excluded
            </Badge>
            {draftExcludedStats.sum > 0 && (
              <Badge variant="outline" className="text-[11px] font-normal text-rose-600 dark:text-rose-400">
                Total Excluded: {formatMoney(draftExcludedStats.sum, defaultCurrency)}
              </Badge>
            )}
          </div>
        </div>

        {/* Search Input & Archive Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5 pointer-events-none" />
            <Input
              id={searchInputId}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories (e.g. Rent, Insurance, Tuition)..."
              className="h-8.5 pl-8 text-xs"
            />
          </div>
          {(hiddenArchivedCount > 0 || showArchived) && (
            <Button
              type="button"
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowArchived((prev) => !prev)}
              className="h-8.5 shrink-0 gap-1.5 px-2.5 text-xs font-normal"
            >
              <Archive className="text-muted-foreground size-3.5" />
              <span>{showArchived ? "Hide archived" : `Show archived (${hiddenArchivedCount})`}</span>
            </Button>
          )}
        </div>

        {/* Scrollable Categories Checklist */}
        <div className="flex-1 overflow-y-auto max-h-[46vh] rounded-md border p-1">
          {filteredCategories.length === 0 ? (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-xs">
              No categories match &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="divide-border/40 divide-y">
              {filteredCategories.map((cat) => {
                const isExcluded = draftExclusions.includes(cat.id);
                const { displayName, isArchived } = sanitizePresetCategoryName(cat.name, defaultCurrency);
                const spend = spendMap.get(cat.id) ?? 0;

                return (
                  <label
                    key={cat.id}
                    htmlFor={`cat-check-${cat.id}`}
                    className={`flex cursor-pointer items-center justify-between gap-3 p-2 rounded-md transition-colors hover:bg-muted/50 ${
                      isExcluded ? "bg-muted/30" : ""
                    } ${isArchived && !isExcluded ? "opacity-60 hover:opacity-100" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Checkbox
                        id={`cat-check-${cat.id}`}
                        checked={isExcluded}
                        onCheckedChange={() => toggleCategory(cat.id)}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`text-xs font-medium truncate ${isExcluded ? "text-primary" : ""}`}>
                            {displayName}
                          </span>
                          {isArchived && (
                            <Badge
                              variant="secondary"
                              className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal shrink-0"
                            >
                              Archived
                            </Badge>
                          )}
                          {cat.name !== displayName && !isArchived && (
                            <span className="text-muted-foreground text-[10px] truncate">({cat.name})</span>
                          )}
                        </div>
                        {cat.limitAmount && cat.limitAmount > 0 ? (
                          <span className="text-muted-foreground text-[10px]">
                            Limit: {formatMoney(cat.limitAmount, defaultCurrency)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {spend > 0 && (
                        <span className="text-xs font-semibold tabular-nums">
                          {formatMoney(spend, defaultCurrency)}
                        </span>
                      )}
                      {isExcluded && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          Excluded
                        </Badge>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Dialog Footer Actions */}
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="text-muted-foreground flex items-center text-[11px]">
            {draftExclusions.length} total categories designated as fixed exclusions
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAndApply}>
              <Check className="size-3.5" />
              Save & Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
