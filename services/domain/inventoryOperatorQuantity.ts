/**
 * Ad-hoc inventory ops (detail Receive/Waste/Count + Log Delivery) collect
 * quantities in the same purchase/native `item.unit` the rest of the item
 * surface shows. Ledger events must store canonical g/ml/each so projection
 * can divide by `canonical_quantity_per_unit` back into native on-hand.
 *
 * Count sessions already convert `counted_quantity * factor` on approve. This
 * module is the matching conversion for single-item operator ops. It does not
 * touch supplier-order Mark Received (#392).
 */

export type OperatorPurchaseUnitItem = {
  unit: string;
  canonical_unit?: "g" | "ml" | "each" | null;
  canonical_quantity_per_unit?: number | null;
  canonical_unit_verification_status?: "draft" | "verified" | "rejected" | "expired" | null;
};

export type OperatorPurchaseUnitConversion = {
  purchaseQuantity: number;
  purchaseUnit: string;
  canonicalQuantity: number;
  canonicalUnit: "g" | "ml" | "each";
  canonicalQuantityPerUnit: number;
  metadata: {
    purchase_unit_quantity: number;
    purchase_unit: string;
    canonical_quantity_per_unit: number;
  };
};

const MAX_PURCHASE_QUANTITY = 1_000_000;
const MAX_FACTOR = 1_000_000_000;
const MAX_CANONICAL_QUANTITY = 1_000_000_000_000;

export function isOperatorPurchaseUnitReady(item: OperatorPurchaseUnitItem): boolean {
  const factor = item.canonical_quantity_per_unit;
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each") &&
    factor != null &&
    Number.isFinite(factor) &&
    factor > 0 &&
    factor <= MAX_FACTOR
  );
}

/**
 * Convert a purchase-unit operator quantity into the canonical ledger quantity.
 * Fails closed when the conversion factor is missing, unverified, or out of bounds.
 */
export function purchaseUnitsToCanonicalOperatorQuantity(input: {
  purchaseQuantity: number;
  canonicalQuantityPerUnit: number;
}): number {
  const purchase = Number(input.purchaseQuantity);
  const factor = Number(input.canonicalQuantityPerUnit);
  if (!Number.isFinite(purchase) || purchase < 0 || purchase > MAX_PURCHASE_QUANTITY) {
    throw new Error("Purchase quantity is outside supported limits");
  }
  if (!Number.isFinite(factor) || factor <= 0 || factor > MAX_FACTOR) {
    throw new Error("Canonical quantity per unit is not verified");
  }
  const canonical = purchase * factor;
  if (!Number.isFinite(canonical) || canonical < 0 || canonical > MAX_CANONICAL_QUANTITY) {
    throw new Error("Canonical inventory quantity is outside supported limits");
  }
  return canonical;
}

/**
 * Resolve the ledger quantity and bounded metadata for a non-stockout operator
 * mutation. Callers pass the quantity the operator typed in `item.unit`.
 */
export function resolveOperatorPurchaseUnitQuantity(input: {
  purchaseQuantity: number;
  item: OperatorPurchaseUnitItem;
}): OperatorPurchaseUnitConversion {
  if (!isOperatorPurchaseUnitReady(input.item)) {
    throw new Error("Inventory item canonical conversion is not verified");
  }
  const purchaseUnit = input.item.unit.trim();
  if (!purchaseUnit) {
    throw new Error("Inventory item purchase unit is missing");
  }
  const canonicalQuantityPerUnit = Number(input.item.canonical_quantity_per_unit);
  const canonicalQuantity = purchaseUnitsToCanonicalOperatorQuantity({
    purchaseQuantity: input.purchaseQuantity,
    canonicalQuantityPerUnit
  });
  return {
    purchaseQuantity: input.purchaseQuantity,
    purchaseUnit,
    canonicalQuantity,
    canonicalUnit: input.item.canonical_unit as "g" | "ml" | "each",
    canonicalQuantityPerUnit,
    metadata: {
      purchase_unit_quantity: input.purchaseQuantity,
      purchase_unit: purchaseUnit,
      canonical_quantity_per_unit: canonicalQuantityPerUnit
    }
  };
}
