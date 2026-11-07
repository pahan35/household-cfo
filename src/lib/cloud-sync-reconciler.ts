/**
 * Generic Cloud Sync Reconciliation Engine
 *
 * Implements non-destructive offline entity auto-replay, deterministic
 * content comparison, and concurrent conflict detection across family budget
 * persistence stores (Mortgage, Runway, Offer Comparator, Time-Value, and Presets).
 */

export type CloudSyncStatus = "synced" | "syncing" | "offline" | "conflict";

export interface ConflictRecord<T = unknown> {
  entityId: string;
  entityName: string;
  localVersion: T;
  remoteVersion: T;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
}

export type ConflictResolutionChoice = "keep_local" | "use_cloud";

/**
 * Checks if an entity identifier was generated offline as a temporary placeholder.
 */
export function isOfflineId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("offline-");
}

/**
 * Produces a stable, deterministic JSON string representation of an object
 * by recursively sorting object keys.
 */
export function deterministicStringify(value: unknown, ignoreKeys: string[] = []): string {
  const ignoreSet = new Set(ignoreKeys);

  const normalize = (val: unknown): unknown => {
    if (val === null || val === undefined || typeof val !== "object") {
      return val;
    }

    if (Array.isArray(val)) {
      return val.map(normalize);
    }

    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(val as Record<string, unknown>).sort();

    for (const key of keys) {
      if (ignoreSet.has(key)) continue;
      sortedObj[key] = normalize((val as Record<string, unknown>)[key]);
    }

    return sortedObj;
  };

  return JSON.stringify(normalize(value));
}

/**
 * Compares two objects for semantic content equality, ignoring transient
 * timestamp/metadata keys (e.g. `updatedAt`, `createdAt`).
 */
export function isContentEqual<T>(a: T, b: T, ignoreKeys: string[] = ["updatedAt", "createdAt"]): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return deterministicStringify(a, ignoreKeys) === deterministicStringify(b, ignoreKeys);
}

export interface ReconcileEntitiesOptions<T extends { id: string }> {
  localEntities: T[];
  remoteEntities: T[];
  lastSyncedAt?: string | null;
  /**
   * Called to replay an offline-created entity to remote.
   * Returns the canonical entity returned from the server (with new server UUID).
   */
  uploadOfflineEntity?: (entity: T) => Promise<T>;
  /**
   * Called to push non-conflicting locally modified entities to remote.
   */
  uploadModifiedEntity?: (entity: T) => Promise<T>;
  /**
   * Keys to ignore during deep equality check (default: ['updatedAt', 'createdAt']).
   */
  ignoreEqualityKeys?: string[];
  /**
   * Formatter for human-readable entity display names in conflict records.
   */
  getEntityName?: (entity: T) => string;
}

export interface ReconcileEntitiesResult<T extends { id: string }> {
  mergedEntities: T[];
  conflicts: ConflictRecord<T>[];
  replayedIds: Record<string, string>; // { [oldOfflineId]: newServerId }
  status: CloudSyncStatus;
}

/**
 * Reconciles an array of entities between local storage and remote database.
 * 1. Automatically replays `offline-*` temporary creations.
 * 2. Compares existing records for concurrent divergent changes (conflicts).
 * 3. Safely merges without overwriting local offline draft changes.
 */
export async function reconcileEntities<
  T extends { id: string; name?: string; updatedAt?: string; createdAt?: string },
