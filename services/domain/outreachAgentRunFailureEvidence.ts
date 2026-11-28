/**
 * Structural audit evidence for outreach agent run failure attribution.
 *
 * `public.outreach_agent_runs.error_summary` is nullable because running and
 * completed rows legitimately leave it null (completed runs only stamp a
 * summary when the agent collected non-fatal errors). Hosted failure
 * transitions already stamp a bounded reason into `error_summary` when
 * UPDATEing an open run to `failed`.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * `failed` run with `error_summary` null or blank — a terminal non-success
 * run that audit analysis cannot explain. Authenticated client DML is already
 * revoked; service_role retains INSERT and can still mint unexplained
 * failures directly. The agent writer INSERTs `status = 'running'` with
 * `error_summary` null, then stamps evidence on UPDATE.
 *
 * This tip fails closed on INSERT when status claims `failed` without a
 * non-empty `error_summary`. It does not restore a table-level NOT NULL /
 * status-implies-error CHECK (that would block legitimate running /
 * completed rows), rewrite the outreach-agent writer, or require failure
 * evidence when status is still running or already completed. Orthogonal to
 * tip stacks #1263–#1326, the error_summary cntrl locale pin, and
 * mise_actions failure evidence (#1305). Sibling of outreach message failure
 * evidence (#1326).
 */

export type OutreachAgentRunStatus = "running" | "completed" | "failed";

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing failure evidence on an outreach agent
 * run insert. Returns null when status is not failed, or when a non-empty
 * error_summary is present for failed status.
 */
export function validateOutreachAgentRunFailureEvidence(input: {
  status?: OutreachAgentRunStatus | string | null;
  errorSummary?: string | null;
}): string | null {
  if (input.status !== "failed") {
    return null;
  }
  if (!hasText(input.errorSummary)) {
    return "missing_error_summary";
  }
  return null;
}
