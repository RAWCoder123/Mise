/**
 * Structural audit evidence for outreach message send-time attribution.
 *
 * `public.outreach_messages.sent_at` is nullable because draft / approved /
 * sending / failed / send_unknown rows legitimately leave it null until a
 * later send UPDATE stamps the timestamp. Hosted send transitions already
 * stamp `sent_at` when UPDATEing into `sent`.
 *
 * Soft table constraints only require `approved_at` when `status = 'approved'`.
 * On current main, any INSERT that reaches the table can still mint a
 * `sent` or `delivered` message with `sent_at` null — a terminal send claim
 * that audit analysis cannot place in time. Authenticated client DML is
 * already revoked; service_role retains INSERT and can still mint untimed
 * send claims directly. Draft writers INSERT `status = 'draft'` /
 * `'approved'` with `sent_at` null, then stamp evidence on UPDATE.
 *
 * This tip fails closed on INSERT when status claims `sent` or `delivered`
 * without a non-null `sent_at`. It does not restore a table-level NOT NULL /
 * status-implies-timestamp CHECK (that would block legitimate draft /
 * failure rows), rewrite outreach writers, or require send time when status
 * is still draft / approved / sending or already failed / send_unknown.
 * Orthogonal to tip stacks #1263–#1327 and mise_actions failure evidence
 * (#1305). Sibling of outreach message failure evidence (#1326) and
 * supplier-order sent_at evidence (#1319).
 */

export type OutreachMessageSentAtStatus =
  | "draft"
  | "approved"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "send_unknown"
  | "bounced"
  | "complained"
  | "suppressed"
  | "cancelled";

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function requiresSendTime(status: string | null | undefined): boolean {
  return status === "sent" || status === "delivered";
}

/**
 * Domain rejection reason for missing send-time attribution on an outreach
 * message insert. Returns null when status is not sent/delivered, or when a
 * non-empty sent_at value is present for those statuses.
 */
export function validateOutreachMessageSentAtEvidence(input: {
  status?: OutreachMessageSentAtStatus | string | null;
  sentAt?: string | null;
}): string | null {
  if (!requiresSendTime(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.sentAt)) {
    return "missing_sent_at";
  }
  return null;
}
