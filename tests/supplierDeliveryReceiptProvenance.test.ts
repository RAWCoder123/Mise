import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125120000_reject_forged_supplier_delivery_receipt_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/supplier_delivery_receipt_provenance.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");

const deliveryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "supplier_delivery",
    sourceReference: deliveryId,
    reasonCode: "supplier_delivery",
    clientEventId: "device-event-1",
    idempotencyKey: "supplier_delivery:device-event-1",
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

test("domain rejects supplier_delivery receipts without a UUID delivery reference", () => {
  const missing = accept(input({ sourceReference: null }));
  assert.equal(missing.status, "rejected");
  if (missing.status === "rejected") {
    assert.equal(missing.reason, "invalid_supplier_delivery_reference");
  }

  const forgedLabel = accept(input({ sourceReference: "not-a-delivery-id" }));
  assert.equal(forgedLabel.status, "rejected");
  if (forgedLabel.status === "rejected") {
    assert.equal(forgedLabel.reason, "invalid_supplier_delivery_reference");
  }
});

test("domain still accepts operator receipts and UUID-linked supplier_delivery receipts", () => {
  const operator = accept(
    input({
      source: "operator_receipt",
      sourceReference: "invoice-1",
      reasonCode: null
    })
  );
  assert.equal(operator.status, "accepted");

  const linked = accept(input());
  assert.equal(linked.status, "accepted");
});

test("hosted supplier_delivery provenance failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Supplier delivery receipt source requires a matching same-tenant delivery"
    }),
    { status: "rejected", reason: "invalid_supplier_delivery_reference" }
  );
});

test("additive migration pins the BEFORE INSERT guard without redeclaring record_inventory_event", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_forged_supplier_delivery_receipt_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_forged_supplier_delivery_receipt_source/
  );
  assert.match(
    migration,
    /Supplier delivery receipt source requires a matching same-tenant delivery/
  );
  assert.match(
    migration,
    /from public\.supplier_deliveries delivery[\s\S]*delivery\.restaurant_id = new\.restaurant_id[\s\S]*delivery\.id = delivery_id/
  );
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_forged_supplier_delivery_receipt_source\(\)[\s\S]*service_role/
  );
});

test("demo and transport mirror the hosted supplier_delivery provenance rejection", () => {
  assert.match(demo, /invalid_supplier_delivery_reference/);
  assert.match(demo, /state\.supplierDeliveries/);
  assert.match(
    transport,
    /message\.includes\("supplier delivery"\)\) return "invalid_supplier_delivery_reference"/
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
  assert.match(
    pgTap,
    /Supplier delivery receipt source requires a matching same-tenant delivery/
  );
  assert.match(pgTap, /'supplier_delivery'/);
});
