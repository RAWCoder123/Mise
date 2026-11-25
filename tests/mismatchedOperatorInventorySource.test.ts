import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125170000_reject_mismatched_operator_inventory_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/mismatched_operator_inventory_source.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "waste",
    quantity: 50,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "operator_waste:device-event-1",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function accept(candidate: InventoryEventInput) {
  return acceptInventoryEvent({
    existingEvents: [],
    candidate,
    authority: {
      id: "event-1",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:01:00.000Z"
    }
  });
}

test("domain rejects operator_* sources that do not match the event type", () => {
  const forged = accept(input({ source: "operator_receipt" }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "mismatched_operator_source");
  }

  const cross = accept(
    input({
      eventType: "receipt",
      quantity: 100,
      source: "operator_waste",
      clientEventId: "device-event-2",
      idempotencyKey: "operator_waste:device-event-2"
    })
  );
  assert.equal(cross.status, "rejected");
  if (cross.status === "rejected") {
    assert.equal(cross.reason, "mismatched_operator_source");
  }

  const mixedCase = accept(input({ source: "Operator_Waste" }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "mismatched_operator_source");
  }
});

test("domain still accepts matching operator_* sources and non-operator labels", () => {
  const waste = accept(input());
  assert.equal(waste.status, "accepted");

  const receipt = accept(
    input({
      eventType: "receipt",
      quantity: 100,
      source: "operator_receipt",
      clientEventId: "device-event-3",
      idempotencyKey: "operator_receipt:device-event-3"
    })
  );
  assert.equal(receipt.status, "accepted");

  const delivery = accept(
    input({
      eventType: "receipt",
      quantity: 100,
      source: "supplier_delivery",
      sourceReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      clientEventId: "device-event-4",
      idempotencyKey: "supplier_delivery:device-event-4"
    })
  );
  assert.equal(delivery.status, "accepted");

  const session = accept(
    input({
      eventType: "count",
      quantity: 10,
      source: "approve_count_session",
      clientEventId: "device-event-5",
      idempotencyKey: "approve_count_session:device-event-5"
    })
  );
  assert.equal(session.status, "accepted");
});

test("hosted mismatched operator-source failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory operator source must match the operation"
    }),
    { status: "rejected", reason: "mismatched_operator_source" }
  );
});

test("additive migration pins the BEFORE INSERT operator-source match guard", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_mismatched_operator_inventory_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_mismatched_operator_inventory_source/
  );
  assert.match(migration, /Inventory operator source must match the operation/);
  assert.match(
    migration,
    /starts_with\(lower\(trimmed_source\), 'operator_'\)[\s\S]*operator_'\s*\|\|\s*new\.event_type/
  );
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_mismatched_operator_inventory_source\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /mismatched_operator_source/);
  assert.match(
    transport,
    /message\.includes\("operator source must match"\)[\s\S]*mismatched_operator_source/
  );
});

test("pgTAP plan equals assertion call sites and covers forged plus legitimate paths", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch?.[1]);
  const assertionSites = (
    pgTap.match(/^select (?:is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /Inventory operator source must match the operation/);
  assert.match(pgTap, /'operator_receipt'/);
  assert.match(pgTap, /'operator_waste'/);
  assert.match(pgTap, /'Operator_Waste'/);
  assert.match(pgTap, /direct inserts also reject mismatched operator_\* sources/);
});
