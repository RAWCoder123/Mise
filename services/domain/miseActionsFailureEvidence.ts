/**
 * Structural audit evidence for Mise-action failure attribution.
 *
 * `mise_actions.error_code` and `error_message` are nullable because
 * non-failure statuses (`prepared`, `waiting_for_approval`, `approved`,
 * `executed`, …) legitimately leave them null. Hosted
 * `private.service_record_mise_action_failure` already rejects failure
 * recording without a slug `error_code` and a non-empty `error_message`
 * when advancing an action to `failed` or `unverified` via UPDATE.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * `failed` or `unverified` action with both fields null — a terminal
 * failure claim that Activity / audit analysis cannot explain. Writers
 * normally INSERT pre-execution statuses and only later UPDATE into a
 * failure status with stamped evidence, so those pre-failure inserts
 * legitimately leave the error fields null.
 *
 * This tip fails closed on INSERT when status claims `failed` or
 * `unverified` without non-empty `error_code` and `error_message`. It does
 * not restore table-level NOT NULL / CHECK (that would block legitimate
 * non-failure rows), rewrite `service_record_mise_action_failure` /
 * `decide_mise_action`, or require failure evidence when status is still
 * pre-failure or executed. Orthogonal to mise_actions executed_at tip
 * (#1304), decision-actor tip (#1298), locale / ASCII-C pins, and actor
 * tips #1280–#1303.
 */

export type MiseActionFailureStatus =
  | "prepared"
  | "waiting_for_approval"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled"
  | "reversed"
  | "unverified";

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function isFailureStatus(
  status: MiseActionFailureStatus | string | null | undefined
): boolean {
  return status === "failed" || status === "unverified";
}

/**
 * Domain rejection reason for missing failure evidence on insert.
 * Returns null when the status does not require failure evidence, or when
 * both a non-empty error_code and error_message are present.
 */
export function validateMiseActionsFailureEvidence(input: {
  status: MiseActionFailureStatus | string | null | undefined;
  errorCode?: string | null;
  errorMessage?: string | null;
}): string | null {
  if (!isFailureStatus(input.status)) {
    return null;
  }
  if (!hasText(input.errorCode)) {
    return "missing_error_code";
  }
  if (!hasText(input.errorMessage)) {
    return "missing_error_message";
  }
  return null;
}
