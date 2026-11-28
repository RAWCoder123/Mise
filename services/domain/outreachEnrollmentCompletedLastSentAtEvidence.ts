/**
 * Structural audit evidence for completed outreach enrollment send-time
 * attribution.
 *
 * `public.outreach_enrollments.last_sent_at` is nullable because queued /
 * awaiting_review / ready / processing / suppressed / attention_required rows
 * legitimately leave it null until a later send UPDATE stamps the timestamp.
 * Soft table constraints do not require `last_sent_at` when `status` claims
 * `completed`. Tip #1333 closes the contacted INSERT gap only; completed
 * inserts remain unconstrained on current main and on that tip.
 *
 * Hosted send transitions already stamp `last_sent_at` when UPDATEing into
 * `completed` after the final follow-up. On current main, any INSERT that
 * reaches the table can still mint `status = 'completed'` with
 * `last_sent_at` null — a "completed" enrollment that audit analysis cannot
 * place in send time. Authenticated client DML is already revoked;
 * service_role retains INSERT and can still mint untimed completed claims
 * directly. Enrollment writers INSERT `status = 'queued'` with
 * `last_sent_at` null, then stamp evidence on the send UPDATE.
 *
 * This tip fails closed on INSERT when status claims `completed` without a
 * non-null `last_sent_at`. It does not restore a table-level NOT NULL /
 * status-implies-timestamp CHECK (that would expand beyond this INSERT-only
 * tip boundary), rewrite outreach-agent writers, or require send time when
 * status is still queued / ready / processing / contacted / replied /
 * suppressed. Orthogonal to tip stacks #1263–#1333, including outreach
 * enrollment contacted last_sent_at (#1333). Soft contested merge: none
 * expected — completed INSERT fixtures are rare; create writers stay
 * queued-only. #1333's pgTAP deliberately asserts completed-without-
 * last_sent_at remains allowed under that tip; this tip closes that gap
 * without widening #1333.
 */

export type OutreachEnrollmentCompletedLastSentAtStatus =
  | "queued"
  | "awaiting_review"
  | "ready"
  | "processing"
  | "contacted"
  | "replied"
  | "interested"
  | "not_interested"
  | "completed"
  | "suppressed"
  | "attention_required";

function hasTimestamp(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  return typeof value === "string" && Boolean(value.trim());
}

function requiresLastSentAt(status: string | null | undefined): boolean {
  return status === "completed";
}

/**
 * Domain rejection reason for missing send-time attribution on a completed
 * outreach enrollment insert. Returns null when status is not completed, or
 * when a non-empty last_sent_at value is present for completed status.
 */
export function validateOutreachEnrollmentCompletedLastSentAtEvidence(input: {
  status?: OutreachEnrollmentCompletedLastSentAtStatus | string | null;
  lastSentAt?: string | Date | null;
}): string | null {
  if (!requiresLastSentAt(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.lastSentAt)) {
    return "missing_last_sent_at";
  }
  return null;
}
