import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  INVENTORY_SOURCE_SLUG_PATTERN,
  isInventorySourceSlug,
  validateSourceSlugEvidence
} from "../services/domain/inventorySourceSlugEvidence";

const migrationPath =
  "supabase/migrations/20261126090000_inventory_source_slug_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_source_slug_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventorySourceSlugEvidence.ts",
  "utf8"
);

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "rest-source-slug-1",
    inventoryItemId: "item-source-slug-1",
    eventType: "adjustment",
    quantity: 1,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T12:00:00.000Z",
    source: "operator_adjustment",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-source-slug-1",
    idempotencyKey: "adjustment:source-slug:1",
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
      id: "evt-source-slug-1",
      actorUserId: "user-manager-1",
      recordedAt: "2026-11-26T12:00:01.000Z"
    }
  });
}

test("slug pattern matches product inventory source shape", () => {
  assert.equal(INVENTORY_SOURCE_SLUG_PATTERN.source, "^[a-z0-9_]{3,80}$");
  assert.equal(isInventorySourceSlug("operator_adjustment"), true);
  assert.equal(isInventorySourceSlug("supplier_delivery"), true);
  assert.equal(isInventorySourceSlug("approve_count_session"), true);
  assert.equal(isInventorySourceSlug("ab"), false);
  assert.equal(isInventorySourceSlug("Operator_Adjustment"), false);
  assert.equal(isInventorySourceSlug("bad source"), false);
  assert.equal(isInventorySourceSlug("bad-source"), false);
  assert.equal(isInventorySourceSlug(" operator_adjustment"), false);
  assert.equal(isInventorySourceSlug("a".repeat(81)), false);
  assert.equal(isInventorySourceSlug("a".repeat(80)), true);
  assert.equal(isInventorySourceSlug(null), false);
});

test("validateSourceSlugEvidence rejects blank and non-slug sources", () => {
  assert.equal(validateSourceSlugEvidence({ source: "" }), "invalid_source_shape");
  assert.equal(validateSourceSlugEvidence({ source: "   " }), "invalid_source_shape");
  assert.equal(
    validateSourceSlugEvidence({ source: "operator_adjustment" }),
    null
  );
});

test("rejects non-slug sources before accept", () => {
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-space",
          idempotencyKey: "adjustment:source-slug:space",
          source: "bad source"
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-case",
          idempotencyKey: "adjustment:source-slug:case",
          source: "Operator_Adjustment"
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-short",
          idempotencyKey: "adjustment:source-slug:short",
          source: "ab"
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-hyphen",
          idempotencyKey: "adjustment:source-slug:hyphen",
          source: "bad-source"
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-padded",
          idempotencyKey: "adjustment:source-slug:padded",
          source: " operator_adjustment"
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-long",
          idempotencyKey: "adjustment:source-slug:long",
          source: "a".repeat(81)
        })
      ) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
});

test("blank source stays missing_source ahead of the slug gate", () => {
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-source-slug-blank",
          idempotencyKey: "adjustment:source-slug:blank",
          source: "   "
        })
      ) as { reason: string }
    ).reason,
    "missing_source"
  );
});

test("accepts slug sources used by product writers", () => {
  const withSlug = decide(
    input({
      clientEventId: "device-source-slug-ok",
      idempotencyKey: "adjustment:source-slug:ok"
    })
  );
  assert.equal(withSlug.status, "accepted");

  const receipt = decide(
    input({
      eventType: "receipt",
      quantity: 10,
      source: "operator_receipt",
      clientEventId: "device-source-slug-receipt",
      idempotencyKey: "receipt:source-slug:ok"
    })
  );
  assert.equal(receipt.status, "accepted");
});

test("transport maps hosted source slug rejection messages", () => {
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory event source must be a slug"
      }) as { reason: string }
    ).reason,
    "invalid_source_shape"
  );
});

test("additive migration pins the BEFORE INSERT source slug guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_source_slug_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_source_slug_evidence/
  );
  assert.match(migration, /Inventory event source must be a slug/);
  assert.match(migration, /\^\[a-z0-9_\]\{3,80\}\$/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_source_slug_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateSourceSlugEvidence/);
  assert.match(evidence, /invalid_source_shape/);
  assert.match(evidence, /INVENTORY_SOURCE_SLUG_PATTERN/);
  assert.match(transport, /source must be a slug/);
  assert.match(transport, /invalid_source_shape/);
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
  assert.match(pgTap, /Inventory event source must be a slug/);
  assert.match(pgTap, /spaced source/);
  assert.match(pgTap, /case-variant source/);
  assert.match(pgTap, /too-short source/);
  assert.match(pgTap, /hyphenated source/);
  assert.match(pgTap, /padded source/);
  assert.match(pgTap, /slug source/);
  assert.match(pgTap, /operator_receipt remains allowed/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
