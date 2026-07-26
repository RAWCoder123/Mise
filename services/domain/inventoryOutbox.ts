import type {
  InventoryEvent,
  InventoryEventAcceptance,
  InventoryEventInput
} from "./inventoryLedger";

export type InventoryOutboxStatus =
  | "pending"
  | "submitting"
  | "accepted"
  | "conflict"
  | "rejected";

export interface InventoryOutboxEntry {
  id: string;
  event: InventoryEventInput;
  status: InventoryOutboxStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  authoritativeEvent: InventoryEvent | null;
  resolutionReason: string | null;
}

export function createInventoryOutboxEntry(input: {
  id: string;
  event: InventoryEventInput;
  now: string;
}): InventoryOutboxEntry {
  assertTimestamp(input.now, "invalid_outbox_timestamp");
  if (!input.id.trim()) throw new Error("missing_outbox_id");
  if (!input.event.clientEventId.trim() || !input.event.idempotencyKey.trim()) {
    throw new Error("missing_event_idempotency");
  }

  return {
    id: input.id,
    event: freezeEventIdentity(input.event),
    status: "pending",
    attemptCount: 0,
    createdAt: input.now,
    updatedAt: input.now,
    nextAttemptAt: input.now,
    authoritativeEvent: null,
    resolutionReason: null
  };
}

export function beginInventoryOutboxSubmission(
  entry: InventoryOutboxEntry,
  now: string
): InventoryOutboxEntry {
  assertTimestamp(now, "invalid_submission_timestamp");
  if (entry.status !== "pending") throw new Error("outbox_entry_not_pending");
  if (entry.nextAttemptAt && Date.parse(entry.nextAttemptAt) > Date.parse(now)) {
    throw new Error("outbox_retry_not_due");
  }

  return {
    ...entry,
    status: "submitting",
    attemptCount: entry.attemptCount + 1,
    updatedAt: now,
    nextAttemptAt: null
  };
}

export function deferInventoryOutboxSubmission(input: {
  entry: InventoryOutboxEntry;
  now: string;
  retryAfterMs?: number;
}): InventoryOutboxEntry {
  assertTimestamp(input.now, "invalid_retry_timestamp");
  if (input.entry.status !== "submitting") throw new Error("outbox_entry_not_submitting");
  const retryAfterMs =
    input.retryAfterMs ?? retryDelayMsForAttempt(input.entry.attemptCount);
  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
    throw new Error("invalid_retry_delay");
  }

  return {
    ...input.entry,
    status: "pending",
    updatedAt: input.now,
    nextAttemptAt: new Date(Date.parse(input.now) + retryAfterMs).toISOString(),
    resolutionReason: "network_retry"
  };
}

export function settleInventoryOutboxSubmission(input: {
  entry: InventoryOutboxEntry;
  acceptance: InventoryEventAcceptance;
  now: string;
}): InventoryOutboxEntry {
  assertTimestamp(input.now, "invalid_settlement_timestamp");
  if (input.entry.status !== "submitting") throw new Error("outbox_entry_not_submitting");

  if (input.acceptance.status === "accepted" || input.acceptance.status === "duplicate") {
    assertStableIdentity(input.entry.event, input.acceptance.event);
    return {
      ...input.entry,
      status: "accepted",
      updatedAt: input.now,
      nextAttemptAt: null,
      authoritativeEvent: input.acceptance.event,
      resolutionReason:
        input.acceptance.status === "duplicate" ? "server_deduplicated" : null
    };
  }

  return {
    ...input.entry,
    status: input.acceptance.status,
    updatedAt: input.now,
    nextAttemptAt: null,
    authoritativeEvent:
      input.acceptance.status === "conflict" ? input.acceptance.existingEvent : null,
    resolutionReason: input.acceptance.reason
  };
}

export function inventoryOutboxEntriesReadyAt(
  entries: readonly InventoryOutboxEntry[],
  now: string
) {
  assertTimestamp(now, "invalid_outbox_clock");
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

export function retryDelayMsForAttempt(attemptCount: number) {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error("invalid_attempt_count");
  }
  return Math.min(1_000 * 2 ** (attemptCount - 1), 5 * 60_000);
}

function freezeEventIdentity(event: InventoryEventInput): InventoryEventInput {
  return Object.freeze({
    ...event,
    metadata: Object.freeze({ ...event.metadata })
  });
}

function assertStableIdentity(candidate: InventoryEventInput, event: InventoryEvent) {
  if (
    candidate.restaurantId !== event.restaurantId ||
    candidate.inventoryItemId !== event.inventoryItemId ||
    candidate.clientEventId !== event.clientEventId ||
    candidate.idempotencyKey !== event.idempotencyKey
  ) {
    throw new Error("authoritative_event_identity_mismatch");
  }
}

function assertTimestamp(value: string, reason: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(reason);
}
