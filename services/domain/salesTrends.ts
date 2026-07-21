import type { PosSale } from "../../types/mise";

export interface RecordedSalesTrendPoint {
  date: string;
  sales: number;
}

export interface RecordedSalesTrendOptions {
  limit?: number;
  throughDate?: string | null;
}

/**
 * Aggregates recorded gross sales by restaurant service date. Missing dates
 * are not invented as zero-sales days, and future/malformed rows are ignored.
 */
export function buildRecordedSalesTrend(
  restaurantId: string,
  sales: readonly PosSale[],
  options: RecordedSalesTrendOptions = {}
): RecordedSalesTrendPoint[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return [];

  const pointLimit = typeof options.limit === "number" && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : 7;
  const throughDate = isDateKey(options.throughDate) ? options.throughDate : null;
  const totalsByDate = new Map<string, number>();

  sales.forEach((sale) => {
    if (
      sale.restaurant_id !== normalizedRestaurantId ||
      !isDateKey(sale.sale_date) ||
      (throughDate !== null && sale.sale_date > throughDate) ||
      !Number.isFinite(sale.gross_sales) ||
      sale.gross_sales < 0
    ) {
      return;
    }
    totalsByDate.set(sale.sale_date, (totalsByDate.get(sale.sale_date) ?? 0) + sale.gross_sales);
  });

  return [...totalsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .slice(-pointLimit)
    .map(([date, salesTotal]) => ({
      date,
      sales: Math.round(salesTotal * 100) / 100
    }));
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}
