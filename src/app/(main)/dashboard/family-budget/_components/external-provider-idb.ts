import type {
  ExternalProviderCategory,
  ExternalProviderCurrency,
  ExternalProviderSettings,
  ExternalProviderTransaction,
  StatPoint,
} from "./external-provider-data";

export interface ExternalProviderSyncConfig {
  id: string;
  sync_version: number;
  sync_status: "idle" | "syncing" | "reconciling" | "error";
  last_synced_at: string | null;
  last_warm_reconcile_at: string | null;
  last_full_reconcile_at: string | null;
  last_cron_run_at: string | null;
  last_error: string | null;
  watermark_tx_ticks: number;
  hot_pull_months: number;
  auto_poll_interval_minutes: number;
  settings_json: ExternalProviderSettings;
  currencies_json: ExternalProviderCurrency[];
  updated_at: string;
}

export interface ExternalProviderSnapshot {
  syncConfig: ExternalProviderSyncConfig;
  settings: ExternalProviderSettings;
  currencies: ExternalProviderCurrency[];
  categories: ExternalProviderCategory[];
  transactions: ExternalProviderTransaction[];
  statPoints: StatPoint[];
}

const DB_NAME = "externalProvider-local-cache";
const DB_VERSION = 1;
const STORE_NAME = "snapshot_store";
const SNAPSHOT_KEY = "current_snapshot";

let memorySnapshotFallback: ExternalProviderSnapshot | null = null;

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB is not available in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshotFromIDB(): Promise<ExternalProviderSnapshot | null> {
  if (!isIndexedDBAvailable()) {
    return memorySnapshotFallback;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SNAPSHOT_KEY);

      req.onsuccess = () => {
        resolve(req.result ? (req.result as ExternalProviderSnapshot) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memorySnapshotFallback;
  }
}

export async function saveSnapshotToIDB(snapshot: ExternalProviderSnapshot): Promise<void> {
  memorySnapshotFallback = snapshot;

  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(snapshot, SNAPSHOT_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-blocking in restricted storage modes
  }
}

export async function clearIDB(): Promise<void> {
  memorySnapshotFallback = null;

  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(SNAPSHOT_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-blocking
  }
}
