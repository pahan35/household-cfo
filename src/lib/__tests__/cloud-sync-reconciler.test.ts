import { describe, expect, it, vi } from "vitest";

import {
  deterministicStringify,
  isContentEqual,
  isOfflineId,
  reconcileEntities,
  reconcileSingleRecord,
} from "../cloud-sync-reconciler";

describe("cloud-sync-reconciler", () => {
  describe("isOfflineId", () => {
    it("returns true for IDs with offline- prefix", () => {
      expect(isOfflineId("offline-12345")).toBe(true);
      expect(isOfflineId("offline-abc-def")).toBe(true);
    });

    it("returns false for regular IDs, empty, null, or undefined", () => {
      expect(isOfflineId("scen-123")).toBe(false);
      expect(isOfflineId("3a86c8f4-635c-4f7d-8158-b118bfa6c271")).toBe(false);
      expect(isOfflineId("")).toBe(false);
      expect(isOfflineId(null)).toBe(false);
      expect(isOfflineId(undefined)).toBe(false);
    });
  });

  describe("deterministicStringify & isContentEqual", () => {
    it("sorts keys deterministically regardless of insertion order", () => {
      const a = { z: 1, a: 2, m: { y: "hello", b: "world" } };
      const b = { a: 2, z: 1, m: { b: "world", y: "hello" } };
      expect(deterministicStringify(a)).toBe(deterministicStringify(b));
      expect(isContentEqual(a, b)).toBe(true);
    });

    it("ignores specified keys like updatedAt and createdAt", () => {
      const a = { id: "1", name: "Test", updatedAt: "2026-01-01T00:00:00Z" };
      const b = { id: "1", name: "Test", updatedAt: "2026-01-02T12:00:00Z" };
      expect(isContentEqual(a, b)).toBe(true);

      const c = { id: "1", name: "Different", updatedAt: "2026-01-01T00:00:00Z" };
      expect(isContentEqual(a, c)).toBe(false);
    });
  });

  describe("reconcileEntities", () => {
    it("auto-replays offline-created entities and records replayedIds", async () => {
      const local = [
        {
          id: "offline-test-1",
          name: "Offline Draft Plan",
          value: 100,
          updatedAt: "2026-01-02T10:00:00Z",
        },
      ];
      const remote = [
        {
          id: "server-uuid-existing",
          name: "Remote Plan",
          value: 200,
          updatedAt: "2026-01-01T10:00:00Z",
        },
      ];

      const uploadOfflineEntity = vi.fn().mockImplementation(async (item) => ({
        ...item,
        id: "server-uuid-replayed-1",
      }));

      const result = await reconcileEntities({
        localEntities: local,
        remoteEntities: remote,
        uploadOfflineEntity,
      });

      expect(uploadOfflineEntity).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("synced");
      expect(result.conflicts).toHaveLength(0);
      expect(result.replayedIds).toEqual({ "offline-test-1": "server-uuid-replayed-1" });
      expect(result.mergedEntities.map((e) => e.id)).toEqual(["server-uuid-replayed-1", "server-uuid-existing"]);
    });

    it("preserves offline drafts if upload fails or is not provided", async () => {
      const local = [{ id: "offline-temp", name: "Draft", updatedAt: "2026-01-01T00:00:00Z" }];
      const remote: typeof local = [];

      const result = await reconcileEntities({
        localEntities: local,
        remoteEntities: remote,
      });

      expect(result.status).toBe("synced");
      expect(result.mergedEntities).toEqual(local);
    });

    it("detects conflict when both local and remote were updated concurrently with divergent content", async () => {
      const lastSyncedAt = "2026-01-01T00:00:00Z";

      const local = [
        {
          id: "plan-1",
          name: "Plan 1 - Local Edit",
          updatedAt: "2026-01-02T10:00:00Z",
        },
      ];
      const remote = [
        {
          id: "plan-1",
          name: "Plan 1 - Remote Device Edit",
          updatedAt: "2026-01-02T11:00:00Z",
        },
      ];

      const result = await reconcileEntities({
        localEntities: local,
        remoteEntities: remote,
        lastSyncedAt,
      });

      expect(result.status).toBe("conflict");
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].entityId).toBe("plan-1");
      expect(result.conflicts[0].localVersion).toEqual(local[0]);
      expect(result.conflicts[0].remoteVersion).toEqual(remote[0]);
      // Local version must be retained in mergedEntities to prevent silent wipe
      expect(result.mergedEntities[0]).toEqual(local[0]);
    });

    it("cleanly merges when only local was modified, pushing update to remote", async () => {
      const lastSyncedAt = "2026-01-01T00:00:00Z";

      const local = [
        {
          id: "plan-1",
          name: "Local Edited",
          updatedAt: "2026-01-02T10:00:00Z",
        },
      ];
      const remote = [
        {
          id: "plan-1",
          name: "Original",
          updatedAt: "2025-12-30T10:00:00Z", // before lastSync
        },
      ];

      const uploadModifiedEntity = vi.fn().mockImplementation(async (item) => item);

      const result = await reconcileEntities({
        localEntities: local,
        remoteEntities: remote,
        lastSyncedAt,
        uploadModifiedEntity,
      });

      expect(uploadModifiedEntity).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("synced");
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedEntities[0].name).toBe("Local Edited");
    });

    it("cleanly adopts remote when only remote was modified", async () => {
      const lastSyncedAt = "2026-01-01T00:00:00Z";

      const local = [
        {
          id: "plan-1",
          name: "Original",
          updatedAt: "2025-12-30T10:00:00Z", // before lastSync
        },
      ];
      const remote = [
        {
          id: "plan-1",
          name: "Remote Changed",
          updatedAt: "2026-01-02T10:00:00Z", // after lastSync
        },
      ];

      const result = await reconcileEntities({
        localEntities: local,
        remoteEntities: remote,
        lastSyncedAt,
      });

      expect(result.status).toBe("synced");
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedEntities[0].name).toBe("Remote Changed");
    });

    it("considers entities without semantic differences as clean even if timestamps differ", async () => {
      const lastSyncedAt = "2026-01-01T00:00:00Z";

      const local = [
        {
          id: "plan-1",
          name: "Identical Name",
          updatedAt: "2026-01-02T10:00:00Z",
        },
      ];
      const remote = [
        {
          id: "plan-1",
          name: "Identical Name",
          updatedAt: "2026-01-02T11:00:00Z",
        },
      ];

      const result = await reconcileEntities({
        localEntities: local,
        remoteEntities: remote,
        lastSyncedAt,
      });

      expect(result.status).toBe("synced");
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("reconcileSingleRecord", () => {
    it("returns synced when records are content-equal", async () => {
      const local = { theme: "dark", updatedAt: "2026-01-01T00:00:00Z" };
      const remote = { theme: "dark", updatedAt: "2026-01-02T00:00:00Z" };

      const result = await reconcileSingleRecord({
        entityId: "config-1",
        entityName: "App Settings",
        localRecord: local,
        remoteRecord: remote,
      });

      expect(result.status).toBe("synced");
      expect(result.conflict).toBeNull();
      expect(result.resolvedRecord).toEqual(remote);
    });

    it("detects conflict when both local and remote updated after lastSyncedAt", async () => {
      const lastSyncedAt = "2026-01-01T00:00:00Z";
      const local = { theme: "dark" };
      const remote = { theme: "light" };

      const result = await reconcileSingleRecord({
        entityId: "config-1",
        entityName: "App Settings",
        localRecord: local,
        remoteRecord: remote,
        localUpdatedAt: "2026-01-02T10:00:00Z",
        remoteUpdatedAt: "2026-01-02T11:00:00Z",
        lastSyncedAt,
      });

      expect(result.status).toBe("conflict");
      expect(result.conflict?.entityId).toBe("config-1");
      expect(result.resolvedRecord).toEqual(local);
    });

    it("uploads local record when only local was modified", async () => {
      const lastSyncedAt = "2026-01-01T00:00:00Z";
      const local = { theme: "blue" };
      const remote = { theme: "dark" };

      const uploadLocalRecord = vi.fn().mockImplementation(async (rec) => rec);

      const result = await reconcileSingleRecord({
        entityId: "config-1",
        entityName: "App Settings",
        localRecord: local,
        remoteRecord: remote,
        localUpdatedAt: "2026-01-02T10:00:00Z",
        remoteUpdatedAt: "2025-12-30T10:00:00Z",
        lastSyncedAt,
        uploadLocalRecord,
      });

      expect(uploadLocalRecord).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("synced");
      expect(result.conflict).toBeNull();
      expect(result.resolvedRecord).toEqual(local);
    });
  });
});
