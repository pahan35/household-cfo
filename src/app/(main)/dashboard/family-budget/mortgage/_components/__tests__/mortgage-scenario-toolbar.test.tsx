import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ConflictRecord } from "@/lib/cloud-sync-reconciler";

import { DEFAULT_MORTGAGE_SIMULATOR_CONFIG } from "../mortgage-engine";
import { MortgageScenarioToolbar } from "../mortgage-scenario-toolbar";
import type { MortgageScenario } from "../mortgage-types";

describe("MortgageScenarioToolbar & Cloud Sync Badge", () => {
  const mockScenarios: MortgageScenario[] = [
    {
      id: "scen-1",
      name: "Primary Plan",
      isPrimary: true,
      config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "scen-2",
      name: "Secondary Plan",
      isPrimary: false,
      config: DEFAULT_MORTGAGE_SIMULATOR_CONFIG,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  it("renders scenario selector, primary plan badge, and Cloud Synced badge", () => {
    const html = renderToString(
      <MortgageScenarioToolbar
        scenarios={mockScenarios}
        activeScenarioId="scen-1"
        syncStatus="synced"
        onSelectScenario={vi.fn()}
        onCreateScenario={vi.fn()}
        onDuplicateScenario={vi.fn()}
        onRenameScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
        onSetPrimaryScenario={vi.fn()}
        onOpenCompare={vi.fn()}
      />,
    );

    expect(html).toContain("Scenario:");
    expect(html).toContain("Primary Household Plan");
    expect(html).toContain("Cloud Synced");
  });

  it("renders Conflict Detected badge when syncStatus is conflict", () => {
    const mockConflicts: ConflictRecord<MortgageScenario>[] = [
      {
        entityId: "scen-1",
        entityName: "Primary Plan",
        localVersion: mockScenarios[0],
        remoteVersion: { ...mockScenarios[0], name: "Remote Plan" },
      },
    ];

    const html = renderToString(
      <MortgageScenarioToolbar
        scenarios={mockScenarios}
        activeScenarioId="scen-1"
        syncStatus="conflict"
        conflicts={mockConflicts}
        onSelectScenario={vi.fn()}
        onCreateScenario={vi.fn()}
        onDuplicateScenario={vi.fn()}
        onRenameScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
        onSetPrimaryScenario={vi.fn()}
        onOpenCompare={vi.fn()}
      />,
    );

    expect(html).toContain("Conflict Detected");
  });
});
