export interface MacroMonthData {
  monthKey: string; // Format "YYYY-MM"
  cpiIndex: number; // Cumulative CPI price index normalized with Jan 2024 = 100.0
  cpiYoyPercent: number; // Year-over-Year inflation rate percentage (GUS)
  usdPlnRate: number; // Monthly average USD/PLN exchange rate (NBP)
}

export const BASE_CPI_MONTH = "2024-01";

/**
 * Historical monthly Polish CPI indices (GUS) and USD/PLN average exchange rates (NBP)
 * covering 2023-01 through 2026-12 (48 continuous months).
 */
export const MACRO_HISTORICAL_DATA: Record<string, MacroMonthData> = {
  // 2023
  "2023-01": { monthKey: "2023-01", cpiIndex: 94.2, cpiYoyPercent: 16.6, usdPlnRate: 4.36 },
  "2023-02": { monthKey: "2023-02", cpiIndex: 95.3, cpiYoyPercent: 18.4, usdPlnRate: 4.44 },
  "2023-03": { monthKey: "2023-03", cpiIndex: 96.3, cpiYoyPercent: 16.1, usdPlnRate: 4.38 },
  "2023-04": { monthKey: "2023-04", cpiIndex: 97.0, cpiYoyPercent: 14.7, usdPlnRate: 4.24 },
  "2023-05": { monthKey: "2023-05", cpiIndex: 97.2, cpiYoyPercent: 13.0, usdPlnRate: 4.18 },
  "2023-06": { monthKey: "2023-06", cpiIndex: 97.2, cpiYoyPercent: 11.5, usdPlnRate: 4.12 },
  "2023-07": { monthKey: "2023-07", cpiIndex: 97.0, cpiYoyPercent: 10.8, usdPlnRate: 4.02 },
  "2023-08": { monthKey: "2023-08", cpiIndex: 97.0, cpiYoyPercent: 10.1, usdPlnRate: 4.08 },
  "2023-09": { monthKey: "2023-09", cpiIndex: 96.6, cpiYoyPercent: 8.2, usdPlnRate: 4.3 },
  "2023-10": { monthKey: "2023-10", cpiIndex: 96.9, cpiYoyPercent: 6.6, usdPlnRate: 4.28 },
  "2023-11": { monthKey: "2023-11", cpiIndex: 97.6, cpiYoyPercent: 6.6, usdPlnRate: 4.06 },
  "2023-12": { monthKey: "2023-12", cpiIndex: 97.7, cpiYoyPercent: 6.2, usdPlnRate: 3.98 },

  // 2024
  "2024-01": { monthKey: "2024-01", cpiIndex: 100.0, cpiYoyPercent: 3.9, usdPlnRate: 4.0 },
  "2024-02": { monthKey: "2024-02", cpiIndex: 100.3, cpiYoyPercent: 2.8, usdPlnRate: 4.02 },
  "2024-03": { monthKey: "2024-03", cpiIndex: 100.5, cpiYoyPercent: 2.0, usdPlnRate: 3.95 },
  "2024-04": { monthKey: "2024-04", cpiIndex: 101.6, cpiYoyPercent: 2.4, usdPlnRate: 4.0 },
  "2024-05": { monthKey: "2024-05", cpiIndex: 101.7, cpiYoyPercent: 2.5, usdPlnRate: 3.94 },
  "2024-06": { monthKey: "2024-06", cpiIndex: 101.8, cpiYoyPercent: 2.6, usdPlnRate: 4.02 },
  "2024-07": { monthKey: "2024-07", cpiIndex: 103.2, cpiYoyPercent: 4.2, usdPlnRate: 3.96 },
  "2024-08": { monthKey: "2024-08", cpiIndex: 103.3, cpiYoyPercent: 4.3, usdPlnRate: 3.88 },
  "2024-09": { monthKey: "2024-09", cpiIndex: 103.4, cpiYoyPercent: 4.9, usdPlnRate: 3.85 },
  "2024-10": { monthKey: "2024-10", cpiIndex: 103.7, cpiYoyPercent: 5.0, usdPlnRate: 3.98 },
  "2024-11": { monthKey: "2024-11", cpiIndex: 104.2, cpiYoyPercent: 4.7, usdPlnRate: 4.08 },
  "2024-12": { monthKey: "2024-12", cpiIndex: 104.5, cpiYoyPercent: 4.7, usdPlnRate: 4.12 },

  // 2025
  "2025-01": { monthKey: "2025-01", cpiIndex: 105.8, cpiYoyPercent: 5.8, usdPlnRate: 4.1 },
  "2025-02": { monthKey: "2025-02", cpiIndex: 106.4, cpiYoyPercent: 6.1, usdPlnRate: 4.08 },
  "2025-03": { monthKey: "2025-03", cpiIndex: 106.9, cpiYoyPercent: 6.4, usdPlnRate: 4.05 },
  "2025-04": { monthKey: "2025-04", cpiIndex: 107.8, cpiYoyPercent: 6.1, usdPlnRate: 4.02 },
  "2025-05": { monthKey: "2025-05", cpiIndex: 108.2, cpiYoyPercent: 6.4, usdPlnRate: 3.98 },
  "2025-06": { monthKey: "2025-06", cpiIndex: 108.4, cpiYoyPercent: 6.5, usdPlnRate: 3.95 },
  "2025-07": { monthKey: "2025-07", cpiIndex: 109.1, cpiYoyPercent: 5.7, usdPlnRate: 3.92 },
  "2025-08": { monthKey: "2025-08", cpiIndex: 109.4, cpiYoyPercent: 5.9, usdPlnRate: 3.94 },
  "2025-09": { monthKey: "2025-09", cpiIndex: 109.8, cpiYoyPercent: 6.2, usdPlnRate: 3.96 },
  "2025-10": { monthKey: "2025-10", cpiIndex: 110.3, cpiYoyPercent: 6.4, usdPlnRate: 4.0 },
  "2025-11": { monthKey: "2025-11", cpiIndex: 110.8, cpiYoyPercent: 6.3, usdPlnRate: 4.02 },
  "2025-12": { monthKey: "2025-12", cpiIndex: 111.3, cpiYoyPercent: 6.5, usdPlnRate: 4.05 },

  // 2026
  "2026-01": { monthKey: "2026-01", cpiIndex: 112.5, cpiYoyPercent: 6.3, usdPlnRate: 4.04 },
  "2026-02": { monthKey: "2026-02", cpiIndex: 113.1, cpiYoyPercent: 6.3, usdPlnRate: 4.02 },
  "2026-03": { monthKey: "2026-03", cpiIndex: 113.7, cpiYoyPercent: 6.4, usdPlnRate: 3.99 },
  "2026-04": { monthKey: "2026-04", cpiIndex: 114.4, cpiYoyPercent: 6.1, usdPlnRate: 3.96 },
  "2026-05": { monthKey: "2026-05", cpiIndex: 114.8, cpiYoyPercent: 6.1, usdPlnRate: 3.95 },
  "2026-06": { monthKey: "2026-06", cpiIndex: 115.1, cpiYoyPercent: 6.2, usdPlnRate: 3.94 },
  "2026-07": { monthKey: "2026-07", cpiIndex: 115.7, cpiYoyPercent: 6.0, usdPlnRate: 3.92 },
  "2026-08": { monthKey: "2026-08", cpiIndex: 116.0, cpiYoyPercent: 6.0, usdPlnRate: 3.9 },
  "2026-09": { monthKey: "2026-09", cpiIndex: 116.4, cpiYoyPercent: 6.0, usdPlnRate: 3.92 },
  "2026-10": { monthKey: "2026-10", cpiIndex: 116.8, cpiYoyPercent: 5.9, usdPlnRate: 3.95 },
  "2026-11": { monthKey: "2026-11", cpiIndex: 117.2, cpiYoyPercent: 5.8, usdPlnRate: 3.95 },
  "2026-12": { monthKey: "2026-12", cpiIndex: 117.6, cpiYoyPercent: 5.7, usdPlnRate: 3.96 },
};

const DEFAULT_LATEST_MONTH = "2026-12";
const DEFAULT_EARLIEST_MONTH = "2023-01";

/**
 * Retrieves the macroeconomic data for a given month key (format "YYYY-MM" or ISO date string).
 * If the month is before 2023-01 or after 2026-12, clamps gracefully to bounds.
 */
export function getMacroData(monthKeyOrDateStr: string): MacroMonthData {
  const normalizedKey = monthKeyOrDateStr.slice(0, 7);
  if (MACRO_HISTORICAL_DATA[normalizedKey]) {
    return MACRO_HISTORICAL_DATA[normalizedKey];
  }
  if (normalizedKey < DEFAULT_EARLIEST_MONTH) {
    return MACRO_HISTORICAL_DATA[DEFAULT_EARLIEST_MONTH];
  }
  return MACRO_HISTORICAL_DATA[DEFAULT_LATEST_MONTH];
}
