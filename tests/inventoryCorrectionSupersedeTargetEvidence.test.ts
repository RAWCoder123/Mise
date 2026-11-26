import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateInventoryCorrectionSupersedeTargetEvidence } from "../services/domain/inventoryCorrectionSupersedeTargetEvidence";
import {
  acceptInventoryEvent,
  type InventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261126190000_inventory_correction_supersede_target_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_correction_supersede_target_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/inventoryCorrectionSupersedeTargetEvidence.ts",
  "utf8"
);

const target = {
  restaurantId: "restaurant-a",
  inventoryItemId: "item-chicken"
};

function wasteEvent(overrides: Partial<InventoryEvent> = {}): InventoryEvent {
  return {
    id: "evt-waste-1",
    sequence: 1,
    restaurantId: "restaurant-a",
    inventoryItemId: "item-chicken",
    eventType: "waste",
    quantity: 100,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T10:00:00.000Z",
    recordedAt: "2026-11-26T10:00:01.000Z",
    actorUserId: "manager-1",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: "spoilage",
    clientEventId: "device-waste-1",
    idempotencyKey: "operator_waste:device-waste-1",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function correctionInput(
  overrides: Partial<InventoryEventInput> = {}
): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "item-chicken",
    eventType: "correction",
    quantity: -100,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T10:05:00.000Z",
    source: "operator_correction",
    sourceReference: null,
    reasonCode: "waste_correction",
    clientEventId: "device-correction-1",
    idempotencyKey: "operator_correction:device-correction-1",
    supersedesEventId: "evt-waste-1",
    metadata: {},
    ...overrides
  };
}

test("validateInventoryCorrectionSupersedeTargetEvidence allows absent supersedes", () => {
  assert.equal(
    validateInventoryCorrectionSupersedeTargetEvidence({
      supersedesEventId: null,
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      target: null
    }),
    null
  );
  assert.equal(
    validateInventoryCorrectionSupersedeTargetEvidence({
      supersedesEventId: "",
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      target: null
    }),
    null
  );
});

test("validateInventoryCorrectionSupersedeTargetEvidence rejects missing targets", () => {
  assert.equal(
    validateInventoryCorrectionSupersedeTargetEvidence({
      supersedesEventId: "evt-waste-1",
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      target: null
    }),
    "supersede_target_missing"
  );
});

test("validateInventoryCorrectionSupersedeTargetEvidence rejects identity forgeries", () => {
  assert.equal(
    validateInventoryCorrectionSupersedeTargetEvidence({
      supersedesEventId: "evt-waste-1",
      restaurantId: "restaurant-b",
      inventoryItemId: "item-chicken",
      target
    }),
    "supersede_target_restaurant_mismatch"
  );
  assert.equal(
    validateInventoryCorrectionSupersedeTargetEvidence({
      supersedesEventId: "evt-waste-1",
      restaurantId: "restaurant-a",
      inventoryItemId: "item-beef",
      target
    }),
    "supersede_target_item_mismatch"
  );
});

test("validateInventoryCorrectionSupersedeTargetEvidence accepts identity-preserving corrections", () => {
  assert.equal(
    validateInventoryCorrectionSupersedeTargetEvidence({
      supersedesEventId: "evt-waste-1",
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      target
    }),
    null
  );
});

test("acceptInventoryEvent already rejects mismatched supersede targets", () => {
  const crossItem = acceptInventoryEvent({
    existingEvents: [wasteEvent()],
    candidate: correctionInput({
      inventoryItemId: "item-beef",
      clientEventId: "device-correction-cross-item",
      idempotencyKey: "operator_correction:cross-item"
    }),
    authority: {
      id: "evt-correction-cross-item",
      actorUserId: "manager-1",
      recordedAt: "2026-11-26T10:05:01.000Z"
    }
  });
  assert.equal(crossItem.status, "conflict");
  if (crossItem.status === "conflict") {
    assert.equal(crossItem.reason, "superseded_event_not_found");
  }

  const crossRestaurant = acceptInventoryEvent({
    existingEvents: [wasteEvent()],
    candidate: correctionInput({
      restaurantId: "restaurant-b",
      clientEventId: "device-correction-cross-tenant",
      idempotencyKey: "operator_correction:cross-tenant"
    }),
    authority: {
      id: "evt-correction-cross-tenant",
      actorUserId: "manager-1",
      recordedAt: "2026-11-26T10:05:01.000Z"
    }
  });
  assert.equal(crossRestaurant.status, "conflict");
  if (crossRestaurant.status === "conflict") {
    assert.equal(crossRestaurant.reason, "superseded_event_not_found");
  }
});

test("acceptInventoryEvent accepts same-item supersession", () => {
  const accepted = acceptInventoryEvent({
    existingEvents: [wasteEvent()],
    candidate: correctionInput(),
    authority: {
      id: "evt-correction-ok",
      actorUserId: "manager-1",
      recordedAt: "2026-11-26T10:05:01.000Z"
    }
  });
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") {
    assert.equal(accepted.event.supersedesEventId, "evt-waste-1");
    assert.equal(accepted.event.inventoryItemId, "item-chicken");
  }
});

test("additive migration pins the BEFORE INSERT supersede-target guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_correction_supersede_target_evidence\(\)/
  );
  assert.match(
    migration,
    /create trigger inventory_events_correction_supersede_target_evidence/
  );
  assert.match(
    migration,
    /Inventory correction must supersede an event in the same restaurant/
  );
  assert.match(
    migration,
    /Inventory correction must supersede an event for the same inventory item/
  );
  assert.match(migration, /Superseded event not found for inventory item/);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.record_inventory_event/
  );
  assert.doesNotMatch(migration, /not valid/i);
  assert.doesNotMatch(
    migration,
    /supersedes_event_id is not null/
  );
});

test("domain evidence documents the forgeable soft-CHECK gap", () => {
  assert.match(evidence, /bare/);
  assert.match(evidence, /references inventory_events\(id\)/);
  assert.match(evidence, /#394/);
  assert.match(evidence, /#395/);
});

test("pgTAP plan is derived from assertion call sites", () => {
  const assertionCount = (
    pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(assertionCount, 10);
  assert.match(pgTap, /select plan\(10\);/);
  assert.match(pgTap, /direct insert rejects cross-item supersession/);
  assert.match(pgTap, /direct insert rejects cross-restaurant supersession/);
  assert.match(pgTap, /direct insert accepts same-item supersession/);
  assert.match(pgTap, /direct insert still accepts corrections without supersedes_event_id/);
  assert.match(pgTap, /manager JWT cannot mint a cross-item correction via RPC/);
  assert.match(pgTap, /manager JWT can record a same-item correction via RPC/);
  assert.match(pgTap, /second supersession of the same target remains fail-closed/);
});
