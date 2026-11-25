import {
  beginInventoryOutboxSubmission,
  deferInventoryOutboxSubmission,
  inventoryOutboxEntriesReadyAt,
  settleInventoryOutboxSubmission,
  type InventoryOutboxEntry
} from "../domain/inventoryOutbox";
import type { InventoryEventAcceptance } from "../domain/inventoryLedger";
import type { InventoryOutboxRepository } from "../repositories/inventoryOutboxRepository";
import { isTenantAuthorizationError } from "../tenantAuthorizationEvents";

function inventorySubmissionFailureFromError(
  error: unknown
): InventoryEventAcceptance | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";

  if (/idempotency.*conflict|payload.*mismatch/i.test(message)) {
    return {
      status: "conflict",
      reason: "idempotency_payload_mismatch",
      existingEvent: null
    };
  }
  if (isTenantAuthorizationError(error)) {
    return { status: "rejected", reason: "permission_denied" };
  }
  return null;
}

export interface InventoryOutboxFlushSummary {
  considered: number;
  accepted: number;
  conflicted: number;
  rejected: number;
  deferred: number;
}

export async function flushInventoryOutbox(input: {
  restaurantId: string;
  repository: InventoryOutboxRepository;
  submit: (entry: InventoryOutboxEntry) => Promise<InventoryEventAcceptance>;
  now: () => string;
}): Promise<InventoryOutboxFlushSummary> {
  const entries = await input.repository.list(input.restaurantId);
  const ready = inventoryOutboxEntriesReadyAt(entries, input.now());
  const summary: InventoryOutboxFlushSummary = {
    considered: ready.length,
    accepted: 0,
    conflicted: 0,
    rejected: 0,
    deferred: 0
  };

  for (const entry of ready) {
    const submitting = beginInventoryOutboxSubmission(entry, input.now());
    await input.repository.save(submitting);
    let acceptance: InventoryEventAcceptance;
    try {
      acceptance = await input.submit(submitting);
    } catch (error) {
      const terminal = inventorySubmissionFailureFromError(error);
      if (terminal) {
        acceptance = terminal;
      } else {
        const deferred = deferInventoryOutboxSubmission({
          entry: submitting,
          now: input.now()
        });
        await input.repository.save(deferred);
        summary.deferred += 1;
        continue;
      }
    }
    const settled = settleInventoryOutboxSubmission({
      entry: submitting,
      acceptance,
      now: input.now()
    });
    await input.repository.save(settled);
    if (settled.status === "accepted") summary.accepted += 1;
    if (settled.status === "conflict") summary.conflicted += 1;
    if (settled.status === "rejected") summary.rejected += 1;
  }

  return summary;
}
