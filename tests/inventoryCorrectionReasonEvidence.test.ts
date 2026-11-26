import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  INVENTORY_CORRECTION_REASON_CODES,
  isInventoryCorrectionReasonCode,
  validateCorrectionReasonEvidence
} from "../services/domain/inventoryCorrectionReasonEvidence";

const migrationPath =
  "supabase/migrations/20261126020000_inventory_correction_reason_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_correction_reason_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryCorrectionReasonEvidence.ts",
  "utf8"
);

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "correction",
    quantity: -100,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_correction",
    sourceReference: null,
    reasonCode: "waste_correction",
    clientEventId: "device-event-1",
    idempotencyKey: "operator_correction:device-event-1",
    // Orphan supersede requirement remains #394; this tip only gates reasons.
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

test("correction reason allowlist matches the product writer taxonomy", () => {
  assert.deepEqual([...INVENTORY_CORRECTION_REASON_CODES], [
    "waste_correction",
    "receipt_correction"
  ]);
  assert.equal(isInventoryCorrectionReasonCode("waste_correction"), true);
  assert.equal(isInventoryCorrectionReasonCode("receipt_correction"), true);
  assert.equal(isInventoryCorrectionReasonCode("manual_fix"), false);
  assert.equal(isInventoryCorrectionReasonCode("Waste_Correction"), false);
  assert.equal(isInventoryCorrectionReasonCode(null), false);
});

test("validateCorrectionReasonEvidence ignores unrelated event types", () => {
  assert.equal(
    validateCorrectionReasonEvidence({ eventType: "receipt", reasonCode: null }),
    null
  );
  assert.equal(
    validateCorrectionReasonEvidence({ eventType: "waste", reasonCode: null }),
    null
  );
  assert.equal(
    validateCorrectionReasonEvidence({ eventType: "usage", reasonCode: null }),
    null
  );
});

test("rejects correction without an allowlisted reason", () => {
  assert.equal(
    (decide(input({ reasonCode: null })) as { reason: string }).reason,
    "correction_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "   " })) as { reason: string }).reason,
    "correction_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "manual_fix" })) as { reason: string }).reason,
    "invalid_correction_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "Waste_Correction" })) as { reason: string }).reason,
    "invalid_correction_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "demo_correction" })) as { reason: string }).reason,
    "invalid_correction_reason"
  );
});

test("accepts correction with each allowlisted reason", () => {
  for (const reasonCode of INVENTORY_CORRECTION_REASON_CODES) {
    const result = decide(
      input({
        reasonCode,
        clientEventId: `device-correction-${reasonCode}`,
        idempotencyKey: `correction:${reasonCode}:ok`
      })
    );
    assert.equal(result.status, "accepted", reasonCode);
  }
});

test("receipt count waste and usage still omit correction reason requirements", () => {
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

test("hosted correction-reason failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory correction events require a reason code"
    }),
    { status: "rejected", reason: "correction_requires_reason" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory correction reason code is not allowed"
    }),
    { status: "rejected", reason: "invalid_correction_reason" }
  );
});

test("additive migration pins the BEFORE INSERT correction-reason allowlist", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_correction_reason_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_correction_reason_evidence/
  );
  assert.match(migration, /Inventory correction events require a reason code/);
  assert.match(migration, /Inventory correction reason code is not allowed/);
  assert.match(
    migration,
    /'waste_correction',[\s\S]*'receipt_correction'/
  );
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_correction_reason_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateCorrectionReasonEvidence/);
  assert.match(evidence, /correction_requires_reason/);
  assert.match(evidence, /invalid_correction_reason/);
  assert.match(evidence, /INVENTORY_CORRECTION_REASON_CODES/);
  assert.match(
    transport,
    /message\.includes\("correction events require a reason code"\)/
  );
  assert.match(
    transport,
    /message\.includes\("correction reason code is not allowed"\)/
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
  assert.match(pgTap, /Inventory correction events require a reason code/);
  assert.match(pgTap, /Inventory correction reason code is not allowed/);
  assert.match(pgTap, /'waste_correction'/);
  assert.match(pgTap, /'manual_fix'/);
  assert.match(pgTap, /'Waste_Correction'/);
  assert.match(pgTap, /non-correction events remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
