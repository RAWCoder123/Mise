/**
 * Structural audit evidence for supplier-item verification time attribution.
 *
 * `supplier_items.verified_at` is nullable so draft / rejected / expired
 * inserts legitimately leave it null until a later verification UPDATE
 * stamps the timestamp. Account-deletion anonymization clears only
 * `verified_by` (`ON DELETE SET NULL`) and preserves `verified_at`, so
 * verification history remains time-attributable after the operator identity
 * is removed.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * verified supplier-item claim (`verification_status = 'verified'`) with
 * `verified_at` null — a verification that Activity / audit analysis cannot
 * place in time. Client DML is revoked, but service_role / direct INSERT
 * paths still reach the table.
 *
 * This tip fails closed on INSERT when verification status is already
 * `verified` without a non-null `verified_at`. It does not restore
 * table-level NOT NULL / status-implies-timestamp CHECK (that would force a
 * CHECK on every verification UPDATE path and couple to the companion
 * verified_by actor tip), rewrite any verify writer, or require a timestamp
 * when status is still draft/rejected/expired. Companion to supplier-item
 * verified_by (#1313); orthogonal to ingredient-substitution verified_at
 * (#1312) and recipe-version verified_at (#1311).
 */

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing verification-time attribution on insert.
 * Returns null when status is not verified, or when a non-empty verified_at
 * value is present. Matches the SQL tip predicate keyed on verification_status.
 */
export function validateSupplierItemVerifiedAtEvidence(input: {
  verificationStatus?: string | null;
  verifiedAt?: string | null;
}): string | null {
  if (input.verificationStatus !== "verified") {
    return null;
  }
  if (!hasTimestamp(input.verifiedAt)) {
    return "missing_verified_at";
  }
  return null;
}
