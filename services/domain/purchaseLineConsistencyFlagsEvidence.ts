/**
 * Structural audit evidence for purchase-line consistency_flags.
 *
 * Hosted ingest/append always stores flags from
 * `private.purchase_line_consistency_flags` against the line's recorded
 * quantities, units, prices, dates, and pack wording. Product
 * `normalizePurchaseLineInput` computes the same flags before the RPC.
 *
 * On current main, every other insert path (direct service_role inserts,
 * append helpers that skip the ingest preflight, future writers) can still
 * stamp arbitrary allowlisted `consistency_flags` onto the append-only ledger
 * because the existing column CHECK only requires the array to be a subset of
 * the four known flag labels. Forged empty flags can hide an extended-price or
 * pack-unit contradiction beneath `confirmed` confidence; forged flags can
 * also invent a downgrade when the line is internally consistent.
 *
 * Stated versus described pack wording is not stored as separate columns.
 * After coalesce into `pack_size`, the durable reconstruction is:
 * stated stand-in = stored `pack_size`, described =
 * `extract_purchase_pack_size(raw_item_description)`. That reconstruction
 * matches ingest outcomes for every flag the helper emits.
 *
 * Callers compute the expected flag array with
 * `computePurchaseLineConsistencyFlags` using that stored-shape pair, then
 * pass both claimed and expected arrays here. This module stays free of
 * imports from `purchaseLines.ts` so the product normalize path can pin the
 * contract without a circular dependency.
 */

/**
 * Domain rejection reason when claimed consistency_flags disagree with the
 * flags implied by the recorded line evidence. Returns null when they match.
 */
export function validatePurchaseLineConsistencyFlagsEvidence(input: {
  consistencyFlags: readonly string[];
  expectedConsistencyFlags: readonly string[];
}): string | null {
  if (input.consistencyFlags.length !== input.expectedConsistencyFlags.length) {
    return "invalid_consistency_flags";
  }
  if (
    !input.consistencyFlags.every(
      (flag, index) => flag === input.expectedConsistencyFlags[index]
    )
  ) {
    return "invalid_consistency_flags";
  }
  return null;
}
