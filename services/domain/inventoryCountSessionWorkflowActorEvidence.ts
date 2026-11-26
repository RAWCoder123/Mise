/**
 * Structural audit evidence for inventory count-session workflow actors.
 *
 * `inventory_count_sessions.submitted_by` / `approved_by` / `cancelled_by`
 * are nullable so account-deletion anonymization can clear only the deleted
 * operator's auth identity while preserving the session's operational history
 * (`ON DELETE SET NULL`). Soft CHECKs already require the matching `*_at`
 * timestamp when status is submitted / approved / cancelled, but they do not
 * require the matching actor column.
 *
 * Hosted submit / approve / cancel RPCs stamp `p_actor_user_id` via UPDATE.
 * On current main, any INSERT that reaches the table can still mint a
 * terminal-status count session with a matching timestamp and a null workflow
 * actor — an unattributable submit / approve / cancel that Activity / audit
 * analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when status claims a workflow step without
 * the matching actor. It does not restore table-level NOT NULL / CHECK (that
 * would block auth anonymization UPDATEs), rewrite begin/submit/approve/
 * cancel writers, or require workflow actors when status is `in_progress`
 * (those fields are legitimately null until later workflow steps). Orthogonal
 * to starter attribution (#1295), inventory actor attribution (#1280),
 * count-session provenance on ledger rows (#393), and approve_count_session
 * source authority (#1262).
 */

export type InventoryCountSessionWorkflowStatus =
  | "in_progress"
  | "submitted"
  | "approved"
  | "cancelled";

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing workflow-actor attribution on insert.
 * Returns null when the status does not require a workflow actor, or when the
 * matching actor id is present.
 */
export function validateInventoryCountSessionWorkflowActorEvidence(input: {
  status: InventoryCountSessionWorkflowStatus | string | null | undefined;
  submittedBy?: string | null;
  approvedBy?: string | null;
  cancelledBy?: string | null;
}): string | null {
  if (input.status === "submitted" && !hasActor(input.submittedBy)) {
    return "missing_submitted_by";
  }
  if (input.status === "approved" && !hasActor(input.approvedBy)) {
    return "missing_approved_by";
  }
  if (input.status === "cancelled" && !hasActor(input.cancelledBy)) {
    return "missing_cancelled_by";
  }
  return null;
}
