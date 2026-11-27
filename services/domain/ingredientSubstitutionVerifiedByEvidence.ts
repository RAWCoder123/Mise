/**
 * Structural audit evidence for ingredient-substitution verifier attribution.
 *
 * `ingredient_substitutions.verified_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the substitution's operational history (`ON DELETE SET NULL`).
 *
 * Writers normally INSERT draft substitutions and only later UPDATE into
 * `verification_status = 'verified'` with a stamped actor (open manager-
 * authority CRUD #1099), so those pre-verification inserts legitimately leave
 * `verified_by` null.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * verified substitution claim (`verification_status = 'verified'`) with
 * `verified_by` null — an unattributable verification that Activity / audit
 * analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when verification status is already
 * `verified` without a non-null `verified_by`. It does not restore
 * table-level NOT NULL / status-implies-actor CHECK (that would block auth
 * anonymization UPDATEs), rewrite the verify writer, or require an actor when
 * status is still draft/rejected/expired. Orthogonal to supplier-delivery
 * verified_by (#1297), recipe confirmation actor (#1307), and restaurant-
 * memory decision evidence (#1299/#1308).
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing verifier attribution on insert.
 * Returns null when status is not verified, or when a non-empty verifier id
 * is present. Matches the SQL tip predicate keyed on verification_status.
 */
export function validateIngredientSubstitutionVerifiedByEvidence(input: {
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
