import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ConflictRecord } from "@/lib/cloud-sync-reconciler";

import {
  createInitialCloudSyncState,
  reduceResolveConflict,
  reduceSetConflictDetected,
  reduceSetOffline,
  reduceSetSynced,
  reduceSetSyncing,
  useCloudSyncState,
} from "../use-cloud-sync-state";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function TestSsrComponent() {
  const syncState = useCloudSyncState({ initialStatus: "syncing" });
  return <div data-testid="status">{syncState.status}</div>;
}

function TestHarnessComponent({ onCapture }: { onCapture: (state: ReturnType<typeof useCloudSyncState>) => void }) {
  const syncState = useCloudSyncState({
    initialStatus: "syncing",
    storageSyncKey: "test-key",
  });
  onCapture(syncState);
  return <div data-status={syncState.status}>{syncState.status}</div>;
}

describe("useCloudSyncState state logic", () => {
  it("initializes with synced by default", () => {
    const state = createInitialCloudSyncState();
    expect(state.status).toBe("synced");
    expect(state.conflicts).toEqual([]);
    expect(state.activeConflict).toBeNull();
    expect(state.lastSyncedAt).toBeNull();
  });

  it("initializes with offline when isOnline is false", () => {
    const state = createInitialCloudSyncState({ isOnline: false });
    expect(state.status).toBe("offline");
  });

  it("reads lastSyncedAt from storage when storageSyncKey is given", () => {
    const storage = new MemoryStorage();
    storage.setItem("my-sync-key", "2026-02-01T12:00:00Z");

    const state = createInitialCloudSyncState({
      storageSyncKey: "my-sync-key",
      storage,
    });
    expect(state.lastSyncedAt).toBe("2026-02-01T12:00:00Z");
  });

  it("transitions between syncing, offline, and synced", () => {
    let state = createInitialCloudSyncState();
    expect(state.status).toBe("synced");

    state = reduceSetSyncing(state);
    expect(state.status).toBe("syncing");

    state = reduceSetOffline(state);
    expect(state.status).toBe("offline");

    const storage = new MemoryStorage();
    state = reduceSetSynced(state, "2026-03-01T10:00:00Z", "sync-key", storage);
    expect(state.status).toBe("synced");
    expect(state.lastSyncedAt).toBe("2026-03-01T10:00:00Z");
    expect(storage.getItem("sync-key")).toBe("2026-03-01T10:00:00Z");
  });

  it("handles conflict detection and stepwise resolution", () => {
    let state = createInitialCloudSyncState();
    const mockConflicts: ConflictRecord[] = [
      {
        entityId: "id-1",
        entityName: "Plan 1",
        localVersion: { val: 1 },
        remoteVersion: { val: 2 },
      },
      {
        entityId: "id-2",
        entityName: "Plan 2",
        localVersion: { val: 3 },
        remoteVersion: { val: 4 },
      },
    ];

    state = reduceSetConflictDetected(state, mockConflicts);
    expect(state.status).toBe("conflict");
    expect(state.conflicts).toHaveLength(2);
    expect(state.activeConflict?.entityId).toBe("id-1");

    // Resolve first conflict
    state = reduceResolveConflict(state, "id-1");
    expect(state.status).toBe("conflict");
    expect(state.conflicts).toHaveLength(1);
    expect(state.activeConflict?.entityId).toBe("id-2");

    // Resolve second conflict
    const storage = new MemoryStorage();
    state = reduceResolveConflict(state, "id-2", "2026-03-05T12:00:00Z", "sync-key", storage);
    expect(state.status).toBe("synced");
    expect(state.conflicts).toHaveLength(0);
    expect(state.activeConflict).toBeNull();
    expect(state.lastSyncedAt).toBe("2026-03-05T12:00:00Z");
    expect(storage.getItem("sync-key")).toBe("2026-03-05T12:00:00Z");
  });

  it("renders in React component via SSR renderToString", () => {
    const html = renderToString(<TestSsrComponent />);
    expect(html).toContain("syncing");
  });

  it("provides all action handlers and initial status through the hook", () => {
    let captured: ReturnType<typeof useCloudSyncState> | null = null;
    const html = renderToString(
      <TestHarnessComponent
        onCapture={(state) => {
          captured = state;
        }}
      />,
    );
    expect(html).toContain('data-status="syncing"');
    expect(captured).not.toBeNull();
    expect(typeof captured!.setSyncing).toBe("function");
    expect(typeof captured!.setSynced).toBe("function");
    expect(typeof captured!.setOffline).toBe("function");
    expect(typeof captured!.setConflictDetected).toBe("function");
    expect(typeof captured!.resolveConflict).toBe("function");
    expect(typeof captured!.clearConflicts).toBe("function");
    expect(typeof captured!.selectConflict).toBe("function");
  });
});
