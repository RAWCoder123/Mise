import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  inventoryTransferLocationIdFromMetadata,
  validateTransferLocationEvidence
} from "../services/domain/inventoryTransferLocationEvidence";

const migrationPath =
  "supabase/migrations/20261126050000_inventory_transfer_location_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_transfer_location_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryTransferLocationEvidence.ts",
  "utf8"
);

const FROM_ID = "a1111111-1111-4111-8111-111111111111";
const TO_ID = "b2222222-2222-4222-8222-222222222222";

function locationMetadata(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    from_storage_location_id: FROM_ID,
    to_storage_location_id: TO_ID,
    quantity_moved: 2,
    ...overrides
  };
}

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "transfer",
    // Product station-transfer writer stamps quantity 0 so on-hand is unchanged.
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    // Match the production write-path source so this tip stays orthogonal to #1269.
    source: "transfer_inventory",
    sourceReference: null,
    // Match the production reason so this tip stays orthogonal to #1276.
    reasonCode: "station_transfer",
    clientEventId: "device-event-1",
    idempotencyKey: "transfer_inventory:device-event-1",
    supersedesEventId: null,
    metadata: locationMetadata(),
    ...overrides
  };
}

function decide(candidate: InventoryEventInput) {
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

test("location id helper accepts trimmed UUIDs and rejects garbage", () => {
  assert.equal(
    inventoryTransferLocationIdFromMetadata(
      { from_storage_location_id: `  ${FROM_ID}  ` },
      "from_storage_location_id"
    ),
    FROM_ID
  );
  assert.equal(
    inventoryTransferLocationIdFromMetadata(
      { from_storage_location_id: "Main" },
      "from_storage_location_id"
    ),
    null
  );
  assert.equal(
    inventoryTransferLocationIdFromMetadata(
      { from_storage_location_id: "   " },
      "from_storage_location_id"
    ),
    null
  );
  assert.equal(
    inventoryTransferLocationIdFromMetadata(
      { from_storage_location_id: 12 },
      "from_storage_location_id"
    ),
    null
  );
  assert.equal(
    inventoryTransferLocationIdFromMetadata(null, "to_storage_location_id"),
    null
  );
});

test("validateTransferLocationEvidence ignores unrelated event types", () => {
  assert.equal(
    validateTransferLocationEvidence({ eventType: "receipt", metadata: {} }),
    null
  );
  assert.equal(
    validateTransferLocationEvidence({ eventType: "waste", metadata: {} }),
    null
  );
  assert.equal(
    validateTransferLocationEvidence({ eventType: "correction", metadata: {} }),
    null
  );
});

test("rejects transfer without distinct UUID from/to locations", () => {
  assert.equal(
    (decide(input({ metadata: {} })) as { reason: string }).reason,
    "transfer_requires_locations"
  );
  assert.equal(
    (
      decide(
        input({
          metadata: { from_storage_location_id: FROM_ID }
        })
      ) as { reason: string }
    ).reason,
    "transfer_requires_locations"
  );
  assert.equal(
    (
      decide(
        input({
          metadata: {
            from_storage_location_id: "Main",
            to_storage_location_id: "Walk-in"
          }
        })
      ) as { reason: string }
    ).reason,
    "transfer_requires_locations"
  );
  assert.equal(
    (
      decide(
        input({
          metadata: {
            from_storage_location_id: FROM_ID,
            to_storage_location_id: FROM_ID.toUpperCase()
          }
        })
      ) as { reason: string }
    ).reason,
    "invalid_transfer_locations"
  );
  assert.equal(
    (
      decide(
        input({
          metadata: {
            from_storage_location_id: FROM_ID,
            to_storage_location_id: `  ${FROM_ID}  `
          }
        })
      ) as { reason: string }
    ).reason,
    "invalid_transfer_locations"
  );
});

test("accepts transfer with distinct UUID from/to location ids", () => {
  const result = decide(
    input({
      clientEventId: "device-transfer-loc-ok",
      idempotencyKey: "transfer:loc:ok"
    })
  );
  assert.equal(result.status, "accepted");
  if (result.status === "accepted") {
    assert.equal(result.event.metadata.from_storage_location_id, FROM_ID);
    assert.equal(result.event.metadata.to_storage_location_id, TO_ID);
  }
});

test("transport maps hosted transfer-location rejection messages", () => {
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory transfer events require from and to storage location ids"
      }) as { reason: string }
    ).reason,
    "transfer_requires_locations"
  );
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory transfer storage locations are invalid"
      }) as { reason: string }
    ).reason,
    "invalid_transfer_locations"
  );
});

test("migration and domain pin the product from/to metadata keys", () => {
  assert.match(migration, /enforce_inventory_transfer_location_evidence/);
  assert.match(migration, /from_storage_location_id/);
  assert.match(migration, /to_storage_location_id/);
  assert.match(migration, /not valid/i);
  assert.match(migration, /22023/);
  assert.match(evidence, /from_storage_location_id/);
  assert.match(evidence, /to_storage_location_id/);
  assert.match(evidence, /transfer_requires_locations/);
  assert.match(evidence, /invalid_transfer_locations/);
  assert.match(ledger, /validateTransferLocationEvidence/);
  assert.match(transport, /transfer_requires_locations/);
  assert.match(transport, /invalid_transfer_locations/);
  assert.match(
    transport,
    /transfer events require from and to storage location/
  );
});

test("pgTAP plan matches assertion call-site count", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP plan() call present");
  const planned = Number(planMatch![1]);
  const assertionCount = (
    pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(
    planned,
    assertionCount,
    `plan(${planned}) must equal assertion call sites (${assertionCount})`
  );
  assert.equal(planned, 9);
});

test("pgTAP covers missing, partial, garbage, same-id, accept, and direct insert", () => {
  assert.match(pgTap, /cannot mint transfer without from\/to location ids/);
  assert.match(pgTap, /only a from location id/);
  assert.match(pgTap, /non-UUID location labels/);
  assert.match(pgTap, /same from and to location/);
  assert.match(pgTap, /distinct UUID from\/to location ids/);
  assert.match(pgTap, /non-transfer events remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
  assert.match(pgTap, /error_of/);
});
