import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  OPERATOR_CORRECTION_SOURCE,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125270000_reject_unsupported_inventory_correction_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/unsupported_inventory_correction_source.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "correction",
    quantity: -100,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: OPERATOR_CORRECTION_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "operator_correction:device-event-1",
    // Orphan supersede requirement remains #394; this tip only gates source labels.
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

test("domain rejects correction sources outside the production write-path allowlist", () => {
  const forged = accept(input({ source: "manual" }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "unsupported_correction_source");
  }

  const mixedCase = accept(input({ source: "Operator_Correction" }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "unsupported_correction_source");
  }

  const demo = accept(input({ source: "demo_correction" }));
  assert.equal(demo.status, "rejected");
  if (demo.status === "rejected") {
    assert.equal(demo.reason, "unsupported_correction_source");
  }

  const mismatchedOperator = accept(input({ source: "operator_waste" }));
  assert.equal(mismatchedOperator.status, "rejected");
  if (mismatchedOperator.status === "rejected") {
    assert.equal(mismatchedOperator.reason, "unsupported_correction_source");
  }
});

test("domain still accepts operator_correction and non-correction events", () => {
  const correction = accept(input());
  assert.equal(correction.status, "accepted");

  const receipt = accept(
    input({
      eventType: "receipt",
      source: "operator_receipt",
      quantity: 1000,
      supersedesEventId: null,
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
      supersedesEventId: null,
      clientEventId: "waste-event-1",
      idempotencyKey: "operator_waste:waste-event-1"
    })
  );
  assert.equal(waste.status, "accepted");
});

test("hosted unsupported correction-source failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory correction source must be operator_correction"
    }),
    { status: "rejected", reason: "unsupported_correction_source" }
  );
});

test("additive migration pins the BEFORE INSERT correction-source allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_unsupported_inventory_correction_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_unsupported_inventory_correction_source/
  );
  assert.match(migration, /Inventory correction source must be operator_correction/);
  assert.match(migration, /event_type = 'correction'[\s\S]*operator_correction/);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_unsupported_inventory_correction_source\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /unsupported_correction_source/);
  assert.match(
    transport,
    /message\.includes\("correction source"\)\) return "unsupported_correction_source"/
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
  assert.match(pgTap, /Inventory correction source must be operator_correction/);
  assert.match(pgTap, /'manual'/);
  assert.match(pgTap, /'Operator_Correction'/);
  assert.match(pgTap, /'demo_correction'/);
  assert.match(pgTap, /'operator_correction'/);
  assert.match(pgTap, /non-correction inventory sources remain unconstrained/);
});
