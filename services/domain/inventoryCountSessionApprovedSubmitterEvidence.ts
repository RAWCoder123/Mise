/**
 * Structural audit evidence for approved inventory count-session submitter.
 *
 * Soft CHECKs already require `submitted_at` when status is `submitted`, and
 * `approved_at` when status is `approved`. They do **not** require
 * `submitted_by` on an already-approved row. Hosted approve advances a
 * previously submitted session via UPDATE and therefore inherits the stamped
 * submitter; it never needs to INSERT an approved row.
 *
 * On current main, any INSERT that reaches the table can still mint
 * `status = 'approved'` with `approved_at` / `approved_by` set and
 * `submitted_by` null — an approval claim that never carries submitter
 * evidence. Client DML is revoked; service_role / direct INSERT paths still
 * reach the table.
 *
 * This tip fails closed on INSERT when status is already `approved` without a
 * non-null `submitted_by`. It does not restore a tighter table-level CHECK /
 * NOT NULL (that would couple every approve UPDATE path, invent submitter
 * history for sessions that were never submitted, and block account-deletion
 * anonymization `ON DELETE SET NULL`), rewrite begin/submit/approve/cancel
 * writers, or require `submitted_by` when status is still `in_progress`,
 * `submitted`, or `cancelled`. Orthogonal to starter attribution (#1295),
 * terminal workflow actors (#1296, which requires `approved_by` for approved
 * but not `submitted_by`), and approved submit-time evidence (#1320).
 */

export type InventoryCountSessionApprovedSubmitterStatus =
  | "in_progress"
  | "submitted"
  | "approved"
  | "cancelled";

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing submitter evidence on an approved
 * count-session insert. Returns null when status is not approved, or when a
 * non-empty submitted_by value is present.
 */
export function validateInventoryCountSessionApprovedSubmitterEvidence(input: {
  status?: InventoryCountSessionApprovedSubmitterStatus | string | null;
  submittedBy?: string | null;
}): string | null {
  if (input.status !== "approved") {
    return null;
  }
  if (!hasActor(input.submittedBy)) {
    return "missing_submitted_by";
  }
  return null;
}
