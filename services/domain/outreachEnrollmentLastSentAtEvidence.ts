/**
 * Structural audit evidence for outreach enrollment send-time attribution.
 *
 * `public.outreach_enrollments.last_sent_at` is nullable because queued /
 * awaiting_review / ready / processing / suppressed / attention_required rows
 * legitimately leave it null until a later send UPDATE stamps the timestamp.
 * Soft table constraints do not require `last_sent_at` when `status` claims
 * `contacted`.
 *
 * Hosted send transitions already stamp `last_sent_at` when UPDATEing into
 * `contacted` (or `completed` after the final follow-up). On current main, any
 * INSERT that reaches the table can still mint `status = 'contacted'` with
 * `last_sent_at` null — a "contacted" enrollment that audit analysis cannot
 * place in send time. Authenticated client DML is already revoked;
 * service_role retains INSERT and can still mint untimed contacted claims
 * directly. Enrollment writers INSERT `status = 'queued'` with
 * `last_sent_at` null, then stamp evidence on the send UPDATE.
 *
 * This tip fails closed on INSERT when status claims `contacted` without a
 * non-null `last_sent_at`. It does not restore a table-level NOT NULL /
 * status-implies-timestamp CHECK (that would expand beyond this INSERT-only
 * tip boundary), rewrite outreach-agent writers, or require send time when
 * status is still queued / ready / processing or already completed /
 * replied / suppressed. Orthogonal to tip stacks #1263–#1332, including
 * outreach message sent_at (#1328), outreach agent run completed_at (#1329),
 * and outreach campaign activated_at (#1332). Soft contested merge: none
 * expected — contacted INSERT fixtures are rare; create writers stay
 * queued-only.
 */

export type OutreachEnrollmentLastSentAtStatus =
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
  return status === "contacted";
}

/**
 * Domain rejection reason for missing send-time attribution on an outreach
 * enrollment insert. Returns null when status is not contacted, or when a
 * non-empty last_sent_at value is present for contacted status.
 */
export function validateOutreachEnrollmentLastSentAtEvidence(input: {
  status?: OutreachEnrollmentLastSentAtStatus | string | null;
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
