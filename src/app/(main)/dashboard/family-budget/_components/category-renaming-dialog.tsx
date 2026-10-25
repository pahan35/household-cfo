"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { cn } from "cn";
import { AlertTriangle, ArrowRight, CheckCheck, Link2, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { updateCategoriesOrder } from "./external-provider-client";
import {
  buildCategoryNormalizationPlan,
  buildLastTransactionMap,
  type CategoryImpactRow,
  type CategoryNormalizationPlan,
  type CategoryNormalizationScope,
  type ExternalProviderCategory,
  type ExternalProviderTransaction,
  evaluateCategoryRenameState,
  formatMoney,
  isInNormalizationScope,
  type ProposedCategoryRename,
  sortRenamesTopologically,
} from "./external-provider-data";

interface PendingRenameItem extends ProposedCategoryRename {
  scope: CategoryNormalizationScope;
  selected: boolean;
  editedName: string;
}

type ViewMode = "changes" | "all" | "collisions";

export interface CategoryRenamingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExternalProviderCategory[];
  defaultCurrency?: string;
  transactions?: ExternalProviderTransaction[];
  defaultScope?: CategoryNormalizationScope;
  onRenamed?: (updatedCategories: ExternalProviderCategory[]) => void;
}

const SCOPES: CategoryNormalizationScope[] = ["expense", "income"];

const TIER_LABEL = { primary: "Default", foreign: "Foreign / legacy", archived: "Archived" } as const;

