/**
 * Structural audit evidence for activity-event resolution actor attribution.
 *
 * `activity_events.resolved_by` is nullable so account-deletion anonymization
 * can clear only the deleted operator's auth identity while preserving the
 * activity's operational history (`ON DELETE SET NULL` + the append-only
 * UPDATE escape in `private.reject_immutable_operational_record_mutation`).
 * The table CHECK intentionally allows `resolved_at` without `resolved_by`
 * after that anonymization escape.
 *
 * Hosted `private.append_activity_event` never writes resolution fields — it
 * always inserts unresolved rows. On current main, any INSERT that reaches
 * the table (including direct service_role inserts that satisfy the soft
 * resolution CHECK) can still mint a resolved activity with
 * `resolved_at` set and `resolved_by` null — an unattributable resolution
 * that Activity / audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `resolved_at` is present without a
 * non-null `resolved_by`. It does not restore a tighter table-level CHECK /
 * NOT NULL (that would block auth anonymization UPDATEs), rewrite
 * append_activity_event, or require a resolver when the event is still
 * unresolved. Orthogonal to activity locale / ASCII-C pins and inventory /
 * purchase-line / mise-action actor tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing resolution-actor attribution on insert.
 * Returns null when the event is unresolved, or when a non-empty resolved_by
 * id accompanies a resolved_at timestamp.
 */
export function validateActivityResolutionActorEvidence(input: {
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}): string | null {
  if (hasTimestamp(input.resolvedAt) && !hasActor(input.resolvedBy)) {
    return "missing_resolved_by";
  }
  return null;
}
