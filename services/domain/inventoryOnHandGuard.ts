/**
 * Client-side mirror of the hosted inventory projection check:
 * waste/usage convert canonical quantity into the item's native unit, then reject
 * when the projected on-hand would fall below zero.
 *
 * Server remains authoritative; this only prevents opaque RPC/outbox failures when
 * the operator's local on-hand snapshot already shows the decrease cannot fit.
 */

export type InventoryOnHandDecreaseCheck =
  | {
      ok: true;
      projectedNativeQuantity: number;
      availableCanonicalQuantity: number;
    }
  | {
      ok: false;
      reason: "invalid_conversion" | "invalid_quantity" | "insufficient_on_hand";
      projectedNativeQuantity: number | null;
      availableCanonicalQuantity: number | null;
    };

export function checkDecreasingInventoryFitsOnHand(input: {
  currentNativeQuantity: number;
  canonicalQuantityPerUnit: number;
  decreaseCanonicalQuantity: number;
}): InventoryOnHandDecreaseCheck {
  const conversion = input.canonicalQuantityPerUnit;
  const current = input.currentNativeQuantity;
  const decrease = input.decreaseCanonicalQuantity;

  if (!Number.isFinite(conversion) || conversion <= 0) {
    return {
      ok: false,
      reason: "invalid_conversion",
      projectedNativeQuantity: null,
      availableCanonicalQuantity: null
    };
  }
  if (!Number.isFinite(current) || current < 0) {
    return {
      ok: false,
      reason: "invalid_quantity",
      projectedNativeQuantity: null,
      availableCanonicalQuantity: null
    };
  }
  if (!Number.isFinite(decrease) || decrease < 0) {
    return {
      ok: false,
      reason: "invalid_quantity",
      projectedNativeQuantity: null,
      availableCanonicalQuantity: current * conversion
    };
  }

  const availableCanonicalQuantity = current * conversion;
  // Match hosted projection: native_event_quantity := quantity / quantity_per_unit
  const nativeEventQuantity = decrease / conversion;
  const projectedNativeQuantity = current - nativeEventQuantity;

  if (!Number.isFinite(projectedNativeQuantity) || projectedNativeQuantity < 0) {
    return {
      ok: false,
      reason: "insufficient_on_hand",
      projectedNativeQuantity: Number.isFinite(projectedNativeQuantity)
        ? projectedNativeQuantity
        : null,
      availableCanonicalQuantity
    };
  }

  return {
    ok: true,
    projectedNativeQuantity,
    availableCanonicalQuantity
  };
}

export function decreasingInventoryExceedsOnHand(input: {
  currentNativeQuantity: number;
  canonicalQuantityPerUnit: number;
  decreaseCanonicalQuantity: number;
}) {
  const result = checkDecreasingInventoryFitsOnHand(input);
  return result.ok === false && result.reason === "insufficient_on_hand";
}
