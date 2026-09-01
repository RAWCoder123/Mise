import type { InventoryItem } from "../../types/mise";

export type VerifiedCanonicalUnit = "g" | "ml" | "each";

export interface VerifiedCanonicalConversion {
  canonicalUnit: VerifiedCanonicalUnit;
  purchaseUnit: string;
  quantityPerUnit: number;
}

type CanonicalConversionItem = Pick<
  InventoryItem,
  | "unit"
  | "canonical_unit"
  | "canonical_quantity_per_unit"
  | "canonical_unit_verification_status"
>;

/**
 * Returns the operator-facing verified conversion only when inventory authority
 * has a finite positive factor. Never invents grams/ml/each-per-purchase-unit.
 */
export function resolveVerifiedCanonicalConversion(
  item: CanonicalConversionItem | null | undefined
): VerifiedCanonicalConversion | null {
  if (!item) return null;
  if (item.canonical_unit_verification_status !== "verified") return null;

  const canonicalUnit = item.canonical_unit;
  if (canonicalUnit !== "g" && canonicalUnit !== "ml" && canonicalUnit !== "each") {
    return null;
  }

  const quantityPerUnit = item.canonical_quantity_per_unit;
  if (
    quantityPerUnit == null ||
    !Number.isFinite(quantityPerUnit) ||
    quantityPerUnit <= 0
  ) {
    return null;
  }

  const purchaseUnit = typeof item.unit === "string" ? item.unit.trim() : "";
  if (!purchaseUnit) return null;

  return {
    canonicalUnit,
    purchaseUnit,
    quantityPerUnit
  };
}
