import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  inventoryTransferQuantityMovedFromMetadata,
  validateTransferQuantityMovedEvidence
} from "../services/domain/inventoryTransferQuantityMovedEvidence";

const migrationPath =
  "supabase/migrations/20261126060000_inventory_transfer_quantity_moved_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_transfer_quantity_moved_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryTransferQuantityMovedEvidence.ts",
  "utf8"
);

function quantityMetadata(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return { quantity_moved: 2, ...overrides };
}

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "rest-qty-moved-1",
    inventoryItemId: "item-qty-moved-1",
    eventType: "transfer",
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T12:00:00.000Z",
    source: "transfer_inventory",
    sourceReference: null,
    reasonCode: "station_transfer",
    clientEventId: "device-transfer-qty-1",
    idempotencyKey: "transfer:qty:1",
    supersedesEventId: null,
    metadata: quantityMetadata(),
    ...overrides
  };
}

function decide(candidate: InventoryEventInput) {
  return acceptInventoryEvent({
    existingEvents: [],
    candidate,
    authority: {
      id: "evt-qty-moved-1",
      actorUserId: "user-manager-1",
      recordedAt: "2026-11-26T12:00:01.000Z"
    }
  });
}

test("parses finite positive quantity_moved from metadata", () => {
  assert.equal(inventoryTransferQuantityMovedFromMetadata({ quantity_moved: 2 }), 2);
  assert.equal(inventoryTransferQuantityMovedFromMetadata({ quantity_moved: 0.5 }), 0.5);
  assert.equal(inventoryTransferQuantityMovedFromMetadata({}), null);
  assert.equal(inventoryTransferQuantityMovedFromMetadata({ quantity_moved: 0 }), null);
  assert.equal(inventoryTransferQuantityMovedFromMetadata({ quantity_moved: -1 }), null);
  assert.equal(inventoryTransferQuantityMovedFromMetadata({ quantity_moved: "2" }), null);
  assert.equal(inventoryTransferQuantityMovedFromMetadata({ quantity_moved: true }), null);
  assert.equal(
    inventoryTransferQuantityMovedFromMetadata({ quantity_moved: Number.NaN }),
    null
  );
  assert.equal(
    inventoryTransferQuantityMovedFromMetadata({ quantity_moved: Number.POSITIVE_INFINITY }),
    null
  );
});

test("validateTransferQuantityMovedEvidence ignores non-transfer events", () => {
  assert.equal(
    validateTransferQuantityMovedEvidence({
      eventType: "waste",
      metadata: {}
    }),
    null
  );
});

test("rejects transfer without quantity_moved", () => {
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-transfer-qty-bare",
          idempotencyKey: "transfer:qty:bare",
          metadata: {}
        })
      ) as { reason: string }
    ).reason,
    "transfer_requires_quantity_moved"
  );
});

test("rejects transfer with zero, negative, or non-numeric quantity_moved", () => {
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-transfer-qty-zero",
          idempotencyKey: "transfer:qty:zero",
          metadata: { quantity_moved: 0 }
        })
      ) as { reason: string }
    ).reason,
    "transfer_requires_quantity_moved"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-transfer-qty-neg",
          idempotencyKey: "transfer:qty:neg",
          metadata: { quantity_moved: -3 }
        })
      ) as { reason: string }
    ).reason,
    "transfer_requires_quantity_moved"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-transfer-qty-str",
          idempotencyKey: "transfer:qty:str",
          metadata: { quantity_moved: "2" }
        })
      ) as { reason: string }
    ).reason,
    "transfer_requires_quantity_moved"
  );
});

test("accepts transfer with positive numeric quantity_moved", () => {
  const result = decide(
    input({
      clientEventId: "device-transfer-qty-ok",
      idempotencyKey: "transfer:qty:ok"
    })
  );
  assert.equal(result.status, "accepted");
  if (result.status === "accepted") {
    assert.equal(result.event.metadata.quantity_moved, 2);
  }
});

test("transport maps hosted transfer quantity_moved rejection messages", () => {
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory transfer events require a positive quantity_moved"
      }) as { reason: string }
    ).reason,
    "transfer_requires_quantity_moved"
  );
  // Generic quantity failures still map to invalid_quantity.
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory event quantity is invalid"
      }) as { reason: string }
    ).reason,
    "invalid_quantity"
  );
});

test("migration and domain pin the product quantity_moved metadata key", () => {
  assert.match(migration, /enforce_inventory_transfer_quantity_moved_evidence/);
  assert.match(migration, /quantity_moved/);
  assert.match(migration, /not valid/i);
  assert.match(migration, /22023/);
  assert.match(evidence, /quantity_moved/);
  assert.match(evidence, /transfer_requires_quantity_moved/);
  assert.match(ledger, /validateTransferQuantityMovedEvidence/);
  assert.match(transport, /transfer_requires_quantity_moved/);
  assert.match(
    transport,
    /transfer events require a positive quantity_moved/
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

test("pgTAP covers missing, zero, negative, non-number, accept, and direct insert", () => {
  assert.match(pgTap, /cannot mint transfer without quantity_moved/);
  assert.match(pgTap, /quantity_moved of zero/);
  assert.match(pgTap, /negative quantity_moved/);
  assert.match(pgTap, /non-number quantity_moved/);
  assert.match(pgTap, /positive quantity_moved/);
  assert.match(pgTap, /non-transfer events remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
  assert.match(pgTap, /error_of/);
});
