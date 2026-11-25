import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  OPERATOR_RECEIPT_SOURCE,
  SUPPLIER_DELIVERY_RECEIPT_SOURCE,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125160000_reject_unsupported_inventory_receipt_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/unsupported_inventory_receipt_source.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: OPERATOR_RECEIPT_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "operator_receipt:device-event-1",
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

test("domain rejects receipt sources outside the production write-path allowlist", () => {
  const forged = accept(input({ source: "receiving" }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "unsupported_receipt_source");
  }

  const mixedCase = accept(input({ source: "Operator_Receipt" }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "unsupported_receipt_source");
  }

  const manual = accept(input({ source: "manual" }));
  assert.equal(manual.status, "rejected");
  if (manual.status === "rejected") {
    assert.equal(manual.reason, "unsupported_receipt_source");
  }
});

test("domain still accepts the two production receipt sources and non-receipt events", () => {
  const operator = accept(input());
  assert.equal(operator.status, "accepted");

  const delivery = accept(
    input({
      source: SUPPLIER_DELIVERY_RECEIPT_SOURCE,
      sourceReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      reasonCode: "supplier_delivery",
      clientEventId: "delivery-event-1",
      idempotencyKey: "supplier_delivery:delivery-event-1"
    })
  );
  assert.equal(delivery.status, "accepted");

  const waste = accept(
    input({
      eventType: "waste",
      source: "operator_waste",
      quantity: 10,
      clientEventId: "waste-event-1",
      idempotencyKey: "operator_waste:waste-event-1"
    })
  );
  assert.equal(waste.status, "accepted");
});

test("hosted unsupported receipt-source failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory receipt source must be operator_receipt or supplier_delivery"
    }),
    { status: "rejected", reason: "unsupported_receipt_source" }
  );
});

test("additive migration pins the BEFORE INSERT receipt-source allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_unsupported_inventory_receipt_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_unsupported_inventory_receipt_source/
  );
  assert.match(
    migration,
    /Inventory receipt source must be operator_receipt or supplier_delivery/
  );
  assert.match(
    migration,
    /event_type = 'receipt'[\s\S]*operator_receipt[\s\S]*supplier_delivery/
  );
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_unsupported_inventory_receipt_source\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /unsupported_receipt_source/);
  assert.match(
    transport,
    /message\.includes\("receipt source"\)\) return "unsupported_receipt_source"/
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
  assert.match(pgTap, /Inventory receipt source must be operator_receipt or supplier_delivery/);
  assert.match(pgTap, /'receiving'/);
  assert.match(pgTap, /'operator_receipt'/);
  assert.match(pgTap, /'supplier_delivery'/);
  assert.match(pgTap, /non-receipt inventory sources remain unconstrained/);
});
