import assert from "node:assert/strict";
import test from "node:test";

import {
  beginInventoryOutboxSubmission,
  createInventoryOutboxEntry,
  deferInventoryOutboxSubmission,
  inventoryOutboxEntriesReadyAt,
  retryDelayMsForAttempt,
  settleInventoryOutboxSubmission
} from "../services/domain/inventoryOutbox";
import {
  acceptInventoryEvent,
  type InventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const eventInput: InventoryEventInput = {
  restaurantId: "restaurant-a",
  inventoryItemId: "chicken",
  eventType: "receipt",
  quantity: 1000,
  canonicalUnit: "g",
  effectiveAt: "2026-07-26T10:00:00.000Z",
  source: "receiving",
  sourceReference: "delivery-1",
  reasonCode: null,
  clientEventId: "device-event-1",
  idempotencyKey: "receiving:delivery-1:chicken",
  supersedesEventId: null,
  metadata: {}
};

function authoritativeEvent(overrides: Partial<InventoryEvent> = {}): InventoryEvent {
  return {
    ...eventInput,
    id: "event-1",
    sequence: 1,
    actorUserId: "manager-1",
    recordedAt: "2026-07-26T10:01:00.000Z",
    ...overrides
  };
}

test("offline retries retain the stable event identity and back off", () => {
  const queued = createInventoryOutboxEntry({
    id: "outbox-1",
    event: eventInput,
    now: "2026-07-26T10:00:00.000Z"
  });
  const submitting = beginInventoryOutboxSubmission(
    queued,
    "2026-07-26T10:00:01.000Z"
  );
  const deferred = deferInventoryOutboxSubmission({
    entry: submitting,
    now: "2026-07-26T10:00:02.000Z"
  });

  assert.equal(deferred.status, "pending");
  assert.equal(deferred.nextAttemptAt, "2026-07-26T10:00:03.000Z");
  assert.equal(deferred.event.clientEventId, eventInput.clientEventId);
  assert.equal(deferred.event.idempotencyKey, eventInput.idempotencyKey);
  assert.deepEqual(
    inventoryOutboxEntriesReadyAt([deferred], "2026-07-26T10:00:02.999Z"),
    []
  );
  assert.equal(
    inventoryOutboxEntriesReadyAt([deferred], "2026-07-26T10:00:03.000Z")[0]?.id,
    "outbox-1"
  );
});

test("an offline entry settles with the server-authoritative event and sequence", () => {
  const queued = createInventoryOutboxEntry({
    id: "outbox-1",
    event: eventInput,
    now: "2026-07-26T10:00:00.000Z"
  });
  const submitting = beginInventoryOutboxSubmission(
    queued,
    "2026-07-26T10:00:01.000Z"
  );
  const acceptance = acceptInventoryEvent({
    existingEvents: [],
    candidate: submitting.event,
    authority: {
      id: "server-event-1",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:00:02.000Z"
    }
  });
  const settled = settleInventoryOutboxSubmission({
    entry: submitting,
    acceptance,
    now: "2026-07-26T10:00:02.000Z"
  });

  assert.equal(settled.status, "accepted");
  assert.equal(settled.authoritativeEvent?.id, "server-event-1");
  assert.equal(settled.authoritativeEvent?.sequence, 1);
});

test("server duplicates settle as accepted without creating another local action", () => {
  const queued = createInventoryOutboxEntry({
    id: "outbox-1",
    event: eventInput,
    now: "2026-07-26T10:00:00.000Z"
  });
  const submitting = beginInventoryOutboxSubmission(
    queued,
    "2026-07-26T10:00:01.000Z"
  );
  const settled = settleInventoryOutboxSubmission({
    entry: submitting,
    acceptance: { status: "duplicate", event: authoritativeEvent() },
    now: "2026-07-26T10:00:02.000Z"
  });

  assert.equal(settled.status, "accepted");
  assert.equal(settled.resolutionReason, "server_deduplicated");
  assert.equal(settled.authoritativeEvent?.id, "event-1");
});

test("conflicts stop retrying and preserve the server event for reconciliation", () => {
  const queued = createInventoryOutboxEntry({
    id: "outbox-1",
    event: eventInput,
    now: "2026-07-26T10:00:00.000Z"
  });
  const submitting = beginInventoryOutboxSubmission(
    queued,
    "2026-07-26T10:00:01.000Z"
  );
  const existing = authoritativeEvent({ quantity: 2000 });
  const settled = settleInventoryOutboxSubmission({
    entry: submitting,
    acceptance: {
      status: "conflict",
      reason: "idempotency_payload_mismatch",
      existingEvent: existing
    },
    now: "2026-07-26T10:00:02.000Z"
  });

  assert.equal(settled.status, "conflict");
  assert.equal(settled.nextAttemptAt, null);
  assert.equal(settled.authoritativeEvent, existing);
  assert.deepEqual(
    inventoryOutboxEntriesReadyAt([settled], "2026-07-27T10:00:00.000Z"),
    []
  );
});

test("retry backoff is bounded at five minutes", () => {
  assert.equal(retryDelayMsForAttempt(1), 1000);
  assert.equal(retryDelayMsForAttempt(10), 300_000);
  assert.equal(retryDelayMsForAttempt(30), 300_000);
});

test("an authoritative response cannot change tenant or idempotency identity", () => {
  const submitting = beginInventoryOutboxSubmission(
    createInventoryOutboxEntry({
      id: "outbox-1",
      event: eventInput,
      now: "2026-07-26T10:00:00.000Z"
    }),
    "2026-07-26T10:00:01.000Z"
  );

  assert.throws(
    () =>
      settleInventoryOutboxSubmission({
        entry: submitting,
        acceptance: {
          status: "accepted",
          event: authoritativeEvent({ restaurantId: "restaurant-b" })
        },
        now: "2026-07-26T10:00:02.000Z"
      }),
    /authoritative_event_identity_mismatch/
  );
});
