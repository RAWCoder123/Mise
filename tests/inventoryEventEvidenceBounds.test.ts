import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  INVENTORY_EVENT_METADATA_MAX_BYTES,
  INVENTORY_EVENT_REASON_CODE_MAX_LENGTH,
  INVENTORY_EVENT_SOURCE_REFERENCE_MAX_LENGTH,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125140000_bound_inventory_event_evidence_fields.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_event_evidence_bounds.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_receipt",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "operator_receipt:device-event-1",
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

test("domain rejects oversized inventory event metadata before outbox replay", () => {
  const oversized = accept(
    input({
      metadata: { note: "x".repeat(INVENTORY_EVENT_METADATA_MAX_BYTES) }
    })
  );
  assert.equal(oversized.status, "rejected");
  if (oversized.status === "rejected") {
    assert.equal(oversized.reason, "oversized_metadata");
  }
});

test("domain rejects oversized source_reference and reason_code", () => {
  const reference = accept(
    input({
      sourceReference: "r".repeat(INVENTORY_EVENT_SOURCE_REFERENCE_MAX_LENGTH + 1)
    })
  );
  assert.equal(reference.status, "rejected");
  if (reference.status === "rejected") {
    assert.equal(reference.reason, "oversized_source_reference");
  }

  const reason = accept(
    input({
      eventType: "waste",
      quantity: 10,
      reasonCode: "w".repeat(INVENTORY_EVENT_REASON_CODE_MAX_LENGTH + 1)
    })
  );
  assert.equal(reason.status, "rejected");
  if (reason.status === "rejected") {
    assert.equal(reason.reason, "oversized_reason_code");
  }
});

test("domain still accepts inventory evidence at the exact hosted bounds", () => {
  const accepted = accept(
    input({
      sourceReference: "r".repeat(INVENTORY_EVENT_SOURCE_REFERENCE_MAX_LENGTH),
      reasonCode: "c".repeat(INVENTORY_EVENT_REASON_CODE_MAX_LENGTH),
      metadata: { note: "n".repeat(500) }
    })
  );
  assert.equal(accepted.status, "accepted");
});

test("hosted oversized evidence failures settle as terminal outbox reasons", () => {
  const metadata = inventoryEventRejectionFromRpcError({
    code: "22023",
    message: "Inventory event metadata exceeds the bounded size"
  });
  assert.equal(metadata?.status, "rejected");
  if (metadata?.status === "rejected") {
    assert.equal(metadata.reason, "oversized_metadata");
  }

  const reference = inventoryEventRejectionFromRpcError({
    code: "22023",
    message: "Inventory event source reference exceeds the bounded length"
  });
  assert.equal(reference?.status, "rejected");
  if (reference?.status === "rejected") {
    assert.equal(reference.reason, "oversized_source_reference");
  }

  const reason = inventoryEventRejectionFromRpcError({
    code: "22023",
    message: "Inventory event reason code exceeds the bounded length"
  });
  assert.equal(reason?.status, "rejected");
  if (reason?.status === "rejected") {
    assert.equal(reason.reason, "oversized_reason_code");
  }
});

test("migration pins the oversized evidence trigger, 22023 messages, and CHECK bounds", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_oversized_inventory_event_evidence/i
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_oversized_inventory_event_evidence/i
  );
  assert.match(migration, /Inventory event metadata exceeds the bounded size/);
  assert.match(migration, /Inventory event source reference exceeds the bounded length/);
  assert.match(migration, /Inventory event reason code exceeds the bounded length/);
  assert.match(migration, /errcode\s*=\s*'22023'/);
  assert.match(
    migration,
    /inventory_events_metadata_bound_check[\s\S]*pg_column_size\(metadata\)\s*<=\s*8192/i
  );
  assert.match(
    migration,
    /inventory_events_source_reference_bound_check[\s\S]*char_length\(source_reference\)\s*<=\s*200/i
  );
  assert.match(
    migration,
    /inventory_events_reason_code_bound_check[\s\S]*char_length\(reason_code\)\s*<=\s*80/i
  );
  assert.doesNotMatch(migration, /drop policy|grant insert|grant update|grant delete/i);
});

test("pgTAP plan is derived from assertion call sites and matches exact error messages", () => {
  const assertionSites = pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? [];
  assert.equal(assertionSites.length, 7);
  assert.match(pgTap, /select plan\(7\);/);
  assert.match(pgTap, /Inventory event metadata exceeds the bounded size/);
  assert.match(pgTap, /Inventory event source reference exceeds the bounded length/);
  assert.match(pgTap, /Inventory event reason code exceeds the bounded length/);
});

test("domain and transport keep oversized evidence reasons ahead of generic matchers", () => {
  assert.match(ledger, /oversized_metadata/);
  assert.match(ledger, /oversized_source_reference/);
  assert.match(ledger, /oversized_reason_code/);
  assert.match(
    transport,
    /metadata exceeds the bounded size[\s\S]*oversized_metadata[\s\S]*includes\("evidence"\)/
  );
});
