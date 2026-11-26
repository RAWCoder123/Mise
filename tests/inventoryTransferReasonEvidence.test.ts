import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  INVENTORY_TRANSFER_REASON_CODES,
  isInventoryTransferReasonCode,
  validateTransferReasonEvidence
} from "../services/domain/inventoryTransferReasonEvidence";

const migrationPath =
  "supabase/migrations/20261126040000_inventory_transfer_reason_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_transfer_reason_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryTransferReasonEvidence.ts",
  "utf8"
);

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
    reasonCode: "station_transfer",
    clientEventId: "device-event-1",
    idempotencyKey: "transfer_inventory:device-event-1",
    supersedesEventId: null,
    metadata: {},
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

test("transfer reason allowlist matches the product station-transfer writer", () => {
  assert.deepEqual([...INVENTORY_TRANSFER_REASON_CODES], ["station_transfer"]);
  assert.equal(isInventoryTransferReasonCode("station_transfer"), true);
  assert.equal(isInventoryTransferReasonCode("manual_move"), false);
  assert.equal(isInventoryTransferReasonCode("Station_Transfer"), false);
  assert.equal(isInventoryTransferReasonCode("transfer"), false);
  assert.equal(isInventoryTransferReasonCode(null), false);
});

test("validateTransferReasonEvidence ignores unrelated event types", () => {
  assert.equal(
    validateTransferReasonEvidence({ eventType: "receipt", reasonCode: null }),
    null
  );
  assert.equal(
    validateTransferReasonEvidence({ eventType: "waste", reasonCode: null }),
    null
  );
  assert.equal(
    validateTransferReasonEvidence({ eventType: "correction", reasonCode: null }),
    null
  );
});

test("rejects transfer without an allowlisted reason", () => {
  assert.equal(
    (decide(input({ reasonCode: null })) as { reason: string }).reason,
    "transfer_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "   " })) as { reason: string }).reason,
    "transfer_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "manual_move" })) as { reason: string }).reason,
    "invalid_transfer_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "Station_Transfer" })) as { reason: string }).reason,
    "invalid_transfer_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "demo_transfer" })) as { reason: string }).reason,
    "invalid_transfer_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "transfer" })) as { reason: string }).reason,
    "invalid_transfer_reason"
  );
});

test("accepts transfer with the allowlisted station_transfer reason", () => {
  for (const reasonCode of INVENTORY_TRANSFER_REASON_CODES) {
    const result = decide(
      input({
        reasonCode,
        clientEventId: `device-transfer-${reasonCode}`,
        idempotencyKey: `transfer:${reasonCode}:ok`
      })
    );
    assert.equal(result.status, "accepted", reasonCode);
  }
});

test("receipt count waste and usage still omit transfer reason requirements", () => {
  for (const eventType of ["receipt", "count", "waste", "usage"] as const) {
    const result = decide(
      input({
        eventType,
        quantity: 100,
        reasonCode: null,
        clientEventId: `device-${eventType}`,
        idempotencyKey: `${eventType}:1`,
        source: `operator_${eventType}`
      })
    );
    assert.equal(result.status, "accepted", eventType);
  }
});

test("hosted transfer-reason failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory transfer events require a reason code"
    }),
    { status: "rejected", reason: "transfer_requires_reason" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory transfer reason code is not allowed"
    }),
    { status: "rejected", reason: "invalid_transfer_reason" }
  );
});

test("additive migration pins the BEFORE INSERT transfer-reason allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_transfer_reason_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_transfer_reason_evidence/
  );
  assert.match(migration, /Inventory transfer events require a reason code/);
  assert.match(migration, /Inventory transfer reason code is not allowed/);
  assert.match(migration, /'station_transfer'/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_transfer_reason_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateTransferReasonEvidence/);
  assert.match(evidence, /transfer_requires_reason/);
  assert.match(evidence, /invalid_transfer_reason/);
  assert.match(evidence, /INVENTORY_TRANSFER_REASON_CODES/);
  assert.match(
    transport,
    /message\.includes\("transfer events require a reason code"\)/
  );
  assert.match(
    transport,
    /message\.includes\("transfer reason code is not allowed"\)/
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
  assert.match(pgTap, /Inventory transfer events require a reason code/);
  assert.match(pgTap, /Inventory transfer reason code is not allowed/);
  assert.match(pgTap, /'station_transfer'/);
  assert.match(pgTap, /'manual_move'/);
  assert.match(pgTap, /'Station_Transfer'/);
  assert.match(pgTap, /non-transfer events remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