>(options: ReconcileEntitiesOptions<T>): Promise<ReconcileEntitiesResult<T>> {
  const {
    localEntities,
    remoteEntities,
    lastSyncedAt,
    uploadOfflineEntity,
    uploadModifiedEntity,
    ignoreEqualityKeys = ["updatedAt", "createdAt"],
    getEntityName = (item) => item.name || item.id,
  } = options;

  const replayedIds: Record<string, string> = {};
  const conflicts: ConflictRecord<T>[] = [];
  const mergedMap = new Map<string, T>();

  // 1. Separate offline creations vs existing local records
  const offlineCreated: T[] = [];
  const existingLocalMap = new Map<string, T>();

  for (const local of localEntities) {
    if (isOfflineId(local.id)) {
      offlineCreated.push(local);
    } else {
      existingLocalMap.set(local.id, local);
    }
  }

  // 2. Auto-replay offline-created entities
  for (const offlineItem of offlineCreated) {
    if (uploadOfflineEntity) {
      try {
        const replayed = await uploadOfflineEntity(offlineItem);
        if (replayed?.id) {
          replayedIds[offlineItem.id] = replayed.id;
          mergedMap.set(replayed.id, replayed);
          continue;
        }
      } catch (err) {
        console.warn(`[reconcileEntities] Failed to replay offline entity ${offlineItem.id}:`, err);
      }
    }
    // If not uploaded or upload failed, keep local draft intact
    mergedMap.set(offlineItem.id, offlineItem);
  }

  // 3. Process remote records against existing local records
  const seenLocalIds = new Set<string>();

  for (const remote of remoteEntities) {
    const local = existingLocalMap.get(remote.id);

    if (!local) {
      // Remote only entity: add to merged
      mergedMap.set(remote.id, remote);
      continue;
    }

    seenLocalIds.add(local.id);

    // Both sides contain the entity with the same ID
    if (isContentEqual(local, remote, ignoreEqualityKeys)) {
      // Content is identical; use remote version as canonical
      mergedMap.set(remote.id, remote);
      continue;
    }

    // Divergent content: evaluate conflict vs unilateral update
    const isLocalNewer = Boolean(
      local.updatedAt && remote.updatedAt && new Date(local.updatedAt).getTime() > new Date(remote.updatedAt).getTime(),
    );

    const isRemoteNewer = Boolean(
      local.updatedAt && remote.updatedAt && new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime(),
    );

    let hasConflict = false;

    if (lastSyncedAt) {
      const lastSyncTime = new Date(lastSyncedAt).getTime();
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

      // True concurrent edit: both modified after lastSync
      if (localTime > lastSyncTime && remoteTime > lastSyncTime) {
        hasConflict = true;
      } else if (localTime > lastSyncTime) {
        // Only local changed: push local to remote if supported
        if (uploadModifiedEntity) {
          try {
            const pushed = await uploadModifiedEntity(local);
            mergedMap.set(local.id, pushed);
            continue;
          } catch (err) {
            console.warn(`[reconcileEntities] Failed to push local change for ${local.id}:`, err);
          }
        }
        mergedMap.set(local.id, local);
        continue;
      } else {
        // Only remote changed (or local was unmodified since last sync): take remote
        mergedMap.set(remote.id, remote);
        continue;
      }
    } else {
      // No lastSyncedAt known: if both exist with divergent content and different timestamps, flag conflict
      if (local.updatedAt && remote.updatedAt && local.updatedAt !== remote.updatedAt) {
        hasConflict = true;
      } else if (isLocalNewer) {
        // Local is newer
        if (uploadModifiedEntity) {
          try {
            const pushed = await uploadModifiedEntity(local);
            mergedMap.set(local.id, pushed);
            continue;
          } catch {
            // Fall back
          }
        }
        mergedMap.set(local.id, local);
        continue;
      } else if (isRemoteNewer) {
        mergedMap.set(remote.id, remote);
        continue;
      } else {
        hasConflict = true;
      }
    }

    if (hasConflict) {
      conflicts.push({
        entityId: local.id,
        entityName: getEntityName(local),
        localVersion: local,
        remoteVersion: remote,
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: remote.updatedAt,
      });
      // Safety: DO NOT overwrite local cache with remote when conflicted!
      mergedMap.set(local.id, local);
    }
  }

  // 4. Local-only items that were not offline creations and not in remote
  for (const [id, local] of existingLocalMap.entries()) {
    if (!seenLocalIds.has(id) && !mergedMap.has(id)) {
      mergedMap.set(id, local);
    }
  }

  const mergedEntities = Array.from(mergedMap.values());
  const status: CloudSyncStatus = conflicts.length > 0 ? "conflict" : "synced";

  return {
    mergedEntities,
    conflicts,
    replayedIds,
    status,
  };
}

export interface ReconcileSingleRecordOptions<T> {
  entityId: string;
  entityName: string;
  localRecord: T;
  remoteRecord: T;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
  lastSyncedAt?: string | null;
  ignoreEqualityKeys?: string[];
  uploadLocalRecord?: (record: T) => Promise<T>;
}

export interface ReconcileSingleRecordResult<T> {
  resolvedRecord: T;
  conflict: ConflictRecord<T> | null;
  status: CloudSyncStatus;
}

/**
 * Reconciles a single configuration record (such as Time-Value config or global assumptions)
 * between local and remote state.
 */
export async function reconcileSingleRecord<T>(
  options: ReconcileSingleRecordOptions<T>,
): Promise<ReconcileSingleRecordResult<T>> {
  const {
    entityId,
    entityName,
    localRecord,
    remoteRecord,
    localUpdatedAt,
    remoteUpdatedAt,
    lastSyncedAt,
    ignoreEqualityKeys = ["updatedAt", "createdAt"],
    uploadLocalRecord,
  } = options;

  if (isContentEqual(localRecord, remoteRecord, ignoreEqualityKeys)) {
    return {
      resolvedRecord: remoteRecord,
      conflict: null,
      status: "synced",
    };
  }

  const lastSyncTime = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
  const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
  const remoteTime = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;

  // If lastSyncedAt is available
  if (lastSyncedAt && localTime > lastSyncTime && remoteTime > lastSyncTime) {
    const conflict: ConflictRecord<T> = {
      entityId,
      entityName,
      localVersion: localRecord,
      remoteVersion: remoteRecord,
      localUpdatedAt,
      remoteUpdatedAt,
    };
    return {
      resolvedRecord: localRecord,
      conflict,
      status: "conflict",
    };
  }

  if (lastSyncedAt && localTime > lastSyncTime && remoteTime <= lastSyncTime) {
    if (uploadLocalRecord) {
      try {
        const uploaded = await uploadLocalRecord(localRecord);
        return {
          resolvedRecord: uploaded,
          conflict: null,
          status: "synced",
        };
      } catch (err) {
        console.warn(`[reconcileSingleRecord] Failed to push local record ${entityId}:`, err);
      }
    }
    return {
      resolvedRecord: localRecord,
      conflict: null,
      status: "synced",
    };
  }

  if (lastSyncedAt && remoteTime > lastSyncTime && localTime <= lastSyncTime) {
    return {
      resolvedRecord: remoteRecord,
      conflict: null,
      status: "synced",
    };
  }

  // Without lastSyncedAt: check timestamps
  if (localTime > 0 && remoteTime > 0 && localTime !== remoteTime) {
    const conflict: ConflictRecord<T> = {
      entityId,
      entityName,
      localVersion: localRecord,
      remoteVersion: remoteRecord,
      localUpdatedAt,
      remoteUpdatedAt,
    };
    return {
      resolvedRecord: localRecord,
      conflict,
      status: "conflict",
    };
  }

  // Fallback: create conflict to be safe
  const conflict: ConflictRecord<T> = {
    entityId,
    entityName,
    localVersion: localRecord,
    remoteVersion: remoteRecord,
    localUpdatedAt,
    remoteUpdatedAt,
  };
  return {
    resolvedRecord: localRecord,
    conflict,
    status: "conflict",
  };
}
