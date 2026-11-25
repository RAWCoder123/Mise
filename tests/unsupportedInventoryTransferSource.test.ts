import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  TRANSFER_INVENTORY_SOURCE,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125220000_reject_unsupported_inventory_transfer_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/unsupported_inventory_transfer_source.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "transfer",
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: TRANSFER_INVENTORY_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "transfer_inventory:device-event-1",
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

test("domain rejects transfer sources outside the production write-path allowlist", () => {
  const forged = accept(input({ source: "manual", quantity: 100 }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "unsupported_transfer_source");
  }

  const mixedCase = accept(input({ source: "Transfer_Inventory", quantity: 50 }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "unsupported_transfer_source");
  }

  const demo = accept(input({ source: "demo_transfer", quantity: 25 }));
  assert.equal(demo.status, "rejected");
  if (demo.status === "rejected") {
    assert.equal(demo.reason, "unsupported_transfer_source");
  }

  const operatorLabel = accept(input({ source: "operator_transfer", quantity: 10 }));
  assert.equal(operatorLabel.status, "rejected");
  if (operatorLabel.status === "rejected") {
    assert.equal(operatorLabel.reason, "unsupported_transfer_source");
  }
});

test("domain still accepts transfer_inventory and non-transfer events", () => {
  const transfer = accept(input());
  assert.equal(transfer.status, "accepted");

  const receipt = accept(
    input({
      eventType: "receipt",
      source: "operator_receipt",
      quantity: 1000,
      clientEventId: "receipt-event-1",
      idempotencyKey: "operator_receipt:receipt-event-1"
    })
  );
  assert.equal(receipt.status, "accepted");

  const waste = accept(
    input({
      eventType: "waste",
      source: "operator_waste",
      quantity: 50,
      clientEventId: "waste-event-1",
      idempotencyKey: "operator_waste:waste-event-1"
    })
  );
  assert.equal(waste.status, "accepted");
});

test("hosted unsupported transfer-source failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory transfer source must be transfer_inventory"
    }),
    { status: "rejected", reason: "unsupported_transfer_source" }
  );
});

test("additive migration pins the BEFORE INSERT transfer-source allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_unsupported_inventory_transfer_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_unsupported_inventory_transfer_source/
  );
  assert.match(migration, /Inventory transfer source must be transfer_inventory/);
  assert.match(migration, /event_type = 'transfer'[\s\S]*transfer_inventory/);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_unsupported_inventory_transfer_source\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /unsupported_transfer_source/);
  assert.match(
    transport,
    /message\.includes\("transfer source"\)\) return "unsupported_transfer_source"/
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
  assert.match(pgTap, /Inventory transfer source must be transfer_inventory/);
  assert.match(pgTap, /'manual'/);
  assert.match(pgTap, /'Transfer_Inventory'/);
  assert.match(pgTap, /'demo_transfer'/);
  assert.match(pgTap, /'transfer_inventory'/);
  assert.match(pgTap, /non-transfer inventory sources remain unconstrained/);
});
