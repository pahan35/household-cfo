"use client";

import { useState } from "react";

import { cn } from "cn";
import { AlertTriangle, Cloud, CloudOff, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { CloudSyncStatus, ConflictRecord, ConflictResolutionChoice } from "@/lib/cloud-sync-reconciler";

export interface CloudConflictContentProps<T = unknown> {
  conflicts: ConflictRecord<T>[];
  activeConflict?: ConflictRecord<T> | null;
  onSelectConflict?: (conflict: ConflictRecord<T>) => void;
  onResolve: (entityId: string, choice: ConflictResolutionChoice) => Promise<void> | void;
  onClose?: () => void;
}

export function CloudConflictContent<T = unknown>({
  conflicts,
  activeConflict,
  onSelectConflict,
  onResolve,
  onClose,
}: CloudConflictContentProps<T>) {
  const [isResolving, setIsResolving] = useState(false);
  const current = activeConflict ?? conflicts[0];

  if (!current) return null;

  const handleChoice = async (choice: ConflictResolutionChoice) => {
    try {
      setIsResolving(true);
      await onResolve(current.entityId, choice);
      if (conflicts.length <= 1) {
        onClose?.();
      }
    } finally {
      setIsResolving(false);
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return "Unknown";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-5" />
          <h3 className="text-foreground text-base font-semibold">Cloud Synchronization Conflict</h3>
        </div>
        <p className="text-muted-foreground text-xs">
          Concurrent changes were detected for{" "}
          <span className="text-foreground font-semibold">{current.entityName}</span>. Both your local browser and
          another device updated this record. Choose which version to retain.
        </p>
      </div>

      {conflicts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b pb-2">
          <span className="text-muted-foreground mr-1 self-center text-xs">Conflicting records:</span>
          {conflicts.map((c) => (
            <Button
              key={c.entityId}
              type="button"
              variant={c.entityId === current.entityId ? "default" : "outline"}
              size="xs"
              onClick={() => onSelectConflict?.(c)}
            >
              {c.entityName}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
        {/* Local Version Column */}
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-foreground flex items-center justify-between font-semibold">
            <span>Local Browser Draft</span>
            <Badge variant="outline" className="text-[10px]">
              This Device
            </Badge>
          </div>
          <div className="text-muted-foreground text-[11px]">Last saved: {formatTimestamp(current.localUpdatedAt)}</div>
          <pre className="text-foreground bg-background/80 max-h-56 overflow-auto rounded p-2 font-mono text-[10px] leading-relaxed">
            {JSON.stringify(current.localVersion, null, 2)}
          </pre>
        </div>

        {/* Remote Cloud Column */}
        <div className="border-border bg-muted/20 flex flex-col gap-2 rounded-md border p-3">
          <div className="text-foreground flex items-center justify-between font-semibold">
            <span>Supabase Cloud Version</span>
            <Badge variant="secondary" className="text-[10px]">
              Remote
            </Badge>
          </div>
          <div className="text-muted-foreground text-[11px]">
            Last saved: {formatTimestamp(current.remoteUpdatedAt)}
          </div>
          <pre className="text-foreground bg-background/80 max-h-56 overflow-auto rounded p-2 font-mono text-[10px] leading-relaxed">
            {JSON.stringify(current.remoteVersion, null, 2)}
          </pre>
        </div>
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          disabled={isResolving}
          onClick={() => handleChoice("use_cloud")}
          className="text-xs"
        >
          Use Cloud (Discard Local)
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={isResolving}
          onClick={() => handleChoice("keep_local")}
          className="text-xs"
        >
          Keep Local (Push to Cloud)
        </Button>
      </div>
    </div>
  );
}

export interface CloudConflictDialogProps<T = unknown> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictRecord<T>[];
  activeConflict?: ConflictRecord<T> | null;
  onSelectConflict?: (conflict: ConflictRecord<T>) => void;
  onResolve: (entityId: string, choice: ConflictResolutionChoice) => Promise<void> | void;
}

/**
 * Interactive dialog displaying concurrent divergence between local drafts and Supabase Cloud.
 * Allows the user to inspect changes and choose "Keep Local" vs "Use Cloud".
 */
export function CloudConflictDialog<T = unknown>({
  open,
  onOpenChange,
  conflicts,
  activeConflict,
  onSelectConflict,
  onResolve,
}: CloudConflictDialogProps<T>) {
  if (!conflicts.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <CloudConflictContent
          conflicts={conflicts}
          activeConflict={activeConflict}
          onSelectConflict={onSelectConflict}
          onResolve={onResolve}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export interface CloudSyncBadgeProps<T = unknown> {
  status: CloudSyncStatus;
  conflicts?: ConflictRecord<T>[];
  activeConflict?: ConflictRecord<T> | null;
  onResolveConflict?: (entityId: string, choice: ConflictResolutionChoice) => Promise<void> | void;
  className?: string;
  lastSyncedAt?: Date | string | null;
}

/**
 * Standard visual indicator badge for cloud synchronization state across family budget screens.
 * Renders:
 * - `synced`: Emerald Cloud icon, text "Cloud Synced", tooltip "Synchronized with Supabase Cloud".
 * - `syncing`: Spinning RotateCw icon, text "Syncing...".
 * - `offline`: Muted CloudOff icon, text "Local Cache", tooltip "Operating offline. Edits are saved locally.".
 * - `conflict`: Amber AlertTriangle icon, text "Conflict (N)" or "Conflict Detected", interactive trigger to resolve.
 */
export function CloudSyncBadge<T = unknown>({
  status,
  conflicts = [],
  activeConflict,
  onResolveConflict,
  className,
  lastSyncedAt,
}: CloudSyncBadgeProps<T>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (status === "offline") {
    return (
      <Badge
        variant="outline"
        className={cn("border-muted-foreground/30 text-muted-foreground h-6 gap-1 text-[11px]", className)}
        title="Operating offline. Edits are saved locally."
      >
        <CloudOff className="size-3" />
        Local Cache
      </Badge>
    );
  }

  if (status === "syncing") {
    return (
      <Badge
        variant="outline"
        className={cn("border-primary/30 text-primary h-6 gap-1 text-[11px]", className)}
        title="Synchronizing changes with Supabase..."
      >
        <RotateCw className="size-3 animate-spin" />
        Syncing...
      </Badge>
    );
  }

  if (status === "conflict" || conflicts.length > 0) {
    const conflictCount = conflicts.length;
    const label = conflictCount > 1 ? `Conflict (${conflictCount})` : "Conflict Detected";

    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex cursor-pointer items-center rounded focus:outline-hidden"
          title="Concurrent conflict detected. Click to resolve."
        >
          <Badge
            variant="outline"
            className={cn(
              "h-6 gap-1 border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400",
              className,
            )}
          >
            <AlertTriangle className="size-3 text-amber-500" />
            {label}
          </Badge>
        </button>

        {onResolveConflict && (
          <CloudConflictDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            conflicts={conflicts}
            activeConflict={activeConflict}
            onResolve={onResolveConflict}
          />
        )}
      </>
    );
  }

  // Default: Cloud Synced
  return (
    <Badge
      variant="ghost"
      className={cn("text-muted-foreground h-6 gap-1 text-[11px]", className)}
      title="Synchronized with Supabase Cloud"
    >
      <Cloud className="size-3 text-emerald-600 dark:text-emerald-400" />
      Cloud Synced
    </Badge>
  );
}
