import {
  beginInventoryOutboxSubmission,
  deferInventoryOutboxSubmission,
  inventoryOutboxEntriesReadyAt,
  settleInventoryOutboxSubmission,
  type InventoryOutboxEntry
} from "../domain/inventoryOutbox";
import type { InventoryEventAcceptance } from "../domain/inventoryLedger";
import type { InventoryOutboxRepository } from "../repositories/inventoryOutboxRepository";
function authorizationStatusFromError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    status?: unknown;
    context?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.context?.status;
  return typeof status === "number" ? status : null;
}

function isInventoryOutboxRetryableAuthenticationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  if (authorizationStatusFromError(error) === 401) return true;
  if (code === "PGRST301" || code === "PGRST303") return true;
  if (/not authenticated|invalid or expired user session/i.test(message)) return true;
  if (/permission denied for (function|table|schema|sequence)\b/i.test(message)) return true;
  return false;
}

function isInventoryOutboxDurableAuthorizationDenial(error: unknown) {
  if (isInventoryOutboxRetryableAuthenticationError(error)) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";
  if (!error || typeof error !== "object") return false;
  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (/permission denied|access denied/i.test(message)) return true;
  if (authorizationStatusFromError(error) === 403) return true;
  if (code === "42501") return true;
  return false;
}

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
  if (isInventoryOutboxDurableAuthorizationDenial(error)) {
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
