/**
 * Structural audit evidence for purchase-line normalized_item_key.
 *
 * Hosted append always stores the key from
 * `private.normalize_purchase_item_key`, which already btrims. Product
 * `normalizePurchaseLineDescription` also trims before returning a key. On
 * current main, every other insert path (direct service_role inserts, append
 * helpers that skip the ingest preflight, future writers) can still stamp a
 * padded normalized_item_key onto the append-only ledger because the existing
 * column CHECK only requires `length(normalized_item_key) between 1 and 500`.
 *
 * `normalized_item_key` is part of the netting group
 * `(restaurant, supplier, normalized_item_key, unit_of_measure, currency)`.
 * Padding invents a parallel net group beside the trimmed key, so credits and
 * purchases that a human would call the same item fail to net. The match CHECK
 * against `normalize_purchase_item_key(raw_item_description)` already refuses
 * mismatched keys with a generic violation; this tip fails closed with an
 * explicit unpadded contract for every insert path. Length-only bounds and
 * control-character / locale pins stay with their own tips.
 */

/**
 * Domain rejection reason for padded normalized_item_key values.
 * Returns null when the key is absent, soft-empty, or already trimmed.
 */
export function validatePurchaseLineNormalizedItemKeyEvidence(input: {
  normalizedItemKey: string | null | undefined;
}): string | null {
  if (input.normalizedItemKey == null) return null;
  const trimmed = input.normalizedItemKey.trim();
  // Soft-empty is treated as absent by product writers (normalize → null).
  if (trimmed === "") return null;
  if (input.normalizedItemKey !== trimmed) {
    return "invalid_normalized_item_key_shape";
  }
  return null;
}
