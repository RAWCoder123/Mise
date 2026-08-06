import type { PosSale } from "../../types/mise";

export interface InsightsSalesBestSeller {
  itemName: string;
  quantity: number;
  grossSales: number;
  share: number;
}

export interface InsightsSalesMixSlice {
  label: string;
  value: number;
  share: number;
}

export interface InsightsSalesWeekdaySlice {
  weekday: number;
  labelKey:
    | "insights.analytics.weekday.sun"
    | "insights.analytics.weekday.mon"
    | "insights.analytics.weekday.tue"
    | "insights.analytics.weekday.wed"
    | "insights.analytics.weekday.thu"
    | "insights.analytics.weekday.fri"
    | "insights.analytics.weekday.sat";
  value: number;
  share: number;
}

export interface InsightsSalesUnitsTrendPoint {
  date: string;
  units: number;
}

export interface InsightsSalesAnalytics {
  windowStart: string | null;
  throughDate: string | null;
  saleCount: number;
  totalGross: number;
  totalNet: number;
  totalUnits: number;
  bestSellers: InsightsSalesBestSeller[];
  categoryMix: InsightsSalesMixSlice[];
  weekdayMix: InsightsSalesWeekdaySlice[];
  sourceMix: InsightsSalesMixSlice[];
  unitsTrend: InsightsSalesUnitsTrendPoint[];
}

const WEEKDAY_KEYS: InsightsSalesWeekdaySlice["labelKey"][] = [
  "insights.analytics.weekday.sun",
  "insights.analytics.weekday.mon",
  "insights.analytics.weekday.tue",
  "insights.analytics.weekday.wed",
  "insights.analytics.weekday.thu",
  "insights.analytics.weekday.fri",
  "insights.analytics.weekday.sat"
];

/**
 * Builds scannable sales analytics from recorded POS rows only.
 * "Demographics" here means operational mix (category, weekday, POS source) —
 * not customer age/gender attributes Mise does not store.
 */
export function buildInsightsSalesAnalytics(input: {
  restaurantId: string;
  sales: readonly PosSale[];
  throughDate?: string | null;
  lookbackDays?: number;
  bestSellerLimit?: number;
  mixLimit?: number;
}): InsightsSalesAnalytics {
  const restaurantId = input.restaurantId.trim();
  const lookbackDays = Math.max(1, Math.min(31, input.lookbackDays ?? 7));
  const bestSellerLimit = Math.max(1, Math.min(12, input.bestSellerLimit ?? 5));
  const mixLimit = Math.max(2, Math.min(8, input.mixLimit ?? 5));

  const throughDate =
    input.throughDate?.trim() ||
    latestSaleDate(input.sales.filter((sale) => sale.restaurant_id === restaurantId));
  const windowStart = throughDate ? shiftDateKey(throughDate, -(lookbackDays - 1)) : null;

  const windowSales = input.sales.filter((sale) => {
    if (sale.restaurant_id !== restaurantId) return false;
    if (!windowStart || !throughDate) return false;
    return sale.sale_date >= windowStart && sale.sale_date <= throughDate;
  });

  const totalGross = sum(windowSales.map((sale) => sale.gross_sales));
  const totalNet = sum(windowSales.map((sale) => sale.net_sales));
  const totalUnits = sum(windowSales.map((sale) => sale.quantity_sold));

  return {
    windowStart,
    throughDate,
    saleCount: windowSales.length,
    totalGross,
    totalNet,
    totalUnits,
    bestSellers: buildBestSellers(windowSales, totalGross, bestSellerLimit),
    categoryMix: buildMix(
      windowSales,
      (sale) => normalizeLabel(sale.category) || "Uncategorized",
      (sale) => sale.gross_sales,
      mixLimit
    ),
    weekdayMix: buildWeekdayMix(windowSales),
    sourceMix: buildMix(
      windowSales,
      (sale) => normalizeLabel(sale.source_pos) || "POS",
      (sale) => sale.gross_sales,
      mixLimit
    ),
    unitsTrend: buildUnitsTrend(windowSales, windowStart, throughDate)
  };
}

