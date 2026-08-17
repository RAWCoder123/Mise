import type { InventoryItem, PosSale } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";

/**
 * Verified physical-count freshness for an inventory item.
 * Never falls back to generic `last_updated` (policy edits, receipts, waste).
 */
export function inventoryCountAsOf(
  item: Pick<InventoryItem, "last_counted_at">
): string | null {
  const value = item.last_counted_at;
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

/**
 * Best available sale event time for depletion anchoring.
 * Prefer provider `sold_at`; date-only rows cannot be timed within a day.
 */
export function saleEffectiveAt(
  sale: Pick<PosSale, "sold_at" | "sale_date" | "created_at">
): string | null {
  if (typeof sale.sold_at === "string" && sale.sold_at.trim()) {
    return Number.isFinite(Date.parse(sale.sold_at)) ? sale.sold_at : null;
  }
  return null;
}

/**
 * Whether a sale should deplete projected on-hand after a verified count.
 *
 * Rules:
 * - Sale must be on the restaurant operating date.
 * - No verified count → keep prior full-day depletion (low-confidence path).
 * - Count before the operating day → deplete all operating-day sales.
 * - Count after the operating day → deplete none.
 * - Same calendar day as the count → only sales with sold_at strictly after the count.
 *   Date-only same-day sales are excluded to avoid double-counting morning usage
 *   already reflected in a midday count.
 */
export function isSaleInDepletionWindow(
  sale: Pick<PosSale, "sold_at" | "sale_date" | "created_at">,
  operatingDate: string,
  countedAt: string | null,
  restaurantTimeZone = "UTC"
): boolean {
  if (sale.sale_date !== operatingDate) return false;
  if (!countedAt) return true;

  const countMs = Date.parse(countedAt);
  if (!Number.isFinite(countMs)) return true;

  const countDate = toDateKeyInTimeZone(new Date(countMs), restaurantTimeZone);
  if (countDate < operatingDate) return true;
  if (countDate > operatingDate) return false;

  const effective = saleEffectiveAt(sale);
  if (!effective) return false;
  const saleMs = Date.parse(effective);
  return Number.isFinite(saleMs) && saleMs > countMs;
}

export function isFreshInventoryCount(
  item: Pick<InventoryItem, "last_counted_at">,
  now: Date,
  maximumAgeHours: number
): boolean {
  const countedAt = inventoryCountAsOf(item);
  if (!countedAt) return false;
  if (!Number.isFinite(maximumAgeHours) || maximumAgeHours <= 0) return false;
  const ageMs = now.getTime() - Date.parse(countedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return false;
  return ageMs <= maximumAgeHours * 60 * 60 * 1000;
}
