import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as clientModule from "../external-provider-client";
import { ExternalProviderSyncProvider, ExternalProviderSyncToolbar, useExternalProviderSync } from "../external-provider-sync-toolbar";

function ConsumerTestComponent() {
  const { syncStatus, hotPullMonths, autoPollIntervalMinutes } = useExternalProviderSync();
  return (
    <div>
      <div data-testid="status">{syncStatus}</div>
      <div data-testid="hot-months">{hotPullMonths}</div>
      <div data-testid="auto-poll">{autoPollIntervalMinutes}</div>
    </div>
  );
}

describe("ExternalProviderSyncProvider and ExternalProviderSyncToolbar", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(clientModule, "hydrateClientFromIDB").mockResolvedValue(null);
    vi.spyOn(clientModule, "syncClientWithServer").mockResolvedValue({
      upToDate: true,
      syncVersion: 1,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws error when useExternalProviderSync is used outside provider", () => {
    expect(() => renderToString(<ConsumerTestComponent />)).toThrow(
      "useExternalProviderSync must be used within a ExternalProviderSyncProvider",
    );
  });

  it("renders default context values in provider", () => {
    const html = renderToString(
      <ExternalProviderSyncProvider>
        <ConsumerTestComponent />
      </ExternalProviderSyncProvider>,
    );

    expect(html).toContain("idle");
    expect(html).toContain("3");
    expect(html).toContain("0");
  });

  it("renders toolbar with badge and Pull Fresh Data action", () => {
    const html = renderToString(
      <ExternalProviderSyncProvider>
        <ExternalProviderSyncToolbar />
      </ExternalProviderSyncProvider>,
    );

    expect(html).toContain("ExternalProvider Sync Engine");
    expect(html).toContain("Pull Fresh Data");
    expect(html).toContain("Synced ·");
  });
});