function buildBestSellers(
  sales: readonly PosSale[],
  totalGross: number,
  limit: number
): InsightsSalesBestSeller[] {
  const byItem = new Map<string, { quantity: number; grossSales: number }>();
  for (const sale of sales) {
    const key = normalizeLabel(sale.item_name) || "Item";
    const current = byItem.get(key) ?? { quantity: 0, grossSales: 0 };
    current.quantity += Math.max(0, sale.quantity_sold);
    current.grossSales += Math.max(0, sale.gross_sales);
    byItem.set(key, current);
  }

  return [...byItem.entries()]
    .map(([itemName, stats]) => ({
      itemName,
      quantity: round1(stats.quantity),
      grossSales: round2(stats.grossSales),
      share: totalGross > 0 ? stats.grossSales / totalGross : 0
    }))
    .sort(
      (left, right) =>
        right.grossSales - left.grossSales ||
        right.quantity - left.quantity ||
        left.itemName.localeCompare(right.itemName)
    )
    .slice(0, limit);
}

function buildMix(
  sales: readonly PosSale[],
  labelFor: (sale: PosSale) => string,
  valueFor: (sale: PosSale) => number,
  limit: number
): InsightsSalesMixSlice[] {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    const label = labelFor(sale);
    totals.set(label, (totals.get(label) ?? 0) + Math.max(0, valueFor(sale)));
  }

  const ranked = [...totals.entries()]
    .map(([label, value]) => ({ label, value: round2(value) }))
    .sort(
      (left, right) => right.value - left.value || left.label.localeCompare(right.label)
    );

  if (ranked.length === 0) return [];

  const head = ranked.slice(0, limit - 1);
  const rest = ranked.slice(limit - 1);
  const slices =
    rest.length <= 1
      ? ranked.slice(0, limit)
      : [
          ...head,
          {
            label: "Other",
            value: round2(sum(rest.map((entry) => entry.value)))
          }
        ];

  const total = sum(slices.map((slice) => slice.value));
  return slices.map((slice) => ({
    ...slice,
    share: total > 0 ? slice.value / total : 0
  }));
}

function buildWeekdayMix(sales: readonly PosSale[]): InsightsSalesWeekdaySlice[] {
  const totals: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const sale of sales) {
    const weekday = weekdayIndex(sale.sale_date);
    if (weekday == null) continue;
    totals[weekday] = (totals[weekday] ?? 0) + Math.max(0, sale.gross_sales);
  }
  const total = sum(totals);
  return totals.map((value, weekday) => ({
    weekday,
    labelKey: WEEKDAY_KEYS[weekday] ?? "insights.analytics.weekday.sun",
    value: round2(value),
    share: total > 0 ? value / total : 0
  }));
}

function buildUnitsTrend(
  sales: readonly PosSale[],
  windowStart: string | null,
  throughDate: string | null
): InsightsSalesUnitsTrendPoint[] {
  if (!windowStart || !throughDate) return [];
  const byDate = new Map<string, number>();
  for (let cursor = windowStart; cursor <= throughDate; cursor = shiftDateKey(cursor, 1)) {
    byDate.set(cursor, 0);
  }
  for (const sale of sales) {
    if (!byDate.has(sale.sale_date)) continue;
    byDate.set(sale.sale_date, (byDate.get(sale.sale_date) ?? 0) + Math.max(0, sale.quantity_sold));
  }
  return [...byDate.entries()].map(([date, units]) => ({
    date,
    units: round1(units)
  }));
}

function latestSaleDate(sales: readonly PosSale[]): string | null {
  let latest: string | null = null;
  for (const sale of sales) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sale.sale_date)) continue;
    if (!latest || sale.sale_date > latest) latest = sale.sale_date;
  }
  return latest;
}

function weekdayIndex(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const parsed = Date.parse(`${dateKey}T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).getUTCDay();
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parsed = Date.parse(`${dateKey}T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) return dateKey;
  const next = new Date(parsed);
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next.toISOString().slice(0, 10);
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
