"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import type { CloudSyncStatus, ConflictRecord, ConflictResolutionChoice } from "@/lib/cloud-sync-reconciler";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface CloudSyncState<T = unknown> {
  status: CloudSyncStatus;
  conflicts: ConflictRecord<T>[];
  activeConflict: ConflictRecord<T> | null;
  lastSyncedAt: string | null;
}

export function createInitialCloudSyncState<T = unknown>(options?: {
  initialStatus?: CloudSyncStatus;
  storageSyncKey?: string;
  storage?: StorageLike | null;
  isOnline?: boolean;
}): CloudSyncState<T> {
  const isOffline = options?.isOnline === false;
  const status: CloudSyncStatus = isOffline ? "offline" : (options?.initialStatus ?? "synced");

  let lastSyncedAt: string | null = null;
  if (options?.storageSyncKey && options.storage) {
    try {
      lastSyncedAt = options.storage.getItem(options.storageSyncKey) ?? null;
    } catch {
      lastSyncedAt = null;
    }
  }

  return {
    status,
    conflicts: [],
    activeConflict: null,
    lastSyncedAt,
  };
}

export function reduceSetSyncing<T>(state: CloudSyncState<T>): CloudSyncState<T> {
  return {
    ...state,
    status: "syncing",
  };
}

export function reduceSetOffline<T>(state: CloudSyncState<T>): CloudSyncState<T> {
  return {
    ...state,
    status: "offline",
  };
}

export function reduceSetSynced<T>(
  state: CloudSyncState<T>,
  timestamp: string = new Date().toISOString(),
  storageSyncKey?: string,
  storage?: StorageLike | null,
): CloudSyncState<T> {
  if (storageSyncKey && storage) {
    try {
      storage.setItem(storageSyncKey, timestamp);
    } catch {
      // Ignore storage errors
    }
  }

  return {
    ...state,
    status: "synced",
    conflicts: [],
    activeConflict: null,
    lastSyncedAt: timestamp,
  };
}

export function reduceSetConflictDetected<T>(
  state: CloudSyncState<T>,
  conflicts: ConflictRecord<T>[],
): CloudSyncState<T> {
  return {
    ...state,
    status: conflicts.length > 0 ? "conflict" : "synced",
    conflicts,
    activeConflict: conflicts[0] ?? null,
  };
}

export function reduceResolveConflict<T>(
  state: CloudSyncState<T>,
  entityId: string,
  timestamp: string = new Date().toISOString(),
  storageSyncKey?: string,
  storage?: StorageLike | null,
): CloudSyncState<T> {
  const remaining = state.conflicts.filter((c) => c.entityId !== entityId);

  if (remaining.length === 0) {
    if (storageSyncKey && storage) {
      try {
        storage.setItem(storageSyncKey, timestamp);
      } catch {
        // Ignore
      }
    }
    return {
      ...state,
      status: "synced",
      conflicts: [],
      activeConflict: null,
      lastSyncedAt: timestamp,
    };
  }

  return {
    ...state,
    status: "conflict",
    conflicts: remaining,
    activeConflict: remaining[0],
  };
}

export interface UseCloudSyncStateOptions<T = unknown> {
  initialStatus?: CloudSyncStatus;
  storageSyncKey?: string;
  storage?: StorageLike | null;
  onReconnect?: () => void | Promise<void>;
  onConflictResolved?: (
    entityId: string,
    choice: ConflictResolutionChoice,
    record: ConflictRecord<T>,
  ) => void | Promise<void>;
}

export interface UseCloudSyncStateReturn<T = unknown> {
  status: CloudSyncStatus;
  isSyncing: boolean;
  isOffline: boolean;
  hasConflict: boolean;
  conflicts: ConflictRecord<T>[];
  activeConflict: ConflictRecord<T> | null;
  lastSyncedAt: string | null;
  setStatus: (status: CloudSyncStatus) => void;
  setConflicts: (conflicts: ConflictRecord<T>[]) => void;
  setSyncing: () => void;
  setSynced: (syncedAt?: string) => void;
  setOffline: () => void;
  setConflictDetected: (conflicts: ConflictRecord<T>[]) => void;
  resolveConflict: (
    entityId: string,
    choice: ConflictResolutionChoice,
    onResolve?: (choice: ConflictResolutionChoice, record: ConflictRecord<T>) => Promise<void> | void,
  ) => Promise<void>;
  clearConflicts: () => void;
  selectConflict: (conflict: ConflictRecord<T> | null) => void;
}

