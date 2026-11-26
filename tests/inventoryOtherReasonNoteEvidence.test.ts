import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  inventoryOtherReasonNoteFromMetadata,
  validateOtherReasonNoteEvidence
} from "../services/domain/inventoryOtherReasonNoteEvidence";

const migrationPath =
  "supabase/migrations/20261126030000_inventory_other_reason_note_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_other_reason_note_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryOtherReasonNoteEvidence.ts",
  "utf8"
);

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
    reasonCode: "other",
    clientEventId: "device-event-other-1",
    idempotencyKey: "waste:other:1",
    supersedesEventId: null,
    metadata: { note: "Vendor sent wrong variety" },
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

test("note helper trims and rejects blank metadata notes", () => {
  assert.equal(inventoryOtherReasonNoteFromMetadata({ note: "  fix  " }), "fix");
  assert.equal(inventoryOtherReasonNoteFromMetadata({ note: "   " }), null);
  assert.equal(inventoryOtherReasonNoteFromMetadata({ note: 12 }), null);
  assert.equal(inventoryOtherReasonNoteFromMetadata({}), null);
  assert.equal(inventoryOtherReasonNoteFromMetadata(null), null);
});

test("validateOtherReasonNoteEvidence only constrains waste/stockout other", () => {
  assert.equal(
    validateOtherReasonNoteEvidence({
      eventType: "receipt",
      reasonCode: "other",
      metadata: {}
    }),
    null
  );
  assert.equal(
    validateOtherReasonNoteEvidence({
      eventType: "waste",
      reasonCode: "spoilage",
      metadata: {}
    }),
    null
  );
  assert.equal(
    validateOtherReasonNoteEvidence({
      eventType: "waste",
      reasonCode: "other",
      metadata: { note: "Mis-labeled case" }
    }),
    null
  );
  assert.equal(
    validateOtherReasonNoteEvidence({
      eventType: "waste",
      reasonCode: "other",
      metadata: {}
    }),
    "waste_other_requires_note"
  );
  assert.equal(
    validateOtherReasonNoteEvidence({
      eventType: "stockout",
      reasonCode: "other",
      metadata: { note: " \t " }
    }),
    "stockout_other_requires_note"
  );
  assert.equal(
    validateOtherReasonNoteEvidence({
      eventType: "waste",
      reasonCode: "Other",
      metadata: {}
    }),
    null
  );
});

test("domain rejects waste other without a non-empty note", () => {
  const bare = decide(input({ metadata: {} }));
  assert.equal(bare.status, "rejected");
  if (bare.status === "rejected") {
    assert.equal(bare.reason, "waste_other_requires_note");
  }

  const blank = decide(input({ metadata: { note: "  " } }));
  assert.equal(blank.status, "rejected");
  if (blank.status === "rejected") {
    assert.equal(blank.reason, "waste_other_requires_note");
  }

  const nonString = decide(input({ metadata: { note: 7 } }));
  assert.equal(nonString.status, "rejected");
  if (nonString.status === "rejected") {
    assert.equal(nonString.reason, "waste_other_requires_note");
  }
});

test("domain rejects stockout other without a non-empty note", () => {
  const bare = decide(
    input({
      eventType: "stockout",
      quantity: 0,
      source: "operator_stockout",
      clientEventId: "device-stockout-other-1",
      idempotencyKey: "stockout:other:1",
      metadata: {}
    })
  );
  assert.equal(bare.status, "rejected");
  if (bare.status === "rejected") {
    assert.equal(bare.reason, "stockout_other_requires_note");
  }
});

test("domain accepts noted other and named-reason waste without notes", () => {
  const noted = decide(input());
  assert.equal(noted.status, "accepted");

  const padded = decide(
    input({
      metadata: { note: "  padded ok  " },
      clientEventId: "device-waste-other-padded",
      idempotencyKey: "waste:other:padded"
    })
  );
  assert.equal(padded.status, "accepted");

  const named = decide(
    input({
      reasonCode: "spoilage",
      metadata: {},
      clientEventId: "device-waste-spoilage",
      idempotencyKey: "waste:spoilage:1"
    })
  );
  assert.equal(named.status, "accepted");

  const stockoutNoted = decide(
    input({
      eventType: "stockout",
      quantity: 0,
      source: "operator_stockout",
      reasonCode: "other",
      metadata: { note: "Walk-in cooler failure" },
      clientEventId: "device-stockout-other-ok",
      idempotencyKey: "stockout:other:ok"
    })
  );
  assert.equal(stockoutNoted.status, "accepted");

  const receipt = decide(
    input({
      eventType: "receipt",
      source: "operator_receipt",
      quantity: 1000,
      reasonCode: null,
      metadata: {},
      clientEventId: "receipt-event-1",
      idempotencyKey: "operator_receipt:receipt-event-1"
    })
  );
  assert.equal(receipt.status, "accepted");
});

test("hosted other-reason note failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory waste events with reason other require a note"
    }),
    { status: "rejected", reason: "waste_other_requires_note" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory stockout events with reason other require a note"
    }),
    { status: "rejected", reason: "stockout_other_requires_note" }
  );
});

test("additive migration pins the BEFORE INSERT other-reason note requirement", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_other_reason_note_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_other_reason_note_evidence/
  );
  assert.match(migration, /Inventory waste events with reason other require a note/);
  assert.match(migration, /Inventory stockout events with reason other require a note/);
  assert.match(migration, /metadata ->> 'note'/);
  assert.match(migration, /reason_code = 'other'/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_other_reason_note_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateOtherReasonNoteEvidence/);
  assert.match(evidence, /waste_other_requires_note/);
  assert.match(evidence, /stockout_other_requires_note/);
  assert.match(
    transport,
    /message\.includes\("waste events with reason other require a note"\)/
  );
  assert.match(
    transport,
    /message\.includes\("stockout events with reason other require a note"\)/
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
  assert.match(pgTap, /Inventory waste events with reason other require a note/);
  assert.match(pgTap, /Inventory stockout events with reason other require a note/);
  assert.match(pgTap, /'\{\}'::jsonb/);
  assert.match(pgTap, /"note":"   "/);
  assert.match(pgTap, /Vendor sent wrong variety/);
  assert.match(pgTap, /Walk-in cooler failure/);
  assert.match(pgTap, /'spoilage'/);
  assert.match(pgTap, /named waste reasons remain note-optional/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
