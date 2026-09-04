/**
 * Client-side mirror of the hosted inventory projection check:
 * events convert canonical quantity into the item's native unit, then reject
 * when projected on-hand would fall below zero or above 1_000_000.
 *
 * Server remains authoritative; this only prevents opaque RPC/outbox failures when
 * the operator's local on-hand snapshot already shows the move cannot fit.
 */

export const INVENTORY_ON_HAND_NATIVE_CEILING = 1_000_000;

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

export type InventoryOnHandIncreaseCheck =
  | {
      ok: true;
      projectedNativeQuantity: number;
      remainingCanonicalCapacity: number;
    }
  | {
      ok: false;
      reason: "invalid_conversion" | "invalid_quantity" | "exceeds_on_hand_ceiling";
      projectedNativeQuantity: number | null;
      remainingCanonicalCapacity: number | null;
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

export function checkIncreasingInventoryFitsOnHand(input: {
  currentNativeQuantity: number;
  canonicalQuantityPerUnit: number;
  increaseCanonicalQuantity: number;
  nativeCeiling?: number;
}): InventoryOnHandIncreaseCheck {
  const conversion = input.canonicalQuantityPerUnit;
  const current = input.currentNativeQuantity;
  const increase = input.increaseCanonicalQuantity;
  const ceiling = input.nativeCeiling ?? INVENTORY_ON_HAND_NATIVE_CEILING;

  if (!Number.isFinite(conversion) || conversion <= 0) {
    return {
      ok: false,
      reason: "invalid_conversion",
      projectedNativeQuantity: null,
      remainingCanonicalCapacity: null
    };
  }
  if (!Number.isFinite(ceiling) || ceiling < 0) {
    return {
      ok: false,
      reason: "invalid_quantity",
      projectedNativeQuantity: null,
      remainingCanonicalCapacity: null
    };
  }
  if (!Number.isFinite(current) || current < 0) {
    return {
      ok: false,
      reason: "invalid_quantity",
      projectedNativeQuantity: null,
      remainingCanonicalCapacity: null
    };
  }
  if (!Number.isFinite(increase) || increase < 0) {
    return {
      ok: false,
      reason: "invalid_quantity",
      projectedNativeQuantity: null,
      remainingCanonicalCapacity: Math.max(0, (ceiling - current) * conversion)
    };
  }

  const remainingCanonicalCapacity = Math.max(0, (ceiling - current) * conversion);
  // Match hosted projection: native_event_quantity := quantity / quantity_per_unit
  const nativeEventQuantity = increase / conversion;
  const projectedNativeQuantity = current + nativeEventQuantity;

  if (!Number.isFinite(projectedNativeQuantity) || projectedNativeQuantity > ceiling) {
    return {
      ok: false,
      reason: "exceeds_on_hand_ceiling",
      projectedNativeQuantity: Number.isFinite(projectedNativeQuantity)
        ? projectedNativeQuantity
        : null,
      remainingCanonicalCapacity
    };
  }

  return {
    ok: true,
    projectedNativeQuantity,
    remainingCanonicalCapacity
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

export function increasingInventoryExceedsOnHandCeiling(input: {
  currentNativeQuantity: number;
  canonicalQuantityPerUnit: number;
  increaseCanonicalQuantity: number;
  nativeCeiling?: number;
}) {
  const result = checkIncreasingInventoryFitsOnHand(input);
  return result.ok === false && result.reason === "exceeds_on_hand_ceiling";
}

/**
 * Hosted projection uses one SQLSTATE 22023 message for both floor and ceiling.
 * When the attempted event type is known, map to the matching operator-facing reason.
 */
export function onHandLimitRejectionReason(eventType: string | null | undefined): string {
  switch (eventType) {
    case "waste":
    case "usage":
    case "transfer":
      return "insufficient_on_hand";
    case "receipt":
    case "count":
      return "exceeds_on_hand_ceiling";
    default:
      // Signed adjustments/corrections can move either direction; keep neutral.
      return "on_hand_out_of_limits";
  }
}
