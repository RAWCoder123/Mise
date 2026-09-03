import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inventoryEventRejectionFromRpcError,
  inventoryEventRpcArguments,
  normalizeInventoryEventRecord
} from "../services/domain/inventoryEventTransport";
import type { InventoryEventInput } from "../services/domain/inventoryLedger";

const input: InventoryEventInput = {
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
  metadata: { invoice: "invoice-1" }
};

test("inventory RPC arguments preserve the immutable client event identity", () => {
  assert.deepEqual(inventoryEventRpcArguments(input), {
    p_restaurant_id: "restaurant-a",
    p_inventory_item_id: "chicken",
    p_event_type: "receipt",
    p_quantity: 1000,
    p_canonical_unit: "g",
    p_effective_at: "2026-07-26T10:00:00.000Z",
    p_source: "receiving",
    p_client_event_id: "device-event-1",
    p_idempotency_key: "receiving:delivery-1:chicken",
    p_source_reference: "delivery-1",
    p_reason_code: null,
    p_supersedes_event_id: null,
    p_metadata: { invoice: "invoice-1" }
  });
});

test("inventory RPC rows normalize numeric Postgres values and server authority", () => {
  const event = normalizeInventoryEventRecord({
    id: "event-1",
    sequence: "7",
    restaurant_id: "restaurant-a",
    inventory_item_id: "chicken",
    event_type: "receipt",
    quantity: "1000.000",
    canonical_unit: "g",
    effective_at: "2026-07-26T10:00:00.000Z",
    recorded_at: "2026-07-26T10:00:01.000Z",
    actor_user_id: "manager-1",
    source: "receiving",
    source_reference: "delivery-1",
    reason_code: null,
    client_event_id: "device-event-1",
    idempotency_key: "receiving:delivery-1:chicken",
    supersedes_event_id: null,
    metadata: { invoice: "invoice-1" }
  });

  assert.equal(event.sequence, 7);
  assert.equal(event.quantity, 1000);
  assert.equal(event.actorUserId, "manager-1");
  assert.equal(event.clientEventId, input.clientEventId);
});

test("known database validation and conflict errors settle without blind retries", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "23505",
      message: "Inventory event idempotency conflict"
    }),
    {
      status: "conflict",
      reason: "idempotency_payload_mismatch",
      existingEvent: null
    }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Canonical unit must be g, ml, or each"
    }),
    { status: "rejected", reason: "invalid_canonical_unit" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory ledger events cannot be effective more than 90 days in the past"
    }),
    { status: "rejected", reason: "effective_at_too_old" }
  );
});

test("transport and authorization failures remain retryable or surfaced", () => {
  assert.equal(
    inventoryEventRejectionFromRpcError({
      code: "42501",
      message: "Manager access required"
    }),
    null
  );
  assert.equal(inventoryEventRejectionFromRpcError(new TypeError("fetch failed")), null);
});

test("malformed successful responses never become accepted device events", () => {
  assert.throws(
    () => normalizeInventoryEventRecord({ id: "event-1", sequence: 1 }),
    /inventory_rpc_invalid_event_type/
  );
});

test("hosted inventory writes use only the authoritative RPC boundary", () => {
  const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const start = repository.indexOf("async recordInventoryEvent(input)");
  const end = repository.indexOf("async fetchPlanningData", start);
  const method = repository.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(method, /client\.rpc\(\s*"record_inventory_event"/);
  assert.doesNotMatch(method, /\.from\(\s*"inventory_events"\s*\)/);
  assert.doesNotMatch(method, /\.(?:insert|update|delete)\(/);
});
