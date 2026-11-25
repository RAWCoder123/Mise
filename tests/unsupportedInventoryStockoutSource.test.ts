import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  OPERATOR_STOCKOUT_SOURCE,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125190000_reject_unsupported_inventory_stockout_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/unsupported_inventory_stockout_source.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: OPERATOR_STOCKOUT_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "operator_stockout:device-event-1",
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

test("domain rejects stockout sources outside the production write-path allowlist", () => {
  const forged = accept(input({ source: "manual" }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "unsupported_stockout_source");
  }

  const mixedCase = accept(input({ source: "Operator_Stockout" }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "unsupported_stockout_source");
  }

  const demo = accept(input({ source: "demo_stockout" }));
  assert.equal(demo.status, "rejected");
  if (demo.status === "rejected") {
    assert.equal(demo.reason, "unsupported_stockout_source");
  }
});

test("domain still accepts operator_stockout and non-stockout events", () => {
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

test("hosted unsupported stockout-source failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory stockout source must be operator_stockout"
    }),
    { status: "rejected", reason: "unsupported_stockout_source" }
  );
});

test("additive migration pins the BEFORE INSERT stockout-source allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_unsupported_inventory_stockout_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_unsupported_inventory_stockout_source/
  );
  assert.match(migration, /Inventory stockout source must be operator_stockout/);
  assert.match(migration, /event_type = 'stockout'[\s\S]*operator_stockout/);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_unsupported_inventory_stockout_source\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /unsupported_stockout_source/);
  assert.match(
    transport,
    /message\.includes\("stockout source"\)\) return "unsupported_stockout_source"/
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
  assert.match(pgTap, /Inventory stockout source must be operator_stockout/);
  assert.match(pgTap, /'manual'/);
  assert.match(pgTap, /'Operator_Stockout'/);
  assert.match(pgTap, /'demo_stockout'/);
  assert.match(pgTap, /'operator_stockout'/);
  assert.match(pgTap, /non-stockout inventory sources remain unconstrained/);
});
