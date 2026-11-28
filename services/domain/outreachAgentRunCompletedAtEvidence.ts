/**
 * Structural audit evidence for outreach agent run completion-time
 * attribution.
 *
 * `public.outreach_agent_runs.completed_at` is nullable because running rows
 * legitimately leave it null until a later complete / fail UPDATE stamps the
 * timestamp. Soft table constraints do not require `completed_at` when status
 * is `completed` or `failed`. Hosted completion and failure transitions
 * already stamp `completed_at` when UPDATEing an open run.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * terminal run (`status = 'completed'` or `status = 'failed'`) with
 * `completed_at` null — a finished run that audit analysis cannot place in
 * time. Authenticated client DML is already revoked; service_role retains
 * INSERT and can still mint untimed terminal runs directly. The agent writer
 * INSERTs `status = 'running'` with `completed_at` null, then stamps
 * completion time on UPDATE.
 *
 * This tip fails closed on INSERT when status claims `completed` or `failed`
 * without a non-null `completed_at`. It does not restore a table-level NOT
 * NULL / status-implies-timestamp CHECK (that would block legitimate running
 * rows), rewrite the outreach-agent writer, or require a completion timestamp
 * when status is still running. Orthogonal to tip stacks #1263–#1328,
 * including the sibling outreach_agent_runs failure-evidence tip (#1327) and
 * mise_actions executed_at evidence (#1304). Sibling of supplier-order
 * sent_at evidence (#1319) and outreach-message sent_at evidence (#1328).
 */

export type OutreachAgentRunStatus = "running" | "completed" | "failed";

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function requiresCompletedAt(status: string | null | undefined): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Domain rejection reason for missing completion-time evidence on an outreach
 * agent run insert. Returns null when status is not completed/failed, or when
 * a non-empty completed_at value is present for terminal status.
 */
export function validateOutreachAgentRunCompletedAtEvidence(input: {
  status?: OutreachAgentRunStatus | string | null;
  completedAt?: string | null;
}): string | null {
  if (!requiresCompletedAt(input.status)) {
    return null;
  }
  if (!hasTimestamp(input.completedAt)) {
    return "missing_completed_at";
  }
  return null;
}
