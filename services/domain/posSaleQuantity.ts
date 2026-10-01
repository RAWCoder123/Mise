import type { PosSale } from "../../types/mise";

export type PosSaleRecordKind = "sale" | "return";

export function normalizePosSaleRecordKind(value: unknown): PosSaleRecordKind {
  return value === "return" ? "return" : "sale";
}

/**
 * Signed POS quantity for inventory depletion and demand math.
 * Stored `quantity_sold` stays strictly positive; returns subtract usage.
 */
export function posSaleQuantityDelta(
  sale: Pick<PosSale, "quantity_sold" | "record_kind">
): number {
  const quantity = Number.isFinite(sale.quantity_sold) ? Math.max(0, sale.quantity_sold) : 0;
  if (quantity <= 0) return 0;
  return normalizePosSaleRecordKind(sale.record_kind) === "return" ? -quantity : quantity;
}

export function posSaleMoneyDelta(
  sale: Pick<PosSale, "gross_sales" | "net_sales" | "record_kind">,
  field: "gross_sales" | "net_sales"
): number {
  const amount = Number.isFinite(sale[field]) ? Math.max(0, sale[field]) : 0;
  if (amount <= 0) return 0;
  return normalizePosSaleRecordKind(sale.record_kind) === "return" ? -amount : amount;
}
