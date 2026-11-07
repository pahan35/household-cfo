"use client";

import { useState } from "react";

import { ArrowRightLeft, Copy, FolderPlus, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";

import { CloudSyncBadge } from "@/components/cloud-sync-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CloudSyncStatus, ConflictRecord, ConflictResolutionChoice } from "@/lib/cloud-sync-reconciler";

import type { MortgageScenario } from "./mortgage-types";

export interface MortgageScenarioToolbarProps {
  scenarios: MortgageScenario[];
  activeScenarioId: string;
  isSyncing?: boolean;
  isOfflineFallback?: boolean;
  syncStatus?: CloudSyncStatus;
  conflicts?: ConflictRecord<MortgageScenario>[];
  activeConflict?: ConflictRecord<MortgageScenario> | null;
  onResolveConflict?: (entityId: string, choice: ConflictResolutionChoice) => Promise<void> | void;
  onSelectScenario: (id: string) => void;
  onCreateScenario: (name: string) => Promise<void>;
  onDuplicateScenario: (id: string, name?: string) => Promise<void>;
  onRenameScenario: (id: string, newName: string) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
  onSetPrimaryScenario: (id: string) => Promise<void>;
  onOpenCompare: () => void;
}

export function MortgageScenarioToolbar({
  scenarios,
  activeScenarioId,
  isSyncing = false,
  isOfflineFallback = false,
  syncStatus,
  conflicts = [],
  activeConflict,
  onResolveConflict,
  onSelectScenario,
  onCreateScenario,
  onDuplicateScenario,
  onRenameScenario,
  onDeleteScenario,
  onSetPrimaryScenario,
  onOpenCompare,
}: MortgageScenarioToolbarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameScenarioName, setRenameScenarioName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  let effectiveStatus: CloudSyncStatus = "synced";
  if (syncStatus) {
    effectiveStatus = syncStatus;
  } else if (isOfflineFallback) {
    effectiveStatus = "offline";
  } else if (isSyncing) {
    effectiveStatus = "syncing";
  }

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim() || isCreating) return;

    try {
      setIsCreating(true);
      await onCreateScenario(newScenarioName.trim());
      setNewScenarioName("");
      setCreateDialogOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameScenarioName.trim() || !activeScenario || isRenaming) return;

    try {
      setIsRenaming(true);
      await onRenameScenario(activeScenario.id, renameScenarioName.trim());
      setRenameDialogOpen(false);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activeScenario || isDeleting) return;

    try {
      setIsDeleting(true);
      await onDeleteScenario(activeScenario.id);
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const openRenameDialog = () => {
    if (!activeScenario) return;
    setRenameScenarioName(activeScenario.name);
    setRenameDialogOpen(true);
  };

  return (
    <div className="border-border/70 bg-muted/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 shadow-2xs">
      {/* Scenario Selector & Status */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-muted-foreground text-xs font-medium">Scenario:</span>

        <Select
          value={activeScenario?.id ?? ""}
          onValueChange={(val) => {
            if (val) onSelectScenario(val);
          }}
        >
          <SelectTrigger className="bg-background h-8 max-w-[280px] min-w-[200px] text-xs font-medium">
            <SelectValue placeholder="Select a scenario" />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((scenario) => (
              <SelectItem key={scenario.id} value={scenario.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span>{scenario.name}</span>
                  {scenario.isPrimary && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                      Primary
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeScenario?.isPrimary && (
          <Badge
            variant="outline"
            className="h-6 gap-1 border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400"
          >
            <Star className="size-3 fill-amber-500 text-amber-500" />
            Primary Household Plan
          </Badge>
        )}

        {/* Sync & Cloud Status */}
        <CloudSyncBadge
          status={effectiveStatus}
          conflicts={conflicts}
          activeConflict={activeConflict}
          onResolveConflict={onResolveConflict}
        />
      </div>

      {/* Scenario Action Buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewScenarioName("");
            setCreateDialogOpen(true);
          }}
          className="h-8 gap-1.5 text-xs"
        >
          <FolderPlus className="size-3.5" />
          New Scenario
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenCompare}
          disabled={scenarios.length < 2}
          className="h-8 gap-1.5 text-xs"
          title={scenarios.length < 2 ? "Create at least 2 scenarios to compare" : "Compare scenarios side-by-side"}
        >
          <ArrowRightLeft className="size-3.5" />
          Compare ({scenarios.length})
        </Button>

        {/* Active Scenario Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="size-4" />
              <span className="sr-only">Scenario actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!activeScenario?.isPrimary && (
              <DropdownMenuItem
                onClick={() => {
                  if (activeScenario) void onSetPrimaryScenario(activeScenario.id);
                }}
                className="gap-2 text-xs"
              >
                <Star className="size-3.5" />
                Set as Primary Plan
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => {
                if (activeScenario) void onDuplicateScenario(activeScenario.id);
              }}
              className="gap-2 text-xs"
            >
              <Copy className="size-3.5" />
              Duplicate Scenario
            </DropdownMenuItem>

            <DropdownMenuItem onClick={openRenameDialog} className="gap-2 text-xs">
              <Pencil className="size-3.5" />
              Rename Scenario
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              disabled={scenarios.length <= 1}
              className="text-destructive focus:text-destructive gap-2 text-xs"
            >
              <Trash2 className="size-3.5" />
              Delete Scenario
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog: Create Scenario */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Create Mortgage Scenario</DialogTitle>
              <DialogDescription>
                Save property acquisition and financing terms under a new scenario name.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <Label htmlFor="scenario-name">Scenario Name</Label>
              <Input
                id="scenario-name"
                placeholder="e.g. Wola 68m² Ready to Move"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newScenarioName.trim() || isCreating}>
                {isCreating ? "Creating..." : "Create Scenario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Scenario */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>Rename Scenario</DialogTitle>
              <DialogDescription>Update the display name of this scenario.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <Label htmlFor="rename-scenario-name">New Name</Label>
              <Input
                id="rename-scenario-name"
                value={renameScenarioName}
                onChange={(e) => setRenameScenarioName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameDialogOpen(false)} disabled={isRenaming}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameScenarioName.trim() || isRenaming}>
                {isRenaming ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Scenario Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Scenario</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="text-foreground font-semibold">{activeScenario?.name}</span>? This action will remove the
              scenario from your household records.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Scenario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
