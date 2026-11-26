/**
 * Structural audit evidence for purchase-line recorder attribution.
 *
 * `purchase_lines.recorded_by` is nullable so account-deletion anonymization
 * can clear only the deleted operator's auth identity while preserving every
 * append-only business field (`ON DELETE SET NULL` + the append-only UPDATE
 * escape in `private.reject_purchase_line_mutation`).
 *
 * Hosted `private.append_purchase_line` stamps `auth.uid()`. On current main,
 * every other insert path that reaches the table (including direct
 * service_role inserts that satisfy the existing soft CHECKs) can mint an
 * append-only purchase or credit row with `recorded_by = null` — an
 * unattributable invoice history entry that Activity / netting / audit
 * analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `recorded_by` is null. It does not
 * restore a table-level NOT NULL / CHECK (that would block auth
 * anonymization UPDATEs), rewrite history, or change the append-only
 * mutation escape. Orthogonal to document/source/padding tips and to
 * inventory actor attribution (#1280).
 */

/**
 * Domain rejection reason for missing recorder attribution on accept.
 * Returns null when a non-empty recorder id is present.
 */
export function validatePurchaseLineRecordedByEvidence(input: {
  recordedBy: string | null | undefined;
}): string | null {
  if (typeof input.recordedBy !== "string") {
    return "missing_recorded_by";
  }
  if (!input.recordedBy.trim()) {
    return "missing_recorded_by";
  }
  return null;
}
