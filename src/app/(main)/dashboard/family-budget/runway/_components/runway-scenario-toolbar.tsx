"use client";

import { useState } from "react";

import {
  Briefcase,
  Cloud,
  CloudOff,
  Copy,
  FolderPlus,
  MoreVertical,
  Pencil,
  RotateCw,
  Star,
  Trash2,
} from "lucide-react";

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

import type { RunwayScenario } from "./runway-types";

export interface RunwayScenarioToolbarProps {
  scenarios: RunwayScenario[];
  activeScenarioId: string;
  isSyncing?: boolean;
  isOfflineFallback?: boolean;
  linkedOfferTitle?: string | null;
  onSelectScenario: (id: string) => void;
  onCreateScenario: (name: string) => Promise<void>;
  onDuplicateScenario: (id: string, name?: string) => Promise<void>;
  onRenameScenario: (id: string, newName: string) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
  onSetPrimaryScenario: (id: string) => Promise<void>;
}

export function RunwayScenarioToolbar({
  scenarios,
  activeScenarioId,
  isSyncing = false,
  isOfflineFallback = false,
  linkedOfferTitle,
  onSelectScenario,
  onCreateScenario,
  onDuplicateScenario,
  onRenameScenario,
  onDeleteScenario,
  onSetPrimaryScenario,
}: RunwayScenarioToolbarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameScenarioName, setRenameScenarioName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        <span className="text-muted-foreground text-xs font-medium">Runway Plan:</span>

        <Select
          value={activeScenario?.id ?? ""}
          onValueChange={(val) => {
            if (val) onSelectScenario(val);
          }}
        >
          <SelectTrigger className="bg-background h-8 max-w-[280px] min-w-[200px] text-xs font-medium">
            <SelectValue placeholder="Select a scenario">{activeScenario?.name}</SelectValue>
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

        {linkedOfferTitle && (
          <Badge
            variant="outline"
            className="h-6 gap-1 border-blue-500/40 bg-blue-500/10 text-[11px] text-blue-700 dark:text-blue-400"
            title="Baseline cashflow linked to active Offer Comparator package"
          >
            <Briefcase className="size-3 text-blue-500" />
            Offer: {linkedOfferTitle}
          </Badge>
        )}

        {/* Sync & Cloud Status */}
        {isOfflineFallback && (
          <Badge
            variant="outline"
            className="border-muted-foreground/30 text-muted-foreground h-6 gap-1 text-[11px]"
            title="Operating with locally cached scenarios"
          >
            <CloudOff className="size-3" />
            Local Cache
          </Badge>
        )}
        {!isOfflineFallback && isSyncing && (
          <Badge variant="outline" className="border-primary/30 text-primary h-6 gap-1 text-[11px]">
            <RotateCw className="size-3 animate-spin" />
            Syncing...
          </Badge>
        )}
        {!isOfflineFallback && !isSyncing && (
          <Badge
            variant="ghost"
            className="text-muted-foreground h-6 gap-1 text-[11px]"
            title="Synced with Supabase Cloud"
          >
            <Cloud className="size-3 text-emerald-600 dark:text-emerald-400" />
            Cloud Synced
          </Badge>
        )}
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
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Create New Runway Scenario</DialogTitle>
              <DialogDescription>
                Add a new austerity projection with independent JDG statutory settings and category retention cuts.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="scenario-name">Scenario Name</Label>
                <Input
                  id="scenario-name"
                  placeholder="e.g. Extreme Austerity with Suspended JDG"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newScenarioName.trim() || isCreating}>
                {isCreating ? (
                  <>
                    <RotateCw className="mr-2 size-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Scenario"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Scenario */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>Rename Scenario</DialogTitle>
              <DialogDescription>Update the display title for this runway scenario.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rename-scenario">Scenario Name</Label>
                <Input
                  id="rename-scenario"
                  value={renameScenarioName}
                  onChange={(e) => setRenameScenarioName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={isRenaming}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameScenarioName.trim() || isRenaming}>
                {isRenaming ? (
                  <>
                    <RotateCw className="mr-2 size-3.5 animate-spin" />
                    Renaming...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Runway Scenario?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{activeScenario?.name}&rdquo;? This action will remove its
              associated category cuts and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <RotateCw className="mr-2 size-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Scenario"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
