import {
  beginFindingDecisionSubmission,
  createFindingDecisionOutboxEntry,
  deferFindingDecisionSubmission,
  failFindingDecisionSubmission,
  findingDecisionEntriesReadyAt,
  recoverInterruptedFindingDecisionSubmission,
  settleFindingDecisionSubmission,
  type FindingDecisionOutboxEntry
} from "../domain/findingDecisionOutbox";
import type {
  OperationalFindingDecision,
  OperationalFindingDecisionInput
} from "../domain/operationalFindingDecisions";
import { createId } from "../domain/miseDomain";
import { isTenantAuthorizationError } from "../tenantAuthorizationEvents";
import { deviceFindingDecisionOutboxRepository } from "../repositories/deviceFindingDecisionOutboxRepository";
import type { FindingDecisionOutboxRepository } from "../repositories/findingDecisionOutboxRepository";

let activeOutboxRepository: FindingDecisionOutboxRepository =
  deviceFindingDecisionOutboxRepository;
let activeSubmitter = async (decision: OperationalFindingDecisionInput) => {
  const { getMiseRepository } = await import("./repository");
  return getMiseRepository().recordOperationalFindingDecision(decision);
};
let flushQueue: Promise<unknown> = Promise.resolve();

export async function queueOperationalFindingDecision(input: {
  finding: OperationalFindingDecisionInput["finding"];
  decisionType: OperationalFindingDecisionInput["decisionType"];
  editedRecommendedAction?: string | null;
  now?: string;
}) {
  const clientEventId = createId("finding_decision");
  const entry = createFindingDecisionOutboxEntry({
    id: createId("finding_decision_outbox"),
    now: input.now ?? new Date().toISOString(),
    decision: {
      restaurantId: input.finding.restaurantId,
      finding: input.finding,
      decisionType: input.decisionType,
      editedRecommendedAction: input.editedRecommendedAction,
      clientEventId,
      idempotencyKey: `finding-decision:${clientEventId}`
    }
  });
  await activeOutboxRepository.save(entry);
  return entry;
}

export function fetchQueuedOperationalFindingDecisions(restaurantId: string) {
  return activeOutboxRepository.list(restaurantId);
}

export function flushQueuedOperationalFindingDecisions(restaurantId: string) {
  const pending = flushQueue.then(
    () => flushOperationalFindingDecisionEntries(restaurantId),
    () => flushOperationalFindingDecisionEntries(restaurantId)
  );
  flushQueue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

async function flushOperationalFindingDecisionEntries(restaurantId: string) {
  const entries = await activeOutboxRepository.list(restaurantId);
  const recovered: FindingDecisionOutboxEntry[] = [];
  for (const entry of entries) {
    if (entry.status !== "submitting") {
      recovered.push(entry);
      continue;
    }
    const pending = recoverInterruptedFindingDecisionSubmission(
      entry,
      new Date().toISOString()
    );
    await activeOutboxRepository.save(pending);
    recovered.push(pending);
  }
  const ready = findingDecisionEntriesReadyAt(recovered, new Date().toISOString());
  const summary = {
    considered: ready.length,
    accepted: 0,
    conflicted: 0,
    rejected: 0,
    deferred: 0
  };
  for (const entry of ready) {
    const submitting = beginFindingDecisionSubmission(entry, new Date().toISOString());
    await activeOutboxRepository.save(submitting);
    try {
      const authoritative = await activeSubmitter(submitting.decision);
      await activeOutboxRepository.save(
        settleFindingDecisionSubmission({
          entry: submitting,
          decision: authoritative,
          now: new Date().toISOString()
        })
      );
      summary.accepted += 1;
    } catch (error) {
      const classification = classifySubmissionError(error);
      if (classification.status === "pending") {
        await activeOutboxRepository.save(
          deferFindingDecisionSubmission(submitting, new Date().toISOString())
        );
        summary.deferred += 1;
      } else {
        await activeOutboxRepository.save(
          failFindingDecisionSubmission({
            entry: submitting,
            status: classification.status,
            reason: classification.reason,
            now: new Date().toISOString()
          })
        );
        if (classification.status === "conflict") summary.conflicted += 1;
        if (classification.status === "rejected") summary.rejected += 1;
      }
    }
  }
  return summary;
}

function classifySubmissionError(error: unknown):
  | { status: "pending"; reason: "network_retry" }
  | { status: "conflict" | "rejected"; reason: string } {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";
  if (/idempotency.*conflict|payload.*mismatch/i.test(message)) {
    return { status: "conflict", reason: "idempotency_payload_mismatch" };
  }
  if (isTenantAuthorizationError(error)) {
    return { status: "rejected", reason: "permission_denied" };
  }
  return { status: "pending", reason: "network_retry" };
}

/** Test-only seam for deterministic device persistence. */
export function setFindingDecisionOutboxRepositoryForTesting(
  repository: FindingDecisionOutboxRepository
) {
  const previous = activeOutboxRepository;
  activeOutboxRepository = repository;
  return () => {
    activeOutboxRepository = previous;
  };
}

/** Test-only seam that avoids booting the Expo repository runtime. */
export function setFindingDecisionSubmitterForTesting(
  submitter: (decision: OperationalFindingDecisionInput) => Promise<OperationalFindingDecision>
) {
  const previous = activeSubmitter;
  activeSubmitter = submitter;
  return () => {
    activeSubmitter = previous;
  };
}

export type { FindingDecisionOutboxEntry };
