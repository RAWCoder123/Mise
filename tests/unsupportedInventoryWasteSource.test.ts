import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  OPERATOR_WASTE_SOURCE,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125180000_reject_unsupported_inventory_waste_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/unsupported_inventory_waste_source.test.sql",
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
    source: OPERATOR_WASTE_SOURCE,
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

test("domain rejects waste sources outside the production write-path allowlist", () => {
  const forged = accept(input({ source: "manual" }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "unsupported_waste_source");
  }

  const mixedCase = accept(input({ source: "Operator_Waste" }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "unsupported_waste_source");
  }

  const demo = accept(input({ source: "demo_waste" }));
  assert.equal(demo.status, "rejected");
  if (demo.status === "rejected") {
    assert.equal(demo.reason, "unsupported_waste_source");
  }
});

test("domain still accepts operator_waste and non-waste events", () => {
  const operator = accept(input());
  assert.equal(operator.status, "accepted");

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

  const stockout = accept(
    input({
      eventType: "stockout",
      source: "operator_stockout",
      quantity: 0,
      clientEventId: "stockout-event-1",
      idempotencyKey: "operator_stockout:stockout-event-1"
    })
  );
  assert.equal(stockout.status, "accepted");
});

test("hosted unsupported waste-source failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory waste source must be operator_waste"
    }),
    { status: "rejected", reason: "unsupported_waste_source" }
  );
});

test("additive migration pins the BEFORE INSERT waste-source allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_unsupported_inventory_waste_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_unsupported_inventory_waste_source/
  );
  assert.match(migration, /Inventory waste source must be operator_waste/);
  assert.match(migration, /event_type = 'waste'[\s\S]*operator_waste/);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_unsupported_inventory_waste_source\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /unsupported_waste_source/);
  assert.match(
    transport,
    /message\.includes\("waste source"\)\) return "unsupported_waste_source"/
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
  assert.match(pgTap, /Inventory waste source must be operator_waste/);
  assert.match(pgTap, /'manual'/);
  assert.match(pgTap, /'Operator_Waste'/);
  assert.match(pgTap, /'demo_waste'/);
  assert.match(pgTap, /'operator_waste'/);
  assert.match(pgTap, /non-waste inventory sources remain unconstrained/);
});
