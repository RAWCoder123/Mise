/**
 * Structural audit evidence for restaurant autonomy-rule creator attribution.
 *
 * `restaurant_autonomy_rules.created_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the rule's operational history (`ON DELETE SET NULL`). Hosted
 * `public.upsert_restaurant_autonomy_rule` stamps `auth.uid()` into
 * `created_by` on INSERT (and `updated_by` on INSERT / conflict UPDATE).
 *
 * On current main, any INSERT that reaches the table (including direct
 * service_role inserts that satisfy soft CHECKs and RLS bypass) can still
 * mint an autonomy rule with `created_by = null` — an unattributable
 * automation-authority record that audit browse / compliance analysis cannot
 * pin to an owner or admin.
 *
 * This tip fails closed on INSERT when `created_by` is absent. It does not
 * restore table-level NOT NULL / CHECK (that would block auth anonymization
 * UPDATEs), rewrite `upsert_restaurant_autonomy_rule`, or require
 * `updated_by` (conflict updates stamp that separately). Orthogonal to
 * autonomy locale / ASCII-C pins, audit-log actor tip (#1302), and mise-action
 * / memory / activity actor tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing creator attribution on insert.
 * Returns null when a non-empty created_by id is present.
 */
export function validateRestaurantAutonomyRuleCreatedByEvidence(input: {
  createdBy?: string | null;
}): string | null {
  if (!hasActor(input.createdBy)) {
    return "missing_created_by";
  }
  return null;
}
