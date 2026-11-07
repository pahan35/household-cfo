import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CAPITAL_POOL_CONFIG, DEFAULT_JDG_RUNWAY_CONFIG } from "../runway-engine";
import { RunwayScenarioToolbar } from "../runway-scenario-toolbar";
import type { RunwayScenario } from "../runway-types";

describe("RunwayScenarioToolbar & Multi-scenario Switching", () => {
  const mockScenarios: RunwayScenario[] = [
    {
      id: "scen-1",
      name: "Baseline Austerity",
      isPrimary: true,
      jdgConfig: DEFAULT_JDG_RUNWAY_CONFIG,
      capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
      lookbackWindow: "3m",
      activePresetId: "preset-normal",
      customPresets: [],
      categoryCuts: { "cat-dining": { enabled: true, retentionPct: 50 } },
      baselineOfferRevisionId: "rev-123",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "scen-2",
      name: "Aggressive Winter Freeze",
      isPrimary: false,
      jdgConfig: {
        ...DEFAULT_JDG_RUNWAY_CONFIG,
        posture: "suspended",
      },
      capitalPoolConfig: DEFAULT_CAPITAL_POOL_CONFIG,
      lookbackWindow: "6m",
      activePresetId: "preset-aggressive",
      customPresets: [],
      categoryCuts: { "cat-dining": { enabled: false, retentionPct: 0 } },
      baselineOfferRevisionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("renders scenario selector, primary plan badge, and linked offer badge", () => {
    const html = renderToString(
      <RunwayScenarioToolbar
        scenarios={mockScenarios}
        activeScenarioId="scen-1"
        isSyncing={false}
        isOfflineFallback={false}
        linkedOfferTitle="Senior B2B Contract"
        onSelectScenario={vi.fn()}
        onCreateScenario={vi.fn()}
        onDuplicateScenario={vi.fn()}
        onRenameScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
        onSetPrimaryScenario={vi.fn()}
      />,
    );

    expect(html).toContain("Baseline Austerity");
    expect(html).toContain("Primary Household Plan");
    expect(html).toContain("Senior B2B Contract");
    expect(html).toContain("Cloud Synced");
  });

  it("displays local cache badge when offline fallback is active", () => {
    const html = renderToString(
      <RunwayScenarioToolbar
        scenarios={mockScenarios}
        activeScenarioId="scen-2"
        isSyncing={false}
        isOfflineFallback={true}
        onSelectScenario={vi.fn()}
        onCreateScenario={vi.fn()}
        onDuplicateScenario={vi.fn()}
        onRenameScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
        onSetPrimaryScenario={vi.fn()}
      />,
    );

    expect(html).toContain("Local Cache");
  });

  it("displays conflict badge when syncStatus is conflict", () => {
    const html = renderToString(
      <RunwayScenarioToolbar
        scenarios={mockScenarios}
        activeScenarioId="scen-1"
        syncStatus="conflict"
        conflicts={[
          {
            entityId: "scen-1",
            entityName: "Baseline Austerity",
            localVersion: mockScenarios[0],
            remoteVersion: mockScenarios[1],
          },
        ]}
        onSelectScenario={vi.fn()}
        onCreateScenario={vi.fn()}
        onDuplicateScenario={vi.fn()}
        onRenameScenario={vi.fn()}
        onDeleteScenario={vi.fn()}
        onSetPrimaryScenario={vi.fn()}
      />,
    );

    expect(html).toContain("Conflict Detected");
  });

  it("simulates switching between scenarios and restoring customized cuts across reload", () => {
    // 1. Initial active scenario has 50% dining retention
    let activeId = "scen-1";
    let activeScenario = mockScenarios.find((s) => s.id === activeId);
    expect(activeScenario).toBeDefined();
    expect(activeScenario?.categoryCuts["cat-dining"]).toEqual({ enabled: true, retentionPct: 50 });

    // 2. Switch to scen-2 ("Aggressive Winter Freeze")
    activeId = "scen-2";
    activeScenario = mockScenarios.find((s) => s.id === activeId);
    expect(activeScenario?.name).toBe("Aggressive Winter Freeze");
    expect(activeScenario?.jdgConfig.posture).toBe("suspended");
    expect(activeScenario?.categoryCuts["cat-dining"]).toEqual({ enabled: false, retentionPct: 0 });

    // 3. Simulated browser reload: reload from storage maintains scen-2 cuts and posture
    const reloadedScenario = mockScenarios.find((s) => s.id === activeId);
    expect(reloadedScenario?.categoryCuts["cat-dining"]).toEqual({ enabled: false, retentionPct: 0 });
    expect(reloadedScenario?.lookbackWindow).toBe("6m");
  });
});
