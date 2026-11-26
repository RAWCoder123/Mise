import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import { validateActorUserIdEvidence } from "../services/domain/inventoryActorUserIdEvidence";

const migrationPath =
  "supabase/migrations/20261126080000_inventory_actor_userid_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_actor_userid_evidence.test.sql",
  "utf8"
);
const transport = readFileSync("services/domain/inventoryEventTransport.ts", "utf8");
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const evidence = readFileSync(
  "services/domain/inventoryActorUserIdEvidence.ts",
  "utf8"
);

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "rest-actor-userid-1",
    inventoryItemId: "item-actor-userid-1",
    eventType: "adjustment",
    quantity: 1,
    canonicalUnit: "g",
    effectiveAt: "2026-11-26T12:00:00.000Z",
    source: "operator_adjustment",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-actor-userid-1",
    idempotencyKey: "adjustment:actor-userid:1",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function decide(
  candidate: InventoryEventInput,
  authorityOverrides: Partial<{ id: string; actorUserId: string | null; recordedAt: string }> = {}
) {
  return acceptInventoryEvent({
    existingEvents: [],
    candidate,
    authority: {
      id: "evt-actor-userid-1",
      actorUserId: "user-manager-1",
      recordedAt: "2026-11-26T12:00:01.000Z",
      ...authorityOverrides
    }
  });
}

test("validateActorUserIdEvidence rejects null, undefined, and blank actors", () => {
  assert.equal(validateActorUserIdEvidence({ actorUserId: null }), "missing_actor_user_id");
  assert.equal(
    validateActorUserIdEvidence({ actorUserId: undefined }),
    "missing_actor_user_id"
  );
  assert.equal(validateActorUserIdEvidence({ actorUserId: "" }), "missing_actor_user_id");
  assert.equal(validateActorUserIdEvidence({ actorUserId: "   " }), "missing_actor_user_id");
});

test("validateActorUserIdEvidence accepts a non-empty actor id", () => {
  assert.equal(validateActorUserIdEvidence({ actorUserId: "user-manager-1" }), null);
});

test("acceptInventoryEvent rejects missing actor attribution", () => {
  assert.equal(
    (
      decide(input({ clientEventId: "device-actor-null", idempotencyKey: "adj:actor-null" }), {
        actorUserId: null
      }) as { reason: string }
    ).reason,
    "missing_actor_user_id"
  );
  assert.equal(
    (
      decide(input({ clientEventId: "device-actor-blank", idempotencyKey: "adj:actor-blank" }), {
        actorUserId: "   "
      }) as { reason: string }
    ).reason,
    "missing_actor_user_id"
  );
});

test("acceptInventoryEvent accepts a real actor", () => {
  const accepted = decide(
    input({ clientEventId: "device-actor-ok", idempotencyKey: "adj:actor-ok" })
  );
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") {
    assert.equal(accepted.event.actorUserId, "user-manager-1");
  }
});

test("transport maps hosted actor-required rejection messages", () => {
  assert.equal(
    (
      inventoryEventRejectionFromRpcError({
        code: "22023",
        message: "Inventory event actor is required"
      }) as { reason: string }
    ).reason,
    "missing_actor_user_id"
  );
});

test("additive migration pins the BEFORE INSERT actor guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_inventory_actor_userid_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*enforce_inventory_actor_userid_evidence/
  );
  assert.match(migration, /Inventory event actor is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(migration, /alter\s+column\s+actor_user_id\s+set\s+not\s+null/i);
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}actor_user_id\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.doesNotMatch(migration, /create or replace function private\.reject_inventory_event_mutation/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_actor_userid_evidence\(\)[\s\S]*service_role/
  );
  assert.match(ledger, /validateActorUserIdEvidence/);
  assert.match(evidence, /missing_actor_user_id/);
  assert.match(transport, /actor is required/);
  assert.match(transport, /missing_actor_user_id/);
});

test("pgTAP plan equals assertion call sites and covers null insert plus anonymization", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch![1]);
  const assertionSites = [
    ...pgTap.matchAll(/^select (is|isnt|ok|matches|has_function)\(/gm)
  ].length;
  assert.equal(planned, assertionSites);
  assert.match(pgTap, /Inventory event actor is required/);
  assert.match(pgTap, /actor_user_id is null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /record_inventory_event/);
});