export function CategoryRenamingDialog({
  open,
  onOpenChange,
  categories,
  defaultCurrency = "PLN",
  transactions,
  defaultScope = "expense",
  onRenamed,
}: CategoryRenamingDialogProps) {
  const selectAllId = useId();
  const [scope, setScope] = useState<CategoryNormalizationScope>(defaultScope);
  const [view, setView] = useState<ViewMode>("changes");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PendingRenameItem[]>([]);
  const [showRemoved, setShowRemoved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plans = useMemo(() => {
    const result = {} as Record<CategoryNormalizationScope, CategoryNormalizationPlan>;
    for (const s of SCOPES) {
      result[s] = buildCategoryNormalizationPlan(categories, {
        defaultCurrency,
        transactions,
        scope: s,
        includeDeleted: showRemoved,
      });
    }
    return result;
  }, [categories, defaultCurrency, transactions, showRemoved]);

  const removedCount = useMemo(
    () => categories.filter((c) => c.deleted && isInNormalizationScope(c, scope, { includeDeleted: true })).length,
    [categories, scope],
  );

  const lastTransactionMap = useMemo(
    () => buildLastTransactionMap(transactions ?? [], categories),
    [transactions, categories],
  );

  // Reset tab/view when the dialog opens
  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setView("changes");
    setSearch("");
    setShowRemoved(false);
  }, [open, defaultScope]);

  // Re-generate proposed renames whenever dialog opens or input categories change
  useEffect(() => {
    if (!open) return;
    setItems(
      SCOPES.flatMap((s) =>
        plans[s].renames.map((p) => ({
          ...p,
          scope: s,
          selected: !p.isCollision,
          editedName: p.proposedName,
        })),
      ),
    );
  }, [open, plans]);

  const scopeItems = useMemo(() => items.filter((i) => i.scope === scope), [items, scope]);
  const scopeCategories = useMemo(() => plans[scope].rows.map((r) => r.category), [plans, scope]);

  const evaluation = useMemo(
    () =>
      evaluateCategoryRenameState(
        scopeCategories,
        scopeItems.map((i) => ({
          id: i.id,
          currentName: i.currentName,
          editedName: i.editedName,
          selected: i.selected,
          dependsOnCategoryIds: i.dependsOnCategoryIds,
        })),
      ),
    [scopeCategories, scopeItems],
  );

  const selectedItems = useMemo(() => scopeItems.filter((i) => i.selected), [scopeItems]);
  const selectedCount = selectedItems.length;
  const blockedCount = selectedItems.filter((i) => evaluation[i.id]?.status !== "ok").length;
  const allSelected = scopeItems.length > 0 && scopeItems.every((i) => i.selected);
  const collisionCount = scopeItems.filter((i) => i.selected && evaluation[i.id]?.status !== "ok").length;

  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch = (name: string) => !normalizedSearch || name.toLowerCase().includes(normalizedSearch);

  function handleToggleAll(checked: boolean) {
    setItems((prev) => prev.map((item) => (item.scope === scope ? { ...item, selected: checked } : item)));
  }

  function handleToggleItem(id: string, checked: boolean) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: checked } : item)));
  }

  function handleEditName(id: string, newName: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, editedName: newName } : item)));
  }

  async function handleApply() {
    const toApply = sortRenamesTopologically(selectedItems.filter((i) => i.editedName.trim().length > 0));
    if (toApply.length === 0 || blockedCount > 0) return;

    setIsSubmitting(true);
    try {
      const modifiedMap = new Map<string, string>();
      for (const item of toApply) {
        modifiedMap.set(item.id, item.editedName.trim());
      }

      const byId = new Map(categories.map((cat) => [cat.id, cat]));
      // Submit in topological order: vacating renames (step 1) before claiming renames (step 2)
      const modifiedCategories: ExternalProviderCategory[] = [];
      for (const item of toApply) {
        const cat = byId.get(item.id);
        const targetName = modifiedMap.get(item.id);
        if (cat && targetName) {
          modifiedCategories.push({ ...cat, name: targetName });
        }
      }
      const updatedById = new Map(modifiedCategories.map((c) => [c.id, c]));
      const allUpdatedCategories = categories.map((cat) => updatedById.get(cat.id) ?? cat);

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

  function renderImpactMeta(row: CategoryImpactRow) {
    const last = lastTransactionMap.get(row.id);
    return (
      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[10px]">
        <Badge variant="outline" className="h-4 px-1.5 font-mono text-[9px] leading-none">
          #{row.order}
        </Badge>
        {row.category.deleted ? (
          <Badge
            variant="outline"
            className="text-muted-foreground/80 h-4 border-dashed px-1.5 font-mono text-[9px] leading-none"
          >
            Removed
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] leading-none">
            {TIER_LABEL[row.tier]}
          </Badge>
        )}
        <span>
          {last ? `Last: ${last.formattedDate} · ${formatMoney(last.amount, last.currency)}` : "No recent transactions"}
        </span>
      </div>
    );
  }

  function renderRow(row: CategoryImpactRow) {
    const item = scopeItems.find((i) => i.id === row.id);
    const evalState = item ? evaluation[item.id] : undefined;
    const hasProblem = Boolean(item?.selected && evalState && evalState.status !== "ok");

    if (!item) {
      return (
        <div
          key={row.id}
          className={cn(
            "bg-card border-border/70 flex flex-col gap-1 rounded-md border p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between",
            row.category.deleted && "bg-muted/20 opacity-75",
          )}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-foreground font-semibold break-words">{row.name}</span>
            {renderImpactMeta(row)}
          </div>
          <Badge variant="outline" className="h-4 w-fit px-1.5 text-[9px] leading-none">
            Unchanged
          </Badge>
        </div>
      );
    }

    return (
      <div
        key={row.id}
        className={cn(
          "flex flex-col justify-between gap-2 rounded-md border p-2.5 text-xs transition-colors sm:flex-row sm:items-center",
          item.selected ? "bg-card border-primary/40 shadow-xs" : "bg-muted/25 border-border/70 text-foreground",
          hasProblem && "border-amber-500/60 bg-amber-500/5",
          row.category.deleted && "bg-muted/20 opacity-75",
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <Checkbox
            id={`rename-${item.id}`}
            className="mt-0.5"
            checked={item.selected}
            onCheckedChange={(checked) => handleToggleItem(item.id, Boolean(checked))}
            aria-label={`Select rename for ${item.currentName}`}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground font-semibold break-words">{item.currentName}</span>
              <ArrowRight className="text-muted-foreground size-3 shrink-0" />
              {item.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "h-4 px-1.5 text-[9px] leading-none font-medium",
                    tag.includes("Strip") && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    tag.includes("Translate") && "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                    tag.includes("Add") && "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
                  )}
                >
                  {tag}
                </Badge>
              ))}
              {!item.selected && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] leading-none">
                  Skipped / Unchanged
                </Badge>
              )}
              <Badge variant="outline" className="h-4 px-1.5 text-[9px] leading-none">
                Step {item.stepOrder}
              </Badge>
            </div>
            {renderImpactMeta(row)}
            {hasProblem && evalState?.message && (
              <div
                role="alert"
                className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="size-3 shrink-0" />
                <span>{evalState.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-6 sm:w-64 sm:pl-0">
          <Input
            value={item.editedName}
            onChange={(e) => handleEditName(item.id, e.target.value)}
            disabled={isSubmitting}
            aria-label={`Target name for ${item.currentName}`}
            className="h-7 text-xs font-medium"
            placeholder="Target name..."
          />
        </div>
      </div>
    );
  }

  const plan = plans[scope];
  const rowById = new Map(plan.rows.map((r) => [r.id, r]));
  const groupedIds = new Set(plan.groups.filter((g) => g.isCoupled).flatMap((g) => g.members.map((m) => m.id)));

  function renderBody() {
    if (view === "all") {
      const rows = plan.rows.filter((r) => matchesSearch(r.name));
      return rows.map(renderRow);
    }
    if (view === "collisions") {
      return scopeItems
        .filter((i) => i.selected && evaluation[i.id]?.status !== "ok" && matchesSearch(i.currentName))
        .map((i) => rowById.get(i.id))
        .filter((r): r is CategoryImpactRow => Boolean(r))
        .map(renderRow);
    }
    const coupled = plan.groups.filter((g) => g.isCoupled);
    const standalone = scopeItems.filter((i) => !groupedIds.has(i.id) && matchesSearch(i.currentName));
    return (
      <>
        {coupled.map((group) => {
          const members = group.members.filter((m) => matchesSearch(m.name) || matchesSearch(group.baseName));
          if (members.length === 0) return null;
          return (
            <section key={group.baseName} className="flex flex-col gap-1.5 rounded-md border border-dashed p-2">
              <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px] font-medium">
                <Link2 className="size-3" />
                <span>Concept group “{group.baseName}” — coupled rename chain</span>
              </div>
              {[...members].sort((a, b) => (a.rename?.stepOrder ?? 3) - (b.rename?.stepOrder ?? 3)).map(renderRow)}
            </section>
          );
        })}
        {standalone.map((i) => rowById.get(i.id)).map((r) => (r ? renderRow(r) : null))}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col p-6 sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="gap-1.5 border-b pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" />
            <DialogTitle className="text-base font-semibold">Category Normalization Assistant</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Standardizes category names according to the Clean Default convention: strips redundant default currency
            suffixes (<code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">{defaultCurrency}</code>),
            translates legacy Ukrainian categories, and appends explicit currency tags for foreign or legacy categories
            (<code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">UAH</code>). Expense and income
            categories are normalized independently.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={scope} onValueChange={(v) => setScope(v as CategoryNormalizationScope)}>
            <TabsList>
              <TabsTrigger value="expense">Expenses ({plans.expense.renames.length})</TabsTrigger>
              <TabsTrigger value="income">Income ({plans.income.renames.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="changes">Concept Groups &amp; Changes</TabsTrigger>
              <TabsTrigger value="all">All Categories (#Order)</TabsTrigger>
              <TabsTrigger value="collisions">Collisions ({collisionCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              aria-label="Search categories"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {(removedCount > 0 || showRemoved) && (
            <Button
              type="button"
              variant={showRemoved ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowRemoved((prev) => !prev)}
              className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
            >
              <Trash2 className="text-muted-foreground size-3.5" />
              <span>{showRemoved ? "Hide removed" : `Show removed (${removedCount})`}</span>
            </Button>
          )}
        </div>

        {scopeItems.length === 0 && view !== "all" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">All {scope} categories are normalized</p>
              <p className="text-muted-foreground max-w-sm text-xs">
                No default currency suffixes or unstandardized legacy names were detected among your active categories.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 py-2">
            <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={selectAllId}
                  checked={allSelected}
                  onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
                />
                <Label htmlFor={selectAllId} className="text-foreground cursor-pointer font-medium select-none">
                  Select all ({scopeItems.length} proposed)
                </Label>
              </div>
              <span className="tabular-nums">
                {selectedCount} of {scopeItems.length} selected
              </span>
            </div>

            <div className="bg-muted/10 flex-1 space-y-2 overflow-y-auto rounded-md border p-2 pr-3">
              {renderBody()}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t pt-3 sm:gap-0">
          {blockedCount > 0 && (
            <span className="mr-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              Resolve {blockedCount} collision{blockedCount === 1 ? "" : "s"} to apply
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {scopeItems.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={selectedCount === 0 || blockedCount > 0 || isSubmitting}
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
