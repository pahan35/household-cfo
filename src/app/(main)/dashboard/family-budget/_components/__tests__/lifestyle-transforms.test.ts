import { describe, expect, it } from "vitest";

import {
  CategoryType,
  type ExternalProviderCategory,
  type ExternalProviderCurrency,
  type ExternalProviderTransaction,
} from "../external-provider-data";
import {
  aggregateDonutData,
  buildMonthlyTrendSeries,
  computeLearningMetrics,
  computeWellnessMetrics,
  detectConcertEvents,
  detectTravelEpisodes,
  findUntaggedTripCandidates,
  getPassMultiplierFromTags,
  isMedicalCoveredTag,
  isMedicalOutOfPocketTag,
  isSportCoveredTag,
  isSportOutOfPocketTag,
  isSpouseOrFamilyTag,
  normalizeLifestyleTag,
  normalizeUnifiedCategory,
  stripCurrencySuffix,
} from "../lifestyle-transforms";

describe("lifestyle-transforms", () => {
  const mockCurrencies: ExternalProviderCurrency[] = [
    { id: "PLN", rate: 4.0 },
    { id: "USD", rate: 1.0 },
    { id: "EUR", rate: 0.92 },
    { id: "UAH", rate: 41.0 },
  ];

  const mockCategories: ExternalProviderCategory[] = [
    { id: "cat-sport-pln", name: "Sport PLN", categoryType: CategoryType.Expense },
    { id: "cat-sport-uah", name: "Sport UAH", categoryType: CategoryType.Expense },
    { id: "cat-med-pln", name: "Medicine PLN", categoryType: CategoryType.Expense },
    { id: "cat-med-uah", name: "Medical services UAH", categoryType: CategoryType.Expense },
    { id: "cat-mh-eur", name: "Menthal Health EUR", categoryType: CategoryType.Expense },
    { id: "cat-massage", name: "Massage", categoryType: CategoryType.Expense },
    { id: "cat-learning", name: "Learning PLN", categoryType: CategoryType.Expense },
    { id: "cat-transport", name: "Transport PLN", categoryType: CategoryType.Expense },
    { id: "cat-hotel", name: "Hotels EUR", categoryType: CategoryType.Expense },
    { id: "cat-salary", name: "Salary PLN", categoryType: CategoryType.Income },
  ];

  describe("Category normalizers", () => {
    it("strips trailing 3-letter currency suffixes", () => {
      expect(stripCurrencySuffix("Sport PLN")).toBe("Sport");
      expect(stripCurrencySuffix("Medicine UAH")).toBe("Medicine");
      expect(stripCurrencySuffix("Menthal Health EUR")).toBe("Menthal Health");
      expect(stripCurrencySuffix("Hotels EUR")).toBe("Hotels");
      expect(stripCurrencySuffix("Massage")).toBe("Massage");
    });

    it("unifies aliases and historical typos", () => {
      expect(normalizeUnifiedCategory("Sport PLN")).toBe("Sport");
      expect(normalizeUnifiedCategory("Sport UAH")).toBe("Sport");
      expect(normalizeUnifiedCategory("Medicine PLN")).toBe("Medicine");
      expect(normalizeUnifiedCategory("Medical services UAH")).toBe("Medicine");
      expect(normalizeUnifiedCategory("Menthal Health EUR")).toBe("Mental Health");
      expect(normalizeUnifiedCategory("Mental Health")).toBe("Mental Health");
      expect(normalizeUnifiedCategory("Education USD")).toBe("Learning");
    });

    it("normalizes lifestyle tags", () => {
      expect(normalizeLifestyleTag("#Austria")).toBe("austria");
      expect(normalizeLifestyleTag("  ##Travel  ")).toBe("travel");
      expect(normalizeLifestyleTag("PILATES")).toBe("pilates");
    });
  });

  describe("Generic Donut & Category-to-Tag Drill-Down", () => {
    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-1",
        destinationId: "cat-sport-pln",
        destinationAmount: 300,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["pilates"],
        dateTimestamp: new Date("2025-06-01").getTime(),
      },
      {
        id: "tx-2",
        destinationId: "cat-sport-pln",
        destinationAmount: 100,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["gym"],
        dateTimestamp: new Date("2025-06-02").getTime(),
      },
      {
        id: "tx-3",
        destinationId: "cat-sport-pln",
        destinationAmount: 50,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: [], // Untagged in Sport
        dateTimestamp: new Date("2025-06-03").getTime(),
      },
      {
        id: "tx-4",
        destinationId: "cat-sport-uah",
        destinationAmount: 2050, // 2050 UAH / 41 * 4 = 200 PLN
        destinationCurrencyId: "UAH",
        destinationType: CategoryType.Expense,
        tags: ["pilates"],
        dateTimestamp: new Date("2025-06-04").getTime(),
      },
      {
        id: "tx-5",
        sourceId: "cat-salary",
        sourceAmount: 10000,
        sourceCurrencyId: "PLN",
        sourceType: CategoryType.Income,
        tags: ["b2b"],
        dateTimestamp: new Date("2025-06-05").getTime(),
      },
    ];

    it("aggregates raw categories in by-category mode", () => {
      const res = aggregateDonutData({
        transactions,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
        flow: "expenses",
        viewMode: "by-category",
      });

      expect(res.totalAmount).toBe(650); // 300 + 100 + 50 + 200 PLN
      expect(res.slices.length).toBe(2);
      expect(res.slices[0].label).toBe("Sport PLN");
      expect(res.slices[0].amount).toBe(450);
      expect(res.slices[0].hasTags).toBe(true);
      expect(res.slices[1].label).toBe("Sport UAH");
      expect(res.slices[1].amount).toBe(200);
    });

    it("unifies categories in unified-category mode", () => {
      const res = aggregateDonutData({
        transactions,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
        flow: "expenses",
        viewMode: "unified-category",
      });

      expect(res.totalAmount).toBe(650);
      expect(res.slices.length).toBe(1);
      expect(res.slices[0].label).toBe("Sport");
      expect(res.slices[0].amount).toBe(650);
      expect(res.slices[0].hasTags).toBe(true);
    });

    it("drills down into internal tags with untagged slice", () => {
      const res = aggregateDonutData({
        transactions,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
        flow: "expenses",
        viewMode: "by-category",
        drillDownCategoryId: "cat-sport-pln",
      });

      expect(res.isDrillDown).toBe(true);
      expect(res.drillDownTargetLabel).toBe("Sport PLN");
      expect(res.totalAmount).toBe(450); // 300 + 100 + 50
      expect(res.slices.find((s) => s.label === "#pilates")?.amount).toBe(300);
      expect(res.slices.find((s) => s.label === "#gym")?.amount).toBe(100);
      expect(res.slices.find((s) => s.isUntagged)?.amount).toBe(50);
    });

    it("aggregates globally in by-tag mode", () => {
      const res = aggregateDonutData({
        transactions,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
        flow: "expenses",
        viewMode: "by-tag",
      });

      expect(res.totalAmount).toBe(650);
      expect(res.slices.find((s) => s.label === "#pilates")?.amount).toBe(500); // 300 + 200 PLN
      expect(res.slices.find((s) => s.label === "#gym")?.amount).toBe(100);
      expect(res.slices.find((s) => s.isUntagged)?.amount).toBe(50);
    });
  });

  describe("Monthly Trend Series", () => {
    const transactions: ExternalProviderTransaction[] = [
      {
        id: "tx-m1",
        destinationId: "cat-sport-pln",
        destinationAmount: 300,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["pilates"],
        dateTimestamp: new Date("2025-05-15").getTime(),
      },
      {
        id: "tx-m2",
        destinationId: "cat-sport-pln",
        destinationAmount: 400,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["pilates"],
        dateTimestamp: new Date("2025-06-10").getTime(),
      },
      {
        id: "tx-m3",
        sourceId: "cat-salary",
        sourceAmount: 5000,
        sourceCurrencyId: "PLN",
        sourceType: CategoryType.Income,
        tags: ["salary"],
        dateTimestamp: new Date("2025-05-28").getTime(),
      },
    ];

    it("builds monthly trend series filtered by tag", () => {
      const series = buildMonthlyTrendSeries({
        transactions,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
        filterType: "tag",
        filterValue: "pilates",
      });

      expect(series.length).toBe(2);
      expect(series[0].monthKey).toBe("2025-05");
      expect(series[0].expenses).toBe(300);
      expect(series[1].monthKey).toBe("2025-06");
      expect(series[1].expenses).toBe(400);
    });
  });

  describe("Travel Episode Detection & Reused Tag Splitting", () => {
    const travelTxs: ExternalProviderTransaction[] = [
      // Pre-booking for Trip 1
      {
        id: "tx-t1-flight",
        destinationId: "cat-transport",
        destinationAmount: 1200,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["austria", "flight"],
        dateTimestamp: new Date("2025-05-10").getTime(),
      },
      // Trip 1 On-site (Jul 2025)
      {
        id: "tx-t1-start",
        destinationId: "cat-hotel",
        destinationAmount: 200, // 200 EUR = 869.57 PLN
        destinationCurrencyId: "EUR",
        destinationType: CategoryType.Expense,
        tags: ["austria", "travel", "hotel"],
        dateTimestamp: new Date("2025-07-01").getTime(),
      },
      {
        id: "tx-t1-end",
        destinationId: "cat-transport",
        destinationAmount: 150,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["austria", "end-travel"],
        dateTimestamp: new Date("2025-07-10").getTime(),
      },
      // Trip 2 On-site (> 60 days later, Feb 2026)
      {
        id: "tx-t2-start",
        destinationId: "cat-hotel",
        destinationAmount: 300,
        destinationCurrencyId: "EUR",
        destinationType: CategoryType.Expense,
        tags: ["austria", "travel"],
        dateTimestamp: new Date("2026-02-15").getTime(),
      },
      {
        id: "tx-t2-end",
        destinationId: "cat-transport",
        destinationAmount: 200,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["austria", "end-travel"],
        dateTimestamp: new Date("2026-02-22").getTime(),
      },
    ];

    it("splits reused destination tags into distinct chronological episodes", () => {
      const episodes = detectTravelEpisodes({
        transactions: travelTxs,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
      });

      expect(episodes.length).toBe(2);
      expect(episodes[0].name).toContain("Austria (Feb 2026)");
      expect(episodes[1].name).toContain("Austria (Jul 2025)");
      // Pre-booking attributed to trip 1
      expect(episodes[1].preBookingTotal).toBe(1200);
      expect(episodes[1].onSiteTotal).toBeGreaterThan(0);
    });

    it("scores untagged transactions within the trip date window", () => {
      const candidateTxs: ExternalProviderTransaction[] = [
        ...travelTxs,
        // Untagged foreign currency restaurant spend in Jul 2025 trip window
        {
          id: "tx-untagged-austria",
          destinationId: "cat-hotel",
          destinationAmount: 45,
          destinationCurrencyId: "EUR",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-07-05").getTime(),
        },
      ];

      const candidates = findUntaggedTripCandidates({
        transactions: candidateTxs,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-10"),
      });

      expect(candidates.length).toBe(1);
      expect(candidates[0].transaction.id).toBe("tx-untagged-austria");
      expect(candidates[0].confidenceScore).toBeGreaterThanOrEqual(70); // foreign currency + travel category
    });
  });

  describe("Concert Costing & Trip Overlap", () => {
    const episodes = [
      {
        id: "trip-austria-2025-07-1",
        destinationTag: "austria",
        name: "Austria (Jul 2025)",
        startDate: "2025-07-01",
        endDate: "2025-07-10",
        preBookingTotal: 1200,
        onSiteTotal: 2000,
        totalCost: 3200,
        currency: "PLN",
        transactionCount: 3,
        preBookingTransactions: [],
        onSiteTransactions: [],
        untaggedCandidates: [],
      },
    ];

    const concertTxs: ExternalProviderTransaction[] = [
      {
        id: "tx-concert-1",
        destinationId: "cat-transport",
        destinationAmount: 450,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["concert", "coldplay", "ticket"],
        dateTimestamp: new Date("2025-07-04").getTime(),
      },
      {
        id: "tx-concert-2",
        destinationId: "cat-transport",
        destinationAmount: 450,
        destinationCurrencyId: "PLN",
        destinationType: CategoryType.Expense,
        tags: ["concert", "coldplay", "ticket"],
        dateTimestamp: new Date("2025-07-04").getTime(),
      },
    ];

    it("groups same-day tickets and detects concert-in-travel overlap", () => {
      const concerts = detectConcertEvents({
        transactions: concertTxs,
        episodes,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
      });

      expect(concerts.length).toBe(1);
      const c = concerts[0];
      expect(c.displayName).toBe("Coldplay Concert");
      expect(c.ticketCount).toBe(2);
      expect(c.ticketTotal).toBe(900);
      expect(c.type).toBe("concert-in-travel");
      expect(c.overlappingTripId).toBe("trip-austria-2025-07-1");
      expect(c.allocatedTripOverhead).toBe(500); // 25% of 2000 on-site
    });
  });

  describe("Wellness & Learning Cadence Engine", () => {
    it("extracts pass multiplier overrides correctly", () => {
      expect(getPassMultiplierFromTags(["pilates", "10x"])).toBe(10);
      expect(getPassMultiplierFromTags(["5x"])).toBe(5);
      expect(getPassMultiplierFromTags(["1x"])).toBe(1);
      expect(getPassMultiplierFromTags(["pilates"])).toBeNull();
    });

    it("applies 10x default for Pilates and calculates effective cost per session", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-pilates-1",
          destinationId: "cat-sport-pln",
          destinationAmount: 600,
          destinationCurrencyId: "PLN",
          destinationType: CategoryType.Expense,
          tags: ["pilates"], // Default 10x
          dateTimestamp: new Date("2025-01-01").getTime(),
        },
        {
          id: "tx-pilates-2",
          destinationId: "cat-sport-pln",
          destinationAmount: 600,
          destinationCurrencyId: "PLN",
          destinationType: CategoryType.Expense,
          tags: ["pilates", "10x"],
          dateTimestamp: new Date("2025-03-01").getTime(),
        },
      ];

      const { streams } = computeWellnessMetrics({
        transactions: txs,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
      });

      const pilates = streams.find((s) => s.streamId === "pilates");
      expect(pilates).toBeDefined();
      expect(pilates?.totalSessions).toBe(20);
      expect(pilates?.totalCost).toBe(1200);
      expect(pilates?.effectiveCostPerSession).toBe(60); // 1200 / 20 = 60 PLN per session
    });

    it("flags multi-visit package outliers in Mental Health", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-mh-1",
          destinationId: "cat-mh-eur",
          destinationAmount: 50, // ~217 PLN
          destinationCurrencyId: "EUR",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-01-10").getTime(),
        },
        {
          id: "tx-mh-2",
          destinationId: "cat-mh-eur",
          destinationAmount: 50,
          destinationCurrencyId: "EUR",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-01-20").getTime(),
        },
        {
          id: "tx-mh-3",
          destinationId: "cat-mh-eur",
          destinationAmount: 50,
          destinationCurrencyId: "EUR",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-02-01").getTime(),
        },
        {
          id: "tx-mh-package",
          destinationId: "cat-mh-eur",
          destinationAmount: 450, // 9x single visit cost!
          destinationCurrencyId: "EUR",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-03-01").getTime(),
        },
      ];

      const { auditQueue } = computeWellnessMetrics({
        transactions: txs,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
      });

      const outlier = auditQueue.find((a) => a.transaction.id === "tx-mh-package");
      expect(outlier).toBeDefined();
      expect(outlier?.isOutlierPackage).toBe(true);
      expect(outlier?.suggestedTags).toContain("10x");
    });

    it("computes learning facets and subscription run-rate", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-learn-sub",
          destinationId: "cat-learning",
          destinationAmount: 120,
          destinationCurrencyId: "PLN",
          destinationType: CategoryType.Expense,
          tags: ["platform"],
          dateTimestamp: Date.now() - 10 * 24 * 3600 * 1000,
        },
        {
          id: "tx-learn-cert",
          destinationId: "cat-learning",
          destinationAmount: 800,
          destinationCurrencyId: "PLN",
          destinationType: CategoryType.Expense,
          tags: ["cert"],
          dateTimestamp: Date.now() - 40 * 24 * 3600 * 1000,
        },
      ];

      const metrics = computeLearningMetrics({
        transactions: txs,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
      });

      expect(metrics.totalSpend).toBe(920);
      expect(metrics.facets.find((f) => f.facetTag === "platform")?.totalCost).toBe(120);
      expect(metrics.facets.find((f) => f.facetTag === "cert")?.totalCost).toBe(800);
    });

    it("classifies medical and sport coverage sub-tags and scope tags", () => {
      expect(isMedicalCoveredTag("consult")).toBe(true);
      expect(isMedicalCoveredTag("exams")).toBe(true);
      expect(isMedicalOutOfPocketTag("dentist")).toBe(true);
      expect(isMedicalOutOfPocketTag("pharmacy")).toBe(true);
      expect(isSportCoveredTag("gym")).toBe(true);
      expect(isSportCoveredTag("multisport")).toBe(true);
      expect(isSportOutOfPocketTag("pilates")).toBe(true);
      expect(isSpouseOrFamilyTag("#wife")).toBe(true);
      expect(isSpouseOrFamilyTag("partner")).toBe(true);
      expect(isSpouseOrFamilyTag("family")).toBe(true);
      expect(isSpouseOrFamilyTag("me")).toBe(false);
    });

    it("surfaces enhanced coverage sub-tags and spouse scope in audit queue for untagged medical/sport", () => {
      const txs: ExternalProviderTransaction[] = [
        {
          id: "tx-med-untagged",
          destinationId: "cat-med-pln",
          destinationAmount: 250,
          destinationCurrencyId: "PLN",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-05-10").getTime(),
        },
        {
          id: "tx-sport-untagged",
          destinationId: "cat-sport-pln",
          destinationAmount: 180,
          destinationCurrencyId: "PLN",
          destinationType: CategoryType.Expense,
          tags: [],
          dateTimestamp: new Date("2025-05-11").getTime(),
        },
      ];

      const { auditQueue } = computeWellnessMetrics({
        transactions: txs,
        categories: mockCategories,
        currencies: mockCurrencies,
        defaultCurrency: "PLN",
      });

      const medAudit = auditQueue.find((a) => a.transaction.id === "tx-med-untagged");
      expect(medAudit).toBeDefined();
      expect(medAudit?.suggestedTags).toEqual(["consult", "exams", "dentist", "pharmacy", "wife"]);

      const sportAudit = auditQueue.find((a) => a.transaction.id === "tx-sport-untagged");
      expect(sportAudit).toBeDefined();
      expect(sportAudit?.suggestedTags).toEqual(["gym", "multisport", "pilates", "wife"]);
    });
  });
});
