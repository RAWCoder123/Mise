/**
 * Structural audit evidence for restaurant autonomy-rule updater attribution.
 *
 * `restaurant_autonomy_rules.updated_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the rule's operational history (`ON DELETE SET NULL`). Hosted
 * `public.upsert_restaurant_autonomy_rule` stamps `auth.uid()` into
 * `updated_by` on INSERT (and on every subsequent UPDATE conflict path).
 *
 * On current main, any INSERT that reaches the table (including direct
 * service_role inserts that satisfy soft CHECKs and RLS bypass) can still
 * mint an autonomy rule with `updated_by = null` — an unattributable
 * last-touch record that audit browse / compliance analysis cannot pin to an
 * owner or admin. The sibling created_by tip (#1303) closes creator
 * attribution; this tip closes updater attribution on INSERT.
 *
 * This tip fails closed on INSERT when `updated_by` is absent. It does not
 * restore table-level NOT NULL / CHECK (that would block auth anonymization
 * UPDATEs), rewrite `upsert_restaurant_autonomy_rule`, or require creator
 * fields beyond the existing soft CHECKs. Orthogonal to autonomy-rule
 * created_by tip (#1303), autonomy locale / ASCII-C pins, and audit-log /
 * activity / inventory actor tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing updater attribution on insert.
 * Returns null when a non-empty updated_by id is present.
 */
export function validateRestaurantAutonomyRuleUpdatedByEvidence(input: {
  updatedBy?: string | null;
}): string | null {
  if (!hasActor(input.updatedBy)) {
    return "missing_updated_by";
  }
  return null;
}
