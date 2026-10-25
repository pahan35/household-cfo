# Design

## Context

See `proposal.md` for problem background and motivation. The current implementation in `tax-transforms.ts` and `IncomeDashboard` performs calculations primarily on the active month's snapshot. Tax transactions are categorized by matching tags against `KNOWN_TAX_BUCKETS`. Currently, the buckets expect `#pit` and `#vat`, causing `#PPE` and `#VAT-7` transactions from ExternalProvider to be marked untagged.

## Goals / Non-Goals

**Goals:**
- Update `KNOWN_TAX_BUCKETS` and `TaxAuditCard` to establish `#PPE` and `#VAT-7` as primary canonical tags while maintaining backward compatibility with `#pit` and `#vat`.
- Build a pure, deterministic transformation engine (`computeIncomeTaxTimeline`) that aggregates historical transactions by month (`yyyy-MM`), isolating gross client earnings by source, tax payments by tag bucket, and PFRON rebates.
- Deliver an interactive, responsive `IncomeTaxTimelineCard` on `/dashboard/family-budget/income` featuring selectable income sources, net ZUS after PFRON netting, an effective tax rate trendline, and a Cash vs. Accrual timing toggle.

**Non-Goals:**
- Modifying ExternalProvider upstream API or creating new server-side endpoints.
- Re-implementing the multi-year tax projection engine from Offer Comparator; the timeline focuses on realized actuals and historical analytics.

## Decisions

### 1. Canonical Tax Tag Representation in `KNOWN_TAX_BUCKETS`

```ts
export const KNOWN_TAX_BUCKETS: TaxTagBucket[] = [
  {
    id: "ppe",
    label: "Flat-rate Income Tax (PPE)",
    canonicalTag: "PPE",
    matches: [
      "ppe",
      "pit",
      "income-tax",
      "income_tax",
      "incometax",
      "podatek-dochodowy",
      "podatek_dochodowy",
      "налог-на-доход",
    ],
  },
  {
    id: "zus",
    label: "Social Security (ZUS)",
    canonicalTag: "zus",
    matches: ["zus", "social", "social-security", "social_security", "ubezpieczenia", "соцстрах"],
  },
  {
    id: "health",
    label: "Health Insurance (NFZ)",
    canonicalTag: "health",
    matches: ["health", "nfz", "zdrowotne", "zdrowie", "medical", "медстрах"],
  },
  {
    id: "vat",
    label: "Value Added Tax (VAT-7)",
    canonicalTag: "VAT-7",
    matches: ["vat-7", "vat7", "vat", "ptun", "ндс"],
  },
  {
    id: "capital-gains",
    label: "Capital Gains Tax (Belka)",
    canonicalTag: "belka",
    matches: ["capital-gains", "capital_gains", "belka", "dividends-tax", "dividend-tax", "налог-на-дивиденды"],
  },
];
```

*Rationale*:
- Setting `canonicalTag: "PPE"` and `canonicalTag: "VAT-7"` immediately updates all UI selectors (`TaxAuditCard`) to propose the correct Polish JDG symbols.
- Preserving `"pit"` and `"vat"` in `matches` ensures historical or legacy transactions tagged `#pit` or `#vat` continue to be recognized and categorized properly without data migration.

### 2. Timeline Aggregation Engine (`computeIncomeTaxTimeline`)

The transformation function processes historical transactions chronologically:

```
+---------------------------------------------------------------------------------+
|                  computeIncomeTaxTimeline(transactions, ...)                    |
+---------------------------------------------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         v                                                         v
   [ Inflow Pass ]                                           [ Outflow Pass ]
 - Filter CategoryType.Income                              - Filter taxCategoryIds
 - Group by Month (yyyy-MM)                                - Tag bucket matching
 - Separate:                                               - Attribute:
   * Taxable Client Sources (e.g. B2B Client A, B)           * PPE
   * PFRON Rebates ("Cashback taxes")                        * Health
                                                             * Gross ZUS
                                                             * VAT-7 (pass-through)
                                      |
                                      v
                             [ Monthly Netting ]
 - Net ZUS = max(0, Gross ZUS - PFRON)
 - Total Net Taxes = PPE + Health + Net ZUS
 - Effective Tax Rate % = (Total Net Taxes / Selected Taxable Gross) * 100
 - Timing Shift:
   * Cash Mode: keep taxes in month paid (M)
   * Accrual Mode: shift tax payments to month (M-1)
```

### 3. Timeline Visualization Component (`IncomeTaxTimelineCard`)

Built using the project's standard shadcn chart system (`@/components/ui/chart`, Recharts):
- **Bar Elements**:
  - `selectedGross`: Rendered as an outlined or muted background bar representing total selected client turnover.
  - `netZus`: Purple bar (`#zus` after PFRON reduction).
  - `health`: Teal bar (`#health`).
  - `ppe`: Blue bar (`#PPE`).
- **Line Element**:
  - `effectiveTaxRate`: Amber curve on secondary right Y-axis (0% to 50%).
- **Interactive Controls**:
  - Source selection toggle chips: Displays all active income sources with a count/badge, allowing users to toggle specific sources into the gross pool.
  - Basis Switch: Segmented control or toggle between "Cash Paid" and "Accrual (Incurred M-1)".

## Risks / Trade-offs

- **[Risk] Transaction window limited by pagination**: If `IncomeDashboard` only queries 500 recent transactions, historical coverage might only span a few months if living expenses are dense.
  - *Mitigation*: When loading income data in `IncomeDashboard`, perform a targeted query for all transactions belonging to income categories and tax categories (or request an adequate take count), ensuring at least 12–24 months of income and tax history are present without downloading thousands of unrelated grocery receipts.
- **[Risk] Accrual shift boundary at earliest month**: Shifting taxes back by one month ($M-1$) could drop taxes for the earliest month if prior income transactions are outside the fetched window.
  - *Mitigation*: Only shift taxes when the target prior month exists in the timeline dataset, or display an informative footnote on the boundary month.
