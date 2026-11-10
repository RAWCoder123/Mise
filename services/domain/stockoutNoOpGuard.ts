/**
 * Stockout events always post quantity = 0 and project on-hand to zero.
 * When native on-hand is already zero, the row would not change inventory —
 * reject it so the append-only ledger stays free of no-op stockouts.
 */

export const NOOP_STOCKOUT_MESSAGE =
  "On-hand is already zero; stockout would not change inventory";

export type StockoutNoOpReason = "noop_stockout";

export function rejectNoOpStockoutReason(input: {
  eventType: string;
  currentNativeQuantity: number;
}): StockoutNoOpReason | null {
  if (input.eventType !== "stockout") return null;
  if (!Number.isFinite(input.currentNativeQuantity)) return null;
  if (input.currentNativeQuantity !== 0) return null;
  return "noop_stockout";
}
