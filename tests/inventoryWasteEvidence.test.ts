import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  INVENTORY_WASTE_REASON_CODES,
  isInventoryWasteReasonCode,
  validateWasteEvidence
} from "../services/domain/inventoryWasteEvidence";

const migrationPath =
  "supabase/migrations/20261125230000_inventory_waste_reason_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_waste_reason_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync("services/domain/inventoryWasteEvidence.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "tomatoes",
    eventType: "waste",
    quantity: 250,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: "spoilage",
    clientEventId: "device-event-waste-1",
    idempotencyKey: "waste:spoilage:1",
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

test("waste reason allowlist matches the product writer taxonomy", () => {
  assert.deepEqual([...INVENTORY_WASTE_REASON_CODES], [
    "spoilage",
    "prep_trim",
    "overproduction",
    "dropped_broken",
    "expired",
    "other"
  ]);
  assert.equal(isInventoryWasteReasonCode("spoilage"), true);
  assert.equal(isInventoryWasteReasonCode("prep"), false);
  assert.equal(isInventoryWasteReasonCode("Spoilage"), false);
  assert.equal(isInventoryWasteReasonCode(null), false);
});

test("validateWasteEvidence ignores unrelated event types", () => {
  assert.equal(
    validateWasteEvidence({ eventType: "receipt", reasonCode: null }),
    null
  );
  assert.equal(
    validateWasteEvidence({ eventType: "usage", reasonCode: null }),
    null
  );
  assert.equal(
    validateWasteEvidence({ eventType: "stockout", reasonCode: null }),
    null
  );
});

test("rejects waste without an allowlisted reason", () => {
  assert.equal(
    (decide(input({ reasonCode: null })) as { reason: string }).reason,
    "waste_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "   " })) as { reason: string }).reason,
    "waste_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "prep" })) as { reason: string }).reason,
    "invalid_waste_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "Spoilage" })) as { reason: string }).reason,
    "invalid_waste_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "demo_closeout" })) as { reason: string }).reason,
    "invalid_waste_reason"
  );
});

test("accepts waste with each allowlisted reason", () => {
  for (const reasonCode of INVENTORY_WASTE_REASON_CODES) {
    const result = decide(
      input({
        reasonCode,
        clientEventId: `device-waste-${reasonCode}`,
        idempotencyKey: `waste:${reasonCode}:ok`
      })
    );
    assert.equal(result.status, "accepted", reasonCode);
  }
});

test("receipt count stockout and usage still omit waste reason requirements", () => {
  for (const eventType of ["receipt", "count", "stockout", "usage"] as const) {
    const result = decide(
      input({
        eventType,
        quantity: eventType === "stockout" ? 0 : 100,
        reasonCode: null,
        clientEventId: `device-${eventType}`,
        idempotencyKey: `${eventType}:1`,
        source: `operator_${eventType}`
      })
    );
    assert.equal(result.status, "accepted", eventType);
  }
});

test("hosted waste-reason failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory waste events require a reason code"
    }),
    { status: "rejected", reason: "waste_requires_reason" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory waste reason code is not allowed"
    }),
    { status: "rejected", reason: "invalid_waste_reason" }
  );
});

test("additive migration pins the BEFORE INSERT waste-reason allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_waste_reason_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_waste_reason_evidence/
  );
  assert.match(migration, /Inventory waste events require a reason code/);
  assert.match(migration, /Inventory waste reason code is not allowed/);
  assert.match(
    migration,
    /'spoilage',[\s\S]*'prep_trim',[\s\S]*'overproduction',[\s\S]*'dropped_broken',[\s\S]*'expired',[\s\S]*'other'/
  );
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_waste_reason_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateWasteEvidence/);
  assert.match(evidence, /waste_requires_reason/);
  assert.match(evidence, /invalid_waste_reason/);
  assert.match(evidence, /INVENTORY_WASTE_REASON_CODES/);
  assert.match(
    transport,
    /message\.includes\("waste events require a reason code"\)/
  );
  assert.match(
    transport,
    /message\.includes\("waste reason code is not allowed"\)/
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
  assert.match(pgTap, /Inventory waste events require a reason code/);
  assert.match(pgTap, /Inventory waste reason code is not allowed/);
  assert.match(pgTap, /'spoilage'/);
  assert.match(pgTap, /'prep'/);
  assert.match(pgTap, /'Spoilage'/);
  assert.match(pgTap, /non-waste events remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
