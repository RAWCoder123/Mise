import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  inventoryCorrectionNoteFromMetadata,
  validateCorrectionEvidence
} from "../services/domain/inventoryCorrectionEvidence";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261126010000_inventory_correction_note_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_correction_note_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryCorrectionEvidence.ts",
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
    // Orphan supersede requirement remains #394; this tip only gates notes.
    supersedesEventId: null,
    metadata: { note: "Mistaken waste entry" },
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

test("note helper trims and rejects blank metadata notes", () => {
  assert.equal(inventoryCorrectionNoteFromMetadata({ note: "  fix  " }), "fix");
  assert.equal(inventoryCorrectionNoteFromMetadata({ note: "   " }), null);
  assert.equal(inventoryCorrectionNoteFromMetadata({ note: 12 }), null);
  assert.equal(inventoryCorrectionNoteFromMetadata({}), null);
  assert.equal(inventoryCorrectionNoteFromMetadata(null), null);
});

test("validateCorrectionEvidence only constrains correction rows", () => {
  assert.equal(
    validateCorrectionEvidence({ eventType: "receipt", metadata: {} }),
    null
  );
  assert.equal(
    validateCorrectionEvidence({
      eventType: "correction",
      metadata: { note: "Fixed receiving error" }
    }),
    null
  );
  assert.equal(
    validateCorrectionEvidence({ eventType: "correction", metadata: {} }),
    "correction_requires_note"
  );
  assert.equal(
    validateCorrectionEvidence({
      eventType: "correction",
      metadata: { note: " \t " }
    }),
    "correction_requires_note"
  );
});

test("domain rejects corrections without a non-empty note", () => {
  const bare = accept(input({ metadata: {} }));
  assert.equal(bare.status, "rejected");
  if (bare.status === "rejected") {
    assert.equal(bare.reason, "correction_requires_note");
  }

  const blank = accept(input({ metadata: { note: "  " } }));
  assert.equal(blank.status, "rejected");
  if (blank.status === "rejected") {
    assert.equal(blank.reason, "correction_requires_note");
  }

  const nonString = accept(input({ metadata: { note: 7 } }));
  assert.equal(nonString.status, "rejected");
  if (nonString.status === "rejected") {
    assert.equal(nonString.reason, "correction_requires_note");
  }
});

test("domain still accepts noted corrections and non-correction events", () => {
  const correction = accept(input());
  assert.equal(correction.status, "accepted");

  const receipt = accept(
    input({
      eventType: "receipt",
      source: "operator_receipt",
      quantity: 1000,
      reasonCode: null,
      supersedesEventId: null,
      metadata: {},
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
      reasonCode: null,
      supersedesEventId: null,
      metadata: {},
      clientEventId: "waste-event-1",
      idempotencyKey: "operator_waste:waste-event-1"
    })
  );
  assert.equal(waste.status, "accepted");
});

test("hosted missing correction-note failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory correction events require a note"
    }),
    { status: "rejected", reason: "correction_requires_note" }
  );
});

test("additive migration pins the BEFORE INSERT correction-note requirement", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_correction_note_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_correction_note_evidence/
  );
  assert.match(migration, /Inventory correction events require a note/);
  assert.match(migration, /metadata ->> 'note'/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_correction_note_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateCorrectionEvidence/);
  assert.match(evidence, /correction_requires_note/);
  assert.match(
    transport,
    /message\.includes\("correction events require a note"\)\) return "correction_requires_note"/
  );
});

test("pgTAP plan equals assertion call sites and covers bare plus legitimate paths", () => {
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
  assert.match(pgTap, /Inventory correction events require a note/);
  assert.match(pgTap, /'\{\}'::jsonb/);
  assert.match(pgTap, /"note":"   "/);
  assert.match(pgTap, /Mistaken waste entry/);
  assert.match(pgTap, /padded ok/);
  assert.match(
    pgTap,
    /non-correction inventory events remain unconstrained by the correction note rule/
  );
});
