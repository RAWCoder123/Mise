import { normalizeOperationalQuantity, type CanonicalOperationalUnit } from "./operationalMapping";

export type CanonicalUnitVerificationSuggestion =
  | {
      kind: "standard";
      canonicalUnit: CanonicalOperationalUnit;
      canonicalQuantityPerUnit: number;
      /** Standard units cannot be overridden; the manager confirms the fixed conversion. */
      locked: true;
    }
  | {
      kind: "manual";
      canonicalUnit: CanonicalOperationalUnit | null;
      canonicalQuantityPerUnit: number | null;
      locked: false;
    };

const MAX_CANONICAL_QUANTITY_PER_UNIT = 1_000_000_000;

/**
 * Suggests the manager-facing canonical conversion for an inventory storage unit.
 * Standard mass/volume/each units lock to the deterministic conversion; pack-like
 * units require an explicit manager quantity.
 */
export function suggestCanonicalUnitVerification(
  inventoryUnit: string
): CanonicalUnitVerificationSuggestion {
  const normalized = normalizeOperationalQuantity({
    quantity: 1,
    unit: inventoryUnit
  });
  if (
    normalized.ok &&
    normalized.unit &&
    normalized.quantity !== null &&
    Number.isFinite(normalized.quantity) &&
    normalized.quantity > 0
  ) {
    return {
      kind: "standard",
      canonicalUnit: normalized.unit,
      canonicalQuantityPerUnit: normalized.quantity,
      locked: true
    };
  }
  return {
    kind: "manual",
    canonicalUnit: null,
    canonicalQuantityPerUnit: null,
    locked: false
  };
}

export function isCanonicalUnitReady(item: {
  canonical_unit?: CanonicalOperationalUnit | null;
  canonical_unit_verification_status?: string | null;
}): boolean {
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each")
  );
}

export function assertCanonicalUnitVerificationInput(input: {
  canonicalUnit: unknown;
  canonicalQuantityPerUnit: unknown;
}): {
  canonicalUnit: CanonicalOperationalUnit;
  canonicalQuantityPerUnit: number;
} {
  const canonicalUnit =
    input.canonicalUnit === "g" || input.canonicalUnit === "ml" || input.canonicalUnit === "each"
      ? input.canonicalUnit
      : null;
  if (!canonicalUnit) {
    throw new Error("Canonical unit must be g, ml, or each");
  }
  const quantity = Number(input.canonicalQuantityPerUnit);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_CANONICAL_QUANTITY_PER_UNIT
  ) {
    throw new Error("Canonical quantity per inventory unit is invalid");
  }
  return {
    canonicalUnit,
    canonicalQuantityPerUnit: quantity
  };
}

/**
 * For standard inventory units, reject overrides that diverge from the locked
 * conversion so the client matches the hosted RPC fail-closed rule.
 */
export function assertCanonicalUnitMatchesSuggestion(
  inventoryUnit: string,
  canonicalUnit: CanonicalOperationalUnit,
  canonicalQuantityPerUnit: number
) {
  const suggestion = suggestCanonicalUnitVerification(inventoryUnit);
  if (suggestion.kind !== "standard") return;
  if (
    suggestion.canonicalUnit !== canonicalUnit ||
    suggestion.canonicalQuantityPerUnit !== canonicalQuantityPerUnit
  ) {
    throw new Error("Standard-unit canonical conversion cannot be overridden");
  }
}
