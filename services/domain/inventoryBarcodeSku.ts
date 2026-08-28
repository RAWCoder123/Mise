/** Bounded supplier SKU / barcode capture contract for inventory linking. */

export const INVENTORY_BARCODE_SKU_MAX_CHARACTERS = 64;

export function normalizeCapturedSupplierSku(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier SKU barcode is required.");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Supplier SKU barcode is required.");
  }
  if (trimmed.length > INVENTORY_BARCODE_SKU_MAX_CHARACTERS) {
    throw new Error(
      `Supplier SKU barcode must be at most ${INVENTORY_BARCODE_SKU_MAX_CHARACTERS} characters.`
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error("Supplier SKU barcode contains invalid characters.");
  }
  return trimmed;
}