function resolveDefaultStorage(customStorage?: StorageLike | null): StorageLike | null {
  if (customStorage !== undefined) {
    return customStorage;
  }
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  return null;
}

/**
 * Standardized synchronization state hook across family budget simulators & configuration stores.
 * Manages standard status transitions (`synced`, `syncing`, `offline`, `conflict`),
 * browser window online/offline event listeners, and interactive conflict resolution choices.
 */
export function useCloudSyncState<T = unknown>(options?: UseCloudSyncStateOptions<T>): UseCloudSyncStateReturn<T> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const storage = resolveDefaultStorage(options?.storage);
  const storageRef = useRef(storage);
  storageRef.current = storage;

  const isOnline = typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator.onLine : true;

  const [state, setState] = useState<CloudSyncState<T>>(() =>
    createInitialCloudSyncState<T>({
      initialStatus: options?.initialStatus,
      storageSyncKey: options?.storageSyncKey,
      storage,
      isOnline,
    }),
  );

  const setStatus = useCallback((newStatus: CloudSyncStatus) => {
    setState((prev) => ({ ...prev, status: newStatus }));
  }, []);

  const setSyncing = useCallback(() => {
    setState((prev) => reduceSetSyncing(prev));
  }, []);

  const setOffline = useCallback(() => {
    setState((prev) => reduceSetOffline(prev));
  }, []);

  const setSynced = useCallback((syncedAt?: string) => {
    setState((prev) => reduceSetSynced(prev, syncedAt, optionsRef.current?.storageSyncKey, storageRef.current));
  }, []);

  const setConflictDetected = useCallback((newConflicts: ConflictRecord<T>[]) => {
    setState((prev) => reduceSetConflictDetected(prev, newConflicts));
  }, []);

  const setConflicts = useCallback((newConflicts: ConflictRecord<T>[]) => {
    setState((prev) => reduceSetConflictDetected(prev, newConflicts));
  }, []);

  const resolveConflict = useCallback(
    async (
      entityId: string,
      choice: ConflictResolutionChoice,
      onResolve?: (choice: ConflictResolutionChoice, record: ConflictRecord<T>) => Promise<void> | void,
    ) => {
      let targetRecord: ConflictRecord<T> | undefined;
      setState((prev) => {
        targetRecord = prev.conflicts.find((c) => c.entityId === entityId);
        return prev;
      });
      if (!targetRecord) return;

      if (onResolve) {
        await onResolve(choice, targetRecord);
      } else if (optionsRef.current?.onConflictResolved) {
        await optionsRef.current.onConflictResolved(entityId, choice, targetRecord);
      }

      setState((prev) =>
        reduceResolveConflict(prev, entityId, undefined, optionsRef.current?.storageSyncKey, storageRef.current),
      );
    },
    [],
  );

  const clearConflicts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      conflicts: [],
      activeConflict: null,
      status: prev.status === "conflict" ? "synced" : prev.status,
    }));
  }, []);

  const selectConflict = useCallback((conflict: ConflictRecord<T> | null) => {
    setState((prev) => ({ ...prev, activeConflict: conflict }));
  }, []);

  const onReconnectEvent = useEffectEvent(() => {
    void options?.onReconnect?.();
  });

  // Online / Offline window listeners (registered once; invokes non-reactive effect event)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setState((prev) => reduceSetOffline(prev));
    };

    const handleOnline = () => {
      setState((prev) => reduceSetSyncing(prev));
      onReconnectEvent();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return useMemo(
    () => ({
      status: state.status,
      isSyncing: state.status === "syncing",
      isOffline: state.status === "offline",
      hasConflict: state.status === "conflict",
      conflicts: state.conflicts,
      activeConflict: state.activeConflict,
      lastSyncedAt: state.lastSyncedAt,
      setStatus,
      setConflicts,
      setSyncing,
      setSynced,
      setOffline,
      setConflictDetected,
      resolveConflict,
      clearConflicts,
      selectConflict,
    }),
    [
      state,
      setStatus,
      setConflicts,
      setSyncing,
      setSynced,
      setOffline,
      setConflictDetected,
      resolveConflict,
      clearConflicts,
      selectConflict,
    ],
  );
}
