import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  INVENTORY_REASON_CODE_SLUG_PATTERN,
  isInventoryReasonCodeSlug,
  validateReasonCodeSlugEvidence
} from "../services/domain/inventoryReasonCodeSlugEvidence";

const migrationPath =
  "supabase/migrations/20261126070000_inventory_reason_code_slug_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_reason_code_slug_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryReasonCodeSlugEvidence.ts",
  "utf8"
);

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "rest-reason-slug-1",
    inventoryItemId: "item-reason-slug-1",
    eventType: "adjustment",
    quantity: 1,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T12:00:00.000Z",
    source: "operator_adjustment",
    sourceReference: null,
    reasonCode: "spoilage",
    clientEventId: "device-reason-slug-1",
    idempotencyKey: "adjustment:reason-slug:1",
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
      id: "evt-reason-slug-1",
      actorUserId: "user-manager-1",
      recordedAt: "2026-11-26T12:00:01.000Z"
    }
  });
}

test("slug pattern matches emergency operational-mode reason shape", () => {
  assert.equal(INVENTORY_REASON_CODE_SLUG_PATTERN.source, "^[a-z0-9_]{3,64}$");
  assert.equal(isInventoryReasonCodeSlug("spoilage"), true);
  assert.equal(isInventoryReasonCodeSlug("station_transfer"), true);
  assert.equal(isInventoryReasonCodeSlug("other"), true);
  assert.equal(isInventoryReasonCodeSlug("ab"), false);
  assert.equal(isInventoryReasonCodeSlug("Spoilage"), false);
  assert.equal(isInventoryReasonCodeSlug("bad code"), false);
  assert.equal(isInventoryReasonCodeSlug("bad-code"), false);
  assert.equal(isInventoryReasonCodeSlug("a".repeat(65)), false);
  assert.equal(isInventoryReasonCodeSlug(null), false);
});

test("validateReasonCodeSlugEvidence ignores absent or blank codes", () => {
  assert.equal(validateReasonCodeSlugEvidence({ reasonCode: null }), null);
  assert.equal(validateReasonCodeSlugEvidence({ reasonCode: "" }), null);
  assert.equal(validateReasonCodeSlugEvidence({ reasonCode: "   " }), null);
});

test("rejects non-slug reason codes", () => {
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-reason-slug-space",
          idempotencyKey: "adjustment:reason-slug:space",
          reasonCode: "bad code"
        })
      ) as { reason: string }
    ).reason,
    "invalid_reason_code_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-reason-slug-case",
          idempotencyKey: "adjustment:reason-slug:case",
          reasonCode: "Spoilage"
        })
      ) as { reason: string }
    ).reason,
    "invalid_reason_code_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-reason-slug-short",
          idempotencyKey: "adjustment:reason-slug:short",
          reasonCode: "ab"
        })
      ) as { reason: string }
    ).reason,
    "invalid_reason_code_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-reason-slug-hyphen",
          idempotencyKey: "adjustment:reason-slug:hyphen",
          reasonCode: "bad-code"
        })
      ) as { reason: string }
    ).reason,
    "invalid_reason_code_shape"
  );
  assert.equal(
    (
      decide(
        input({
          clientEventId: "device-reason-slug-long",
          idempotencyKey: "adjustment:reason-slug:long",
          reasonCode: "a".repeat(65)
        })
      ) as { reason: string }
    ).reason,
    "invalid_reason_code_shape"
  );
});

test("accepts slug reason codes and null reasons", () => {
  const withSlug = decide(
    input({
      clientEventId: "device-reason-slug-ok",
      idempotencyKey: "adjustment:reason-slug:ok"
    })
  );
  assert.equal(withSlug.status, "accepted");

  const withoutReason = decide(
    input({
      clientEventId: "device-reason-slug-null",
      idempotencyKey: "adjustment:reason-slug:null",
      reasonCode: null
    })
  );
  assert.equal(withoutReason.status, "accepted");
});

test("transport maps hosted reason_code slug rejection messages", () => {
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory event reason code must be a slug"
      }) as { reason: string }
    ).reason,
    "invalid_reason_code_shape"
  );
});

test("additive migration pins the BEFORE INSERT reason_code slug guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_reason_code_slug_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_reason_code_slug_evidence/
  );
  assert.match(migration, /Inventory event reason code must be a slug/);
  assert.match(migration, /\^\[a-z0-9_\]\{3,64\}\$/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_reason_code_slug_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateReasonCodeSlugEvidence/);
  assert.match(evidence, /invalid_reason_code_shape/);
  assert.match(evidence, /INVENTORY_REASON_CODE_SLUG_PATTERN/);
  assert.match(transport, /reason code must be a slug/);
  assert.match(transport, /invalid_reason_code_shape/);
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
  assert.match(pgTap, /Inventory event reason code must be a slug/);
  assert.match(pgTap, /spaced reason_code/);
  assert.match(pgTap, /case-variant reason_code/);
  assert.match(pgTap, /too-short reason_code/);
  assert.match(pgTap, /hyphenated reason_code/);
  assert.match(pgTap, /overlong reason_code/);
  assert.match(pgTap, /slug reason_code/);
  assert.match(pgTap, /null reason_code remain unconstrained/);
  assert.match(pgTap, /direct inventory_events insert cannot bypass/);
});
