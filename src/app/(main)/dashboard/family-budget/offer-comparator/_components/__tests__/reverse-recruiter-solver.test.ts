import { describe, expect, it } from "vitest";

import { DEFAULT_COMPARATOR_CONFIG } from "../compensation-engine";
import { generateQuickQuoteMatrix, getDefaultScenarioProfiles, solveRecruiterQuote } from "../reverse-recruiter-solver";

describe("Reverse Recruiter Quick-Quote Solver", () => {
  const scenarios = getDefaultScenarioProfiles(DEFAULT_COMPARATOR_CONFIG);

  it("solves Target Net Monthly Cashflow with < 0.05 PLN error across all scenarios", () => {
    const targets = [8000, 18000, 35000]; // Low, medium, and high (crossing 300k cliff & 30x cap)
    const scenarioList = Object.values(scenarios);

    for (const target of targets) {
      for (const sc of scenarioList) {
        const solved = solveRecruiterQuote(target, sc, "PLN", DEFAULT_COMPARATOR_CONFIG);
        expect(solved.errorPln).toBeLessThan(0.05);
        expect(solved.verifiedMonthlyNetPln).toBeCloseTo(target, 1);
      }
    }
  });

  it("requires higher hourly rate for Unpaid PTO than Paid PTO to reach same net cashflow", () => {
    const targetNet = 20000;
    const unpaidQuote = solveRecruiterQuote(
      targetNet,
      scenarios.b2b_hourly_unpaid_pto,
      "PLN",
      DEFAULT_COMPARATOR_CONFIG,
    );
    const paidQuote = solveRecruiterQuote(targetNet, scenarios.b2b_hourly_paid_pto, "PLN", DEFAULT_COMPARATOR_CONFIG);

    // Because Unpaid PTO has fewer billable hours (~1,680 vs ~2,016),
    // each billable hour must be billed at a higher rate!
    expect(unpaidQuote.quoteHourly).toBeGreaterThan(paidQuote.quoteHourly);
    expect(unpaidQuote.quoteHourly / paidQuote.quoteHourly).toBeCloseTo(2016 / 1680, 2);
  });

  it("requires lower gross salary for UoP with 50% AKUP than standard UoP", () => {
    const targetNet = 15000;
    const standardQuote = solveRecruiterQuote(
      targetNet,
      scenarios.uop_monthly_standard,
      "PLN",
      DEFAULT_COMPARATOR_CONFIG,
    );
    const akupQuote = solveRecruiterQuote(targetNet, scenarios.uop_monthly_akup, "PLN", DEFAULT_COMPARATOR_CONFIG);

    // AKUP provides substantial copyright tax savings, so gross needed is lower
    expect(akupQuote.quoteMonthly).toBeLessThan(standardQuote.quoteMonthly);
  });

  it("incorporates FX pessimistic buffer for USD and EUR quotes", () => {
    const targetNet = 18000;
    const config = {
      ...DEFAULT_COMPARATOR_CONFIG,
      manualFxOverrides: { USD: 4.0 },
      fxPessimisticBufferPct: { USD: 0.05 }, // 3.80 PLN/USD effective
    };

    const plnQuote = solveRecruiterQuote(targetNet, scenarios.b2b_monthly_ryczalt, "PLN", config);
    const usdQuote = solveRecruiterQuote(targetNet, scenarios.b2b_monthly_ryczalt, "USD", config);

    expect(usdQuote.effectiveExchangeRate).toBeCloseTo(3.8, 2);
    expect(usdQuote.quoteMonthly * 3.8).toBeCloseTo(plnQuote.quoteMonthly, 1);
  });

  it("generates complete 6-row matrix with PLN, USD, and EUR columns", () => {
    const matrix = generateQuickQuoteMatrix(16000, DEFAULT_COMPARATOR_CONFIG);
    expect(matrix).toHaveLength(6);

    for (const row of matrix) {
      expect(row.pln.monthly).toBeGreaterThan(0);
      expect(row.usd.monthly).toBeGreaterThan(0);
      expect(row.eur.monthly).toBeGreaterThan(0);
      expect(row.pln.hourly).toBeGreaterThan(0);
    }
  });
});
