import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ConflictRecord } from "@/lib/cloud-sync-reconciler";

import { DEFAULT_COMPARATOR_CONFIG } from "../compensation-engine";
import { GlobalAssumptionsBar } from "../global-assumptions-bar";
import type { OfferTrack } from "../offer-types";

describe("GlobalAssumptionsBar & Cloud Sync Badge Integration", () => {
  it("renders Cloud Synced badge alongside assumptions inputs", () => {
    const html = renderToString(
      <GlobalAssumptionsBar
        config={DEFAULT_COMPARATOR_CONFIG}
        onChange={vi.fn()}
        syncStatus="synced"
        lastSyncedAt={new Date("2026-03-01T12:00:00Z")}
      />,
    );

    expect(html).toContain("ExternalProvider Living Expense Baseline");
    expect(html).toContain("Cloud Synced");
  });

  it("renders Offline indicator when offline fallback is active", () => {
    const html = renderToString(
      <GlobalAssumptionsBar config={DEFAULT_COMPARATOR_CONFIG} onChange={vi.fn()} syncStatus="offline" />,
    );

    expect(html).toContain("Local Cache");
  });

  it("renders conflict warning badge when concurrent edits occur", () => {
    const mockConflict: ConflictRecord<OfferTrack> = {
      entityId: "track-1",
      entityName: "Acme Corp (Staff Engineer)",
      localVersion: {
        id: "track-1",
        companyName: "Acme Corp",
        roleTitle: "Staff Engineer (Local Edit)",
        status: "current",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-02-01T12:00:00Z",
        revisions: [],
        activeRevisionId: "",
      },
      remoteVersion: {
        id: "track-1",
        companyName: "Acme Corp",
        roleTitle: "Staff Engineer (Remote Cloud Edit)",
        status: "current",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-02-01T14:00:00Z",
        revisions: [],
        activeRevisionId: "",
      },
    };

    const html = renderToString(
      <GlobalAssumptionsBar
        config={DEFAULT_COMPARATOR_CONFIG}
        onChange={vi.fn()}
        syncStatus="conflict"
        conflicts={[mockConflict]}
        activeConflict={mockConflict}
        onResolveConflict={vi.fn()}
      />,
    );

    expect(html).toContain("Conflict Detected");
  });
});
