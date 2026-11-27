/**
 * Structural audit evidence for recipe-version verifier attribution.
 *
 * `recipe_versions.verified_by` is nullable so account-deletion anonymization
 * can clear only the deleted operator's auth identity while preserving the
 * recipe version's operational history (`ON DELETE SET NULL`).
 *
 * Writers may INSERT draft recipe versions and only later UPDATE into
 * `status = 'verified'` with a stamped actor, so those pre-verification
 * inserts legitimately leave `verified_by` null. Retired rows also leave the
 * actor null when verification never happened.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * verified recipe-version claim (`status = 'verified'`) with `verified_by`
 * null — an unattributable verification that Activity / audit analysis cannot
 * pin to an operator.
 *
 * This tip fails closed on INSERT when status is already `verified` without a
 * non-null `verified_by`. It does not restore table-level NOT NULL /
 * status-implies-actor CHECK (that would block auth anonymization UPDATEs),
 * rewrite any verify writer, or require an actor when status is still draft or
 * retired. Orthogonal to ingredient-substitution verified_by (#1309),
 * supplier-delivery verified_by (#1297), and recipe confirmation actor
 * (#1307).
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing verifier attribution on insert.
 * Returns null when status is not verified, or when a non-empty verifier id
 * is present. Matches the SQL tip predicate keyed on status.
 */
export function validateRecipeVersionVerifiedByEvidence(input: {
  status?: string | null;
  verifiedBy?: string | null;
}): string | null {
  if (input.status !== "verified") {
    return null;
  }
  if (!hasActor(input.verifiedBy)) {
    return "missing_verified_by";
  }
  return null;
}
