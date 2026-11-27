/**
 * Structural audit evidence for supplier-item verifier attribution.
 *
 * `supplier_items.verified_by` is nullable so account-deletion anonymization
 * can clear only the deleted operator's auth identity while preserving the
 * supplier item's operational history (`ON DELETE SET NULL`).
 *
 * Writers may INSERT draft supplier items and only later UPDATE into
 * `verification_status = 'verified'` with a stamped actor, so those
 * pre-verification inserts legitimately leave `verified_by` null. Rejected
 * and expired rows also leave the actor null when verification never
 * happened or was withdrawn.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * verified supplier-item claim (`verification_status = 'verified'`) with
 * `verified_by` null — an unattributable verification that Activity / audit
 * analysis cannot pin to an operator. Client DML is revoked, but
 * service_role / direct INSERT paths still reach the table.
 *
 * This tip fails closed on INSERT when verification status is already
 * `verified` without a non-null `verified_by`. It does not restore
 * table-level NOT NULL / status-implies-actor CHECK (that would block auth
 * anonymization UPDATEs), rewrite any verify writer, or require an actor when
 * status is still draft/rejected/expired. Orthogonal to ingredient-
 * substitution verified_by (#1309), recipe-version verified_by (#1310), and
 * supplier-delivery verified_by (#1297). Companion verified_at tip remains
 * separate.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing verifier attribution on insert.
 * Returns null when status is not verified, or when a non-empty verifier id
 * is present. Matches the SQL tip predicate keyed on verification_status.
 */
export function validateSupplierItemVerifiedByEvidence(input: {
  verificationStatus?: string | null;
  verifiedBy?: string | null;
}): string | null {
  if (input.verificationStatus !== "verified") {
    return null;
  }
  if (!hasActor(input.verifiedBy)) {
    return "missing_verified_by";
  }
  return null;
}
