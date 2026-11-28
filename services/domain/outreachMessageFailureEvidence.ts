/**
 * Structural audit evidence for outreach message failure attribution.
 *
 * `public.outreach_messages.last_error` is nullable because draft / approved /
 * sending / sent / delivered rows legitimately leave it null. Hosted fail and
 * send_unknown transitions already stamp a bounded reason into `last_error`
 * when UPDATEing out of an in-flight send.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * `failed` or `send_unknown` message with `last_error` null or blank — a
 * terminal non-success send that audit analysis cannot explain. Authenticated
 * client DML is already revoked; service_role retains INSERT and can still
 * mint unexplained failures directly.
 *
 * This tip fails closed on INSERT when status claims `failed` or
 * `send_unknown` without a non-empty `last_error`. It does not restore a
 * table-level NOT NULL / status-implies-error CHECK (that would block
 * legitimate draft / sent rows), rewrite outreach writers, or require failure
 * evidence when status is still draft / approved / sending or already sent /
 * delivered. Orthogonal to tip stacks #1263–#1325 and mise_actions failure
 * evidence (#1305). Sibling of supplier-email delivery failure evidence
 * (#1323).
 */

export type OutreachMessageFailureStatus =
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

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing failure evidence on an outreach
 * message insert. Returns null when status is not failed/send_unknown, or
 * when a non-empty last_error is present for those statuses.
 */
export function validateOutreachMessageFailureEvidence(input: {
  status?: OutreachMessageFailureStatus | string | null;
  lastError?: string | null;
}): string | null {
  if (input.status !== "failed" && input.status !== "send_unknown") {
    return null;
  }
  if (!hasText(input.lastError)) {
    return "missing_last_error";
  }
  return null;
}
