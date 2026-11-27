/**
 * Structural audit evidence for purchase-order submission-time attribution.
 *
 * `purchase_orders.submitted_at` is nullable so draft and cancelled rows
 * legitimately leave it null until a later submit / receive UPDATE stamps the
 * timestamp. There is intentionally no table-level NOT NULL /
 * status-implies-timestamp CHECK, because drafts are the normal INSERT shape
 * and account/history flows must not rewrite submission time.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * terminal claim (`status = 'submitted'` or `status = 'received'`) with
 * `submitted_at` null — a purchase order Activity / audit analysis cannot
 * place in time. Client DML is revoked, but service_role / direct INSERT
 * paths still reach the table.
 *
 * This tip fails closed on INSERT when status is already `submitted` or
 * `received` without a non-null `submitted_at`. It does not restore
 * table-level NOT NULL / status-implies-timestamp CHECK (that would couple
 * every submit UPDATE path and block draft inserts), rewrite any purchase
 * writer, or require a timestamp when status is still draft/cancelled.
 * Orthogonal to purchase-orders locale / supplier-name pins and inventory
 * count-session submitted_at CHECKs.
 */

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function requiresSubmissionTime(status: string | null | undefined): boolean {
  return status === "submitted" || status === "received";
}

/**
 * Domain rejection reason for missing submission-time attribution on insert.
 * Returns null when status is not submitted/received, or when a non-empty
 * submitted_at value is present. Matches the SQL tip predicate keyed on status.
 */
export function validatePurchaseOrderSubmittedAtEvidence(input: {
  status?: string | null;
  submittedAt?: string | null;
}): string | null {
  if (!requiresSubmissionTime(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.submittedAt)) {
    return "missing_submitted_at";
  }
  return null;
}
