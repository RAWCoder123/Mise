/**
 * Bounded stockout reason categories stored on inventory_events.reason_code.
 * Free-text notes remain optional metadata; structured codes enable learning
 * about why coverage reached zero without inventing quantities or forecasts.
 */
export const STOCKOUT_REASON_CODES = [
  "under_ordered",
  "unexpected_demand",
  "delivery_missed",
  "spoilage_cleared",
  "theft_loss",
  "other"
] as const;

export type StockoutReasonCode = (typeof STOCKOUT_REASON_CODES)[number];

/** Categories that should elevate purchasing / coverage attention. */
export const HIGH_ATTENTION_STOCKOUT_REASON_CODES = new Set<StockoutReasonCode>([
  "under_ordered",
  "unexpected_demand",
  "delivery_missed"
]);

const STOCKOUT_REASON_CODE_SET = new Set<string>(STOCKOUT_REASON_CODES);

export function isStockoutReasonCode(value: string): value is StockoutReasonCode {
  return STOCKOUT_REASON_CODE_SET.has(value);
}

/**
 * Requires an allowlisted stockout reason. Blank or unknown values fail closed
 * so stockout events always carry comparable learning evidence.
 */
export function requireStockoutReasonCode(value: unknown): StockoutReasonCode {
  if (value === null || value === undefined || value === "") {
    throw new Error("Choose a stockout reason.");
  }
  if (typeof value !== "string") {
    throw new Error("Choose a stockout reason.");
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    throw new Error("Choose a stockout reason.");
  }
  if (!isStockoutReasonCode(normalized)) {
    throw new Error("Choose a supported stockout reason.");
  }
  return normalized;
}

export function stockoutReasonMessageKey(
  code: StockoutReasonCode | null | undefined
): `stockout.reason.${StockoutReasonCode}` | "stockout.reason.unspecified" {
  if (code && isStockoutReasonCode(code)) {
    return `stockout.reason.${code}`;
  }
  return "stockout.reason.unspecified";
}
