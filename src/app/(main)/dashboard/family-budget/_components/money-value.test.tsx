import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MoneyValue } from "./money-value";

describe("MoneyValue component", () => {
  it("renders ledger mode with native primary and converted reporting secondary with approximation sign", () => {
    const html = renderToString(
      <MoneyValue amount={120} currency="EUR" convertedAmount={516} reportingCurrency="PLN" mode="ledger" />,
    );

    // Primary line should contain EUR 120.00 / €120.00
    expect(html).toContain("120.00");
    expect(html).toMatch(/€|EUR/);

    // Secondary line should contain ≈ and 516.00 and PLN
    expect(html).toContain("≈");
    expect(html).toContain("516.00");
    expect(html).toContain("PLN");
  });

  it("omits approximation sign in ledger mode when showApproximationSign is false", () => {
    const html = renderToString(
      <MoneyValue
        amount={120}
        currency="EUR"
        convertedAmount={516}
        reportingCurrency="PLN"
        mode="ledger"
        showApproximationSign={false}
      />,
    );

    expect(html).not.toContain("≈");
    expect(html).toContain("516.00");
    expect(html).toContain("PLN");
  });

  it("renders rollup mode with converted reporting primary and native secondary with orig. prefix", () => {
    const html = renderToString(
      <MoneyValue amount={120} currency="EUR" convertedAmount={516} reportingCurrency="PLN" mode="rollup" />,
    );

    // Primary line displays converted reporting currency
    expect(html).toContain("516.00");
    expect(html).toContain("PLN");

    // Secondary line displays orig. prefix and native currency
    expect(html).toContain("orig.");
    expect(html).toContain("120.00");
    expect(html).toMatch(/€|EUR/);
  });

  it("omits secondary subline when native currency equals reporting currency in ledger mode", () => {
    const html = renderToString(
      <MoneyValue amount={250} currency="PLN" convertedAmount={250} reportingCurrency="PLN" mode="ledger" />,
    );

    expect(html).toContain("250.00");
    expect(html).toContain("PLN");
    expect(html).not.toContain("≈");
    expect(html).not.toContain("orig.");
  });

  it("omits secondary subline when native currency equals reporting currency in rollup mode", () => {
    const html = renderToString(
      <MoneyValue amount={250} currency="PLN" convertedAmount={250} reportingCurrency="PLN" mode="rollup" />,
    );

    expect(html).toContain("250.00");
    expect(html).toContain("PLN");
    expect(html).not.toContain("orig.");
    expect(html).not.toContain("≈");
  });

  it("auto-calculates convertedAmount when currencies array is provided", () => {
    const currencies = [
      { id: "USD", rate: 1.0 },
      { id: "EUR", rate: 0.92 },
      { id: "PLN", rate: 4.0 },
    ];

    const html = renderToString(
      <MoneyValue amount={100} currency="EUR" reportingCurrency="PLN" currencies={currencies} mode="ledger" />,
    );

    expect(html).toContain("100.00");
    expect(html).toContain("≈");
    expect(html).toContain("434.78");
  });
});
