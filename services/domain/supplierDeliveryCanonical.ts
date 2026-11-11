/**
 * Supplier delivery lines store purchase-unit quantities (same unit as
 * recommendations and inventory_items.unit). Inventory ledger receipts must
 * store canonical quantities (g / ml / each) so projection can divide by
 * canonical_quantity_per_unit back into native on-hand.
 */
export function purchaseUnitsToCanonicalQuantity(input: {
  purchaseQuantity: number;
  canonicalQuantityPerUnit: number;
}): number {
  const purchase = Number(input.purchaseQuantity);
  const factor = Number(input.canonicalQuantityPerUnit);
  if (!Number.isFinite(purchase) || purchase < 0 || purchase > 1_000_000) {
    throw new Error("Purchase quantity is outside supported limits");
  }
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1_000_000_000) {
    throw new Error("Canonical quantity per unit is not verified");
  }
  const canonical = purchase * factor;
  if (!Number.isFinite(canonical) || canonical < 0 || canonical > 1_000_000_000_000) {
    throw new Error("Canonical receipt quantity is outside supported limits");
  }
  return canonical;
}
