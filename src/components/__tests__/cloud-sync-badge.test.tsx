import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ConflictRecord } from "@/lib/cloud-sync-reconciler";

import { CloudConflictContent, CloudSyncBadge } from "../cloud-sync-badge";

describe("CloudSyncBadge component", () => {
  it("renders Cloud Synced badge in synced status", () => {
    const html = renderToString(<CloudSyncBadge status="synced" />);
    expect(html).toContain("Cloud Synced");
    expect(html).toContain("Synchronized with Supabase Cloud");
  });

  it("renders Syncing... badge with animated spinner in syncing status", () => {
    const html = renderToString(<CloudSyncBadge status="syncing" />);
    expect(html).toContain("Syncing...");
    expect(html).toContain("animate-spin");
  });

  it("renders Local Cache badge in offline status", () => {
    const html = renderToString(<CloudSyncBadge status="offline" />);
    expect(html).toContain("Local Cache");
    expect(html).toContain("Operating offline. Edits are saved locally.");
  });

  it("renders Conflict Detected badge when status is conflict", () => {
    const mockConflicts: ConflictRecord[] = [
      {
        entityId: "scen-1",
        entityName: "Primary Mortgage Plan",
        localVersion: { price: 800000 },
        remoteVersion: { price: 850000 },
        localUpdatedAt: "2026-03-01T10:00:00Z",
        remoteUpdatedAt: "2026-03-01T11:00:00Z",
      },
    ];

    const html = renderToString(<CloudSyncBadge status="conflict" conflicts={mockConflicts} />);
    expect(html).toContain("Conflict Detected");
  });

  it("renders Conflict count when multiple conflicts exist", () => {
    const mockConflicts: ConflictRecord[] = [
      {
        entityId: "scen-1",
        entityName: "Plan 1",
        localVersion: { a: 1 },
        remoteVersion: { a: 2 },
      },
      {
        entityId: "scen-2",
        entityName: "Plan 2",
        localVersion: { b: 3 },
        remoteVersion: { b: 4 },
      },
    ];

    const html = renderToString(<CloudSyncBadge status="conflict" conflicts={mockConflicts} />);
    expect(html).toContain("Conflict (2)");
  });
});

describe("CloudConflictContent component", () => {
  it("renders side-by-side local draft vs cloud version and action buttons", () => {
    const mockConflicts: ConflictRecord[] = [
      {
        entityId: "plan-123",
        entityName: "Baseline Mortgage Scenario",
        localVersion: { purchasePricePln: 950000 },
        remoteVersion: { purchasePricePln: 990000 },
        localUpdatedAt: "2026-03-01T10:00:00Z",
        remoteUpdatedAt: "2026-03-01T11:00:00Z",
      },
    ];

    const onResolve = vi.fn();
    const html = renderToString(
      <CloudConflictContent conflicts={mockConflicts} activeConflict={mockConflicts[0]} onResolve={onResolve} />,
    );

    expect(html).toContain("Cloud Synchronization Conflict");
    expect(html).toContain("Baseline Mortgage Scenario");
    expect(html).toContain("Local Browser Draft");
    expect(html).toContain("Supabase Cloud Version");
    expect(html).toContain("950000");
    expect(html).toContain("990000");
    expect(html).toContain("Keep Local (Push to Cloud)");
    expect(html).toContain("Use Cloud (Discard Local)");
  });
});
