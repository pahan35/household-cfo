// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as clientModule from "../external-provider-client";
import type { ExternalProviderCategory, ExternalProviderCurrency } from "../external-provider-data";
import { revalidateExternalProviderQueries } from "../external-provider-query-cache";
import { useCategoriesQuery, useCurrenciesQuery } from "../use-external-provider-queries";

function WidgetAlpha() {
  const { data: categories } = useCategoriesQuery();
  return <div data-testid="widget-alpha">Alpha: {categories?.length ?? "loading"}</div>;
}

function WidgetBeta() {
  const { data: categories } = useCategoriesQuery();
  return <div data-testid="widget-beta">Beta: {categories?.length ?? "loading"}</div>;
}

function CurrencyWidget() {
  const { data: currencies } = useCurrenciesQuery();
  return <div data-testid="widget-currency">Currencies: {currencies?.length ?? "loading"}</div>;
}

function MultiWidgetPage() {
  return (
    <div>
      <WidgetAlpha />
      <WidgetBeta />
      <CurrencyWidget />
    </div>
  );
}

describe("SWR Query Automated Request Deduplication", () => {
  const mockCategories: ExternalProviderCategory[] = [
    { id: "cat-1", name: "Groceries", categoryType: 0 },
    { id: "cat-2", name: "Utilities", categoryType: 0 },
  ];

  const mockCurrencies: ExternalProviderCurrency[] = [{ id: "pln", name: "PLN", rate: 1 }];

  let getCategoriesSpy: ReturnType<typeof vi.spyOn>;
  let getCurrenciesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getCategoriesSpy = vi.spyOn(clientModule, "getCategories").mockResolvedValue(mockCategories);
    getCurrenciesSpy = vi.spyOn(clientModule, "getCurrencies").mockResolvedValue(mockCurrencies);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent category requests across widgets on the same page to a single in-flight fetch", async () => {
    render(<MultiWidgetPage />);

    expect(screen.getByTestId("widget-alpha").textContent).toBe("Alpha: loading");
    expect(screen.getByTestId("widget-beta").textContent).toBe("Beta: loading");

    await waitFor(() => {
      expect(screen.getByTestId("widget-alpha").textContent).toBe("Alpha: 2");
      expect(screen.getByTestId("widget-beta").textContent).toBe("Beta: 2");
      expect(screen.getByTestId("widget-currency").textContent).toBe("Currencies: 1");
    });

    // Despite both WidgetAlpha and WidgetBeta rendering concurrently, getCategories was called only ONCE
    expect(getCategoriesSpy).toHaveBeenCalledTimes(1);
    expect(getCurrenciesSpy).toHaveBeenCalledTimes(1);
  });

  it("revalidates shared data across widgets on revalidateExternalProviderQueries()", async () => {
    render(<MultiWidgetPage />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-alpha").textContent).toBe("Alpha: 2");
    });

    const initialCalls = getCategoriesSpy.mock.calls.length;

    // Trigger global revalidation (e.g. from ExternalProvider sync toolbar)
    await revalidateExternalProviderQueries();

    await waitFor(() => {
      expect(getCategoriesSpy.mock.calls.length).toBe(initialCalls + 1);
    });
  });
});
