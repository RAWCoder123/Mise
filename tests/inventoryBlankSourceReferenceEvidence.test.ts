import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import { validateSourceReferenceEvidence } from "../services/domain/inventorySourceReferenceEvidence";

const migrationPath =
  "supabase/migrations/20261126100000_inventory_blank_source_reference_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_blank_source_reference_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventorySourceReferenceEvidence.ts",
  "utf8"
);

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "rest-blank-source-ref-1",
    inventoryItemId: "item-blank-source-ref-1",
    eventType: "adjustment",
    quantity: 1,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T12:00:00.000Z",
    source: "operator_adjustment",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-blank-source-ref-1",
    idempotencyKey: "adjustment:blank-source-ref:1",
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
      id: "evt-blank-source-ref-1",
      actorUserId: "user-manager-1",
      recordedAt: "2026-11-26T12:00:01.000Z"
    }
  });
}

test("validateSourceReferenceEvidence rejects blank and padded references", () => {
  assert.equal(validateSourceReferenceEvidence({ sourceReference: null }), null);
  assert.equal(
    validateSourceReferenceEvidence({ sourceReference: "" }),
    "invalid_source_reference_shape"
  );
  assert.equal(
    validateSourceReferenceEvidence({ sourceReference: "   " }),
    "invalid_source_reference_shape"
  );
  assert.equal(
    validateSourceReferenceEvidence({ sourceReference: "\t\n" }),
    "invalid_source_reference_shape"
  );
  assert.equal(
    validateSourceReferenceEvidence({ sourceReference: "  delivery-1  " }),
    "invalid_source_reference_shape"
  );
  assert.equal(
    validateSourceReferenceEvidence({ sourceReference: "delivery-1" }),
    null
  );
});

test("rejects blank and padded source references before accept", () => {
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-blank-source-ref-spaces",
          idempotencyKey: "adjustment:blank-source-ref:spaces",
          sourceReference: "   "
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_reference_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-blank-source-ref-padded",
          idempotencyKey: "adjustment:blank-source-ref:padded",
          sourceReference: "  delivery-1  "
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_reference_shape"
  );
});

test("accepts null and trimmed source references", () => {
  const withNull = decide(
    input({
      clientEventId: "device-blank-source-ref-null",
      idempotencyKey: "adjustment:blank-source-ref:null"
    })
  );
  assert.equal(withNull.status, "accepted");

  const withTrimmed = decide(
    input({
      clientEventId: "device-blank-source-ref-ok",
      idempotencyKey: "adjustment:blank-source-ref:ok",
      sourceReference: "delivery-1"
    })
  );
  assert.equal(withTrimmed.status, "accepted");
});

test("transport maps hosted blank source reference rejection messages", () => {
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory event source reference must be non-blank and unpadded"
      }) as { reason: string }
    ).reason,
    "invalid_source_reference_shape"
  );
});

test("additive migration pins the BEFORE INSERT blank source_reference guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_blank_source_reference_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_blank_source_reference_evidence/
  );
  assert.match(
    migration,
    /Inventory event source reference must be non-blank and unpadded/
  );
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_blank_source_reference_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateSourceReferenceEvidence/);
  assert.match(evidence, /invalid_source_reference_shape/);
  assert.match(transport, /source reference must be non-blank and unpadded/);
  assert.match(transport, /invalid_source_reference_shape/);
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
  assert.equal(planned, 10);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(pgTap, /Inventory event source reference must be non-blank and unpadded/);
  assert.match(pgTap, /whitespace-only source_reference/);
  assert.match(pgTap, /tab\/newline-only source_reference/);
  assert.match(pgTap, /padded source_reference/);
  assert.match(pgTap, /RPC blank source_reference still nullifies/);
  assert.match(pgTap, /RPC padded source_reference still trims/);
  assert.match(pgTap, /trimmed non-empty source_reference/);
  assert.match(pgTap, /allows null source_reference/);
});
