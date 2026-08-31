/**
 * Bounded waste reason categories stored on inventory_events.reason_code.
 * Free-text notes remain optional metadata; structured codes enable analysis.
 */
export const WASTE_REASON_CODES = [
  "spoilage",
  "prep_trim",
  "overproduction",
  "dropped_broken",
  "expired",
  "other"
] as const;

export type WasteReasonCode = (typeof WASTE_REASON_CODES)[number];

/** Categories that should elevate waste attention when they dominate a window. */
export const HIGH_ATTENTION_WASTE_REASON_CODES = new Set<WasteReasonCode>([
  "spoilage",
  "expired"
]);

const WASTE_REASON_CODE_SET = new Set<string>(WASTE_REASON_CODES);

export function isWasteReasonCode(value: string): value is WasteReasonCode {
  return WASTE_REASON_CODE_SET.has(value);
}

/**
 * Normalizes operator or ledger reason text into an allowlisted waste code.
 * Returns null for blank input; throws for unknown non-blank values.
 */
export function requireWasteReasonCode(value: unknown): WasteReasonCode | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Choose a waste reason.");
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (!isWasteReasonCode(normalized)) {
    throw new Error("Choose a supported waste reason.");
  }
  return normalized;
}

export function wasteReasonMessageKey(
  code: WasteReasonCode | null | undefined
): `waste.reason.${WasteReasonCode}` | "waste.reason.unspecified" {
  if (code && isWasteReasonCode(code)) {
    return `waste.reason.${code}`;
  }
  return "waste.reason.unspecified";
}
