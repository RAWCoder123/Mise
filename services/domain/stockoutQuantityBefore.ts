/**
 * Server-owned stockout evidence: the native on-hand wiped by a quantity=0
 * stockout row. Clients must not forge these keys; hosted RPC/demo stamp them.
 */

export const STOCKOUT_QUANTITY_BEFORE_METADATA_KEY = "quantity_before" as const;
export const STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY =
  "canonical_quantity_before" as const;

const SERVER_OWNED_STOCKOUT_METADATA_KEYS = [
  STOCKOUT_QUANTITY_BEFORE_METADATA_KEY,
  STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY
] as const;

export function clientComparableInventoryEventMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined
): Record<string, unknown> {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (
      (SERVER_OWNED_STOCKOUT_METADATA_KEYS as readonly string[]).includes(key)
    ) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

/**
 * Stamp prior native on-hand (and canonical equivalent) onto stockout metadata.
 * Overwrites any client-supplied values for the server-owned keys.
 */
export function stampStockoutQuantityBeforeMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined,
  quantityBeforeNative: number,
  canonicalQuantityPerUnit: number
): Record<string, unknown> {
  if (!Number.isFinite(quantityBeforeNative) || quantityBeforeNative < 0) {
    throw new Error("Stockout quantity_before must be a finite non-negative native quantity.");
  }
  if (
    !Number.isFinite(canonicalQuantityPerUnit) ||
    canonicalQuantityPerUnit <= 0
  ) {
    throw new Error("Stockout canonical conversion is required to stamp quantity_before.");
  }
  const canonicalQuantityBefore = quantityBeforeNative * canonicalQuantityPerUnit;
  return {
    ...clientComparableInventoryEventMetadata(metadata),
    [STOCKOUT_QUANTITY_BEFORE_METADATA_KEY]: quantityBeforeNative,
    [STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY]: canonicalQuantityBefore
  };
}
