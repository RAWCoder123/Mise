import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  INVENTORY_STOCKOUT_REASON_CODES,
  isInventoryStockoutReasonCode,
  validateStockoutEvidence
} from "../services/domain/inventoryStockoutEvidence";

const migrationPath =
  "supabase/migrations/20261125221000_inventory_stockout_reason_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_stockout_reason_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync("services/domain/inventoryStockoutEvidence.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "flour",
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_stockout",
    sourceReference: null,
    reasonCode: "under_ordered",
    clientEventId: "device-event-stockout-1",
    idempotencyKey: "stockout:under_ordered:1",
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

test("stockout reason allowlist matches the product writer taxonomy", () => {
  assert.deepEqual([...INVENTORY_STOCKOUT_REASON_CODES], [
    "under_ordered",
    "unexpected_demand",
    "delivery_missed",
    "spoilage_cleared",
    "theft_loss",
    "other"
  ]);
  assert.equal(isInventoryStockoutReasonCode("under_ordered"), true);
  assert.equal(isInventoryStockoutReasonCode("ran_out"), false);
  assert.equal(isInventoryStockoutReasonCode("Under_Ordered"), false);
  assert.equal(isInventoryStockoutReasonCode(null), false);
});

test("validateStockoutEvidence ignores unrelated event types", () => {
  assert.equal(
    validateStockoutEvidence({ eventType: "receipt", reasonCode: null }),
    null
  );
  assert.equal(
    validateStockoutEvidence({ eventType: "usage", reasonCode: null }),
    null
  );
  assert.equal(
    validateStockoutEvidence({ eventType: "waste", reasonCode: null }),
    null
  );
});

test("rejects stockout without an allowlisted reason", () => {
  assert.equal(
    (decide(input({ reasonCode: null })) as { reason: string }).reason,
    "stockout_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "   " })) as { reason: string }).reason,
    "stockout_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "ran_out" })) as { reason: string }).reason,
    "invalid_stockout_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "Under_Ordered" })) as { reason: string }).reason,
    "invalid_stockout_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "demo_closeout" })) as { reason: string }).reason,
    "invalid_stockout_reason"
  );
});

test("accepts stockout with each allowlisted reason", () => {
  for (const reasonCode of INVENTORY_STOCKOUT_REASON_CODES) {
    const result = decide(
      input({
        reasonCode,
        clientEventId: `device-stockout-${reasonCode}`,
        idempotencyKey: `stockout:${reasonCode}:ok`
      })
    );
    assert.equal(result.status, "accepted", reasonCode);
  }
});

test("receipt count waste and usage still omit stockout reason requirements", () => {
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

test("hosted stockout-reason failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory stockout events require a reason code"
    }),
    { status: "rejected", reason: "stockout_requires_reason" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory stockout reason code is not allowed"
    }),
    { status: "rejected", reason: "invalid_stockout_reason" }
  );
});

test("additive migration pins the BEFORE INSERT stockout-reason allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_stockout_reason_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_stockout_reason_evidence/
  );
  assert.match(migration, /Inventory stockout events require a reason code/);
  assert.match(migration, /Inventory stockout reason code is not allowed/);
  assert.match(
    migration,
    /'under_ordered',[\s\S]*'unexpected_demand',[\s\S]*'delivery_missed',[\s\S]*'spoilage_cleared',[\s\S]*'theft_loss',[\s\S]*'other'/
  );
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_stockout_reason_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateStockoutEvidence/);
  assert.match(evidence, /stockout_requires_reason/);
  assert.match(evidence, /invalid_stockout_reason/);
  assert.match(evidence, /INVENTORY_STOCKOUT_REASON_CODES/);
  assert.match(
    transport,
    /message\.includes\("stockout events require a reason code"\)/
  );
  assert.match(
    transport,
    /message\.includes\("stockout reason code is not allowed"\)/
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
  assert.match(pgTap, /Inventory stockout events require a reason code/);
  assert.match(pgTap, /Inventory stockout reason code is not allowed/);
  assert.match(pgTap, /'under_ordered'/);
  assert.match(pgTap, /'ran_out'/);
  assert.match(pgTap, /'Under_Ordered'/);
  assert.match(pgTap, /accepted stockout keeps the allowlisted reason_code/);
  assert.match(pgTap, /non-stockout events remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
