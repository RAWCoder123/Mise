import {
  normalizeOperationalFindingDecisionInput,
  type OperationalFindingDecision,
  type OperationalFindingDecisionInput
} from "./operationalFindingDecisions";

export type FindingDecisionOutboxStatus =
  | "pending"
  | "submitting"
  | "accepted"
  | "conflict"
  | "rejected";

export interface FindingDecisionOutboxEntry {
  id: string;
  decision: OperationalFindingDecisionInput;
  status: FindingDecisionOutboxStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  authoritativeDecision: OperationalFindingDecision | null;
  resolutionReason: string | null;
}

export function createFindingDecisionOutboxEntry(input: {
  id: string;
  decision: OperationalFindingDecisionInput;
  now: string;
}): FindingDecisionOutboxEntry {
  assertTimestamp(input.now, "invalid_finding_decision_outbox_timestamp");
  if (!input.id.trim()) throw new Error("missing_finding_decision_outbox_id");
  const decision = cloneDecision(normalizeOperationalFindingDecisionInput(input.decision));
  if (new TextEncoder().encode(JSON.stringify(decision)).byteLength > 32_000) {
    throw new Error("finding_decision_outbox_payload_too_large");
  }
  return {
    id: input.id,
    decision,
    status: "pending",
    attemptCount: 0,
    createdAt: input.now,
    updatedAt: input.now,
    nextAttemptAt: input.now,
    authoritativeDecision: null,
    resolutionReason: null
  };
}

export function beginFindingDecisionSubmission(
  entry: FindingDecisionOutboxEntry,
  now: string
): FindingDecisionOutboxEntry {
  assertTimestamp(now, "invalid_finding_decision_submission_timestamp");
  if (entry.status !== "pending") throw new Error("finding_decision_outbox_not_pending");
  if (entry.nextAttemptAt && Date.parse(entry.nextAttemptAt) > Date.parse(now)) {
    throw new Error("finding_decision_retry_not_due");
  }
  return {
    ...entry,
    status: "submitting",
    attemptCount: entry.attemptCount + 1,
    updatedAt: now,
    nextAttemptAt: null
  };
}

export function deferFindingDecisionSubmission(
  entry: FindingDecisionOutboxEntry,
  now: string
): FindingDecisionOutboxEntry {
  assertTimestamp(now, "invalid_finding_decision_retry_timestamp");
  if (entry.status !== "submitting") throw new Error("finding_decision_outbox_not_submitting");
  return {
    ...entry,
    status: "pending",
    updatedAt: now,
    nextAttemptAt: new Date(
      Date.parse(now) + retryDelayMsForAttempt(entry.attemptCount)
    ).toISOString(),
    resolutionReason: "network_retry"
  };
}

export function recoverInterruptedFindingDecisionSubmission(
  entry: FindingDecisionOutboxEntry,
  now: string
): FindingDecisionOutboxEntry {
  assertTimestamp(now, "invalid_finding_decision_recovery_timestamp");
  if (entry.status !== "submitting") {
    throw new Error("finding_decision_outbox_not_submitting");
  }
  return {
    ...entry,
    status: "pending",
    updatedAt: now,
    nextAttemptAt: now,
    resolutionReason: "interrupted_retry"
  };
}

export function settleFindingDecisionSubmission(input: {
  entry: FindingDecisionOutboxEntry;
  decision: OperationalFindingDecision;
  now: string;
}): FindingDecisionOutboxEntry {
  assertTimestamp(input.now, "invalid_finding_decision_settlement_timestamp");
  if (input.entry.status !== "submitting") {
    throw new Error("finding_decision_outbox_not_submitting");
  }
  assertStableDecisionIdentity(input.entry.decision, input.decision);
  return {
    ...input.entry,
    status: "accepted",
    updatedAt: input.now,
    nextAttemptAt: null,
    authoritativeDecision: input.decision,
    resolutionReason: null
  };
}

export function failFindingDecisionSubmission(input: {
  entry: FindingDecisionOutboxEntry;
  status: "conflict" | "rejected";
  reason: string;
  now: string;
}): FindingDecisionOutboxEntry {
  assertTimestamp(input.now, "invalid_finding_decision_failure_timestamp");
  if (input.entry.status !== "submitting") {
    throw new Error("finding_decision_outbox_not_submitting");
  }
  return {
    ...input.entry,
    status: input.status,
    updatedAt: input.now,
    nextAttemptAt: null,
    resolutionReason: input.reason
  };
}

export function findingDecisionEntriesReadyAt(
  entries: readonly FindingDecisionOutboxEntry[],
  now: string
) {
  assertTimestamp(now, "invalid_finding_decision_outbox_clock");
  const clock = Date.parse(now);
  return entries
    .filter(
      (entry) =>
        entry.status === "pending" &&
        entry.nextAttemptAt !== null &&
        Date.parse(entry.nextAttemptAt) <= clock
    )
    .sort(
      (left, right) =>
        Date.parse(left.nextAttemptAt ?? left.createdAt) -
          Date.parse(right.nextAttemptAt ?? right.createdAt) ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id)
    );
}

function retryDelayMsForAttempt(attemptCount: number) {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error("invalid_finding_decision_attempt_count");
  }
  return Math.min(1_000 * 2 ** (attemptCount - 1), 5 * 60_000);
}

function cloneDecision(decision: OperationalFindingDecisionInput) {
  return JSON.parse(JSON.stringify(decision)) as OperationalFindingDecisionInput;
}

function assertStableDecisionIdentity(
  candidate: OperationalFindingDecisionInput,
  decision: OperationalFindingDecision
) {
  if (
    candidate.restaurantId !== decision.restaurantId ||
    candidate.finding.id !== decision.findingId ||
    candidate.finding.policyVersion !== decision.policyVersion ||
    candidate.decisionType !== decision.decisionType ||
    candidate.clientEventId !== decision.clientEventId ||
    candidate.idempotencyKey !== decision.idempotencyKey
  ) {
    throw new Error("authoritative_finding_decision_identity_mismatch");
  }
}

function assertTimestamp(value: string, reason: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(reason);
}
