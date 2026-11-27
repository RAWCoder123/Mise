/**
 * Structural audit evidence for approved inventory count-session submit time.
 *
 * Soft CHECKs already require `submitted_at` when status is `submitted`, and
 * `approved_at` when status is `approved`. They do **not** require
 * `submitted_at` on an already-approved row. Hosted approve advances a
 * previously submitted session via UPDATE and therefore inherits the stamped
 * submit timestamp; it never needs to INSERT an approved row.
 *
 * On current main, any INSERT that reaches the table can still mint
 * `status = 'approved'` with `approved_at` / `approved_by` set and
 * `submitted_at` null — an approval claim that never carries submit-time
 * evidence. Client DML is revoked; service_role / direct INSERT paths still
 * reach the table.
 *
 * This tip fails closed on INSERT when status is already `approved` without a
 * non-null `submitted_at`. It does not restore a tighter table-level CHECK /
 * NOT NULL (that would couple every approve UPDATE path and invent submit
 * history for sessions that were never submitted), rewrite begin/submit/
 * approve/cancel writers, or require `submitted_at` when status is still
 * `in_progress`, `submitted`, or `cancelled`. Orthogonal to starter
 * attribution (#1295), terminal workflow actors (#1296), and inventory /
 * purchase-line actor tips.
 */

export type InventoryCountSessionApprovedSubmitStatus =
  | "in_progress"
  | "submitted"
  | "approved"
  | "cancelled";

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing submit-time evidence on an approved
 * count-session insert. Returns null when status is not approved, or when a
 * non-empty submitted_at value is present.
 */
export function validateInventoryCountSessionApprovedSubmitTimeEvidence(input: {
  status?: InventoryCountSessionApprovedSubmitStatus | string | null;
  submittedAt?: string | null;
}): string | null {
  if (input.status !== "approved") {
    return null;
  }
  if (!hasTimestamp(input.submittedAt)) {
    return "missing_submitted_at";
  }
  return null;
}
