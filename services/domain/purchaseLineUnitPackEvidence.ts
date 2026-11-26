/**
 * Structural audit evidence for purchase-line unit_of_measure and pack_size.
 *
 * Hosted `private.purchase_line_text` already btrims optional unit and pack
 * labels before append. On current main, every other insert path (direct
 * service_role inserts, append helpers that skip the ingest preflight, future
 * writers) can still stamp padded unit_of_measure or pack_size onto the
 * append-only ledger.
 *
 * `unit_of_measure` is part of the netting group
 * `(restaurant, supplier, normalized_item_key, unit_of_measure, currency)`.
 * Padding invents a parallel net group beside the trimmed label, so credits
 * and purchases that a human would call the same unit fail to net. Padded
 * pack_size similarly splits pack-unit dimension checks and provenance.
 *
 * Product ingest already soft-empties blank optional labels to null via
 * `optionalBoundedText`. This tip fails closed when a present label retains
 * leading/trailing whitespace. Null remains allowed. Soft-empty strings are
 * left to the existing length-after-trim CHECK and the product nullify path.
 * Length-only bounds and control-character pins stay with their own tips.
 */

/**
 * Domain rejection reason for padded unit_of_measure labels.
 * Returns null when the label is absent, soft-empty, or already trimmed.
 */
export function validatePurchaseLineUnitOfMeasureEvidence(input: {
  unitOfMeasure: string | null | undefined;
}): string | null {
  if (input.unitOfMeasure == null) return null;
  const trimmed = input.unitOfMeasure.trim();
  // Soft-empty is treated as absent by product writers (optionalBoundedText → null).
  if (trimmed === "") return null;
  if (input.unitOfMeasure !== trimmed) {
    return "invalid_unit_of_measure_shape";
  }
  return null;
}

/**
 * Domain rejection reason for padded pack_size labels.
 * Returns null when the label is absent, soft-empty, or already trimmed.
 */
export function validatePurchaseLinePackSizeEvidence(input: {
  packSize: string | null | undefined;
}): string | null {
  if (input.packSize == null) return null;
  const trimmed = input.packSize.trim();
  // Soft-empty is treated as absent by product writers (optionalBoundedText → null).
  if (trimmed === "") return null;
  if (input.packSize !== trimmed) {
    return "invalid_pack_size_shape";
  }
  return null;
}
