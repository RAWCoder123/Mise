import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migrationPath =
  "supabase/migrations/20261125130000_reject_forged_mise_attributed_inventory_sources.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/mise_attributed_inventory_source.test.sql",
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

test("domain rejects mise-prefixed inventory sources that forge Activity attribution", () => {
  const forged = accept(input({ source: "mise_auto" }));
  assert.equal(forged.status, "rejected");
  if (forged.status === "rejected") {
    assert.equal(forged.reason, "forged_mise_attribution_source");
  }

  const mixedCase = accept(input({ source: "MiseLearning", eventType: "waste", quantity: 10 }));
  assert.equal(mixedCase.status, "rejected");
  if (mixedCase.status === "rejected") {
    assert.equal(mixedCase.reason, "forged_mise_attribution_source");
  }
});

test("domain still accepts ordinary operator inventory sources", () => {
  const operator = accept(input());
  assert.equal(operator.status, "accepted");

  const delivery = accept(
    input({
      source: "supplier_delivery",
      sourceReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      reasonCode: "supplier_delivery"
    })
  );
  assert.equal(delivery.status, "accepted");
});

test("hosted mise-attribution failures settle as terminal outbox reasons", () => {
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Inventory event source cannot claim Mise attribution"
    }),
    { status: "rejected", reason: "forged_mise_attribution_source" }
  );
});

test("additive migration pins the BEFORE INSERT guard and activity actor_type fix", () => {
  assert.match(
    migration,
    /create or replace function private\.reject_forged_mise_attributed_inventory_source\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.inventory_events[\s\S]*reject_forged_mise_attributed_inventory_source/
  );
  assert.match(
    migration,
    /Inventory event source cannot claim Mise attribution/
  );
  assert.match(
    migration,
    /auth\.uid\(\) is not null[\s\S]*like 'mise%'/
  );
  assert.match(
    migration,
    /case when new\.actor_user_id is null then 'mise' else 'user' end/
  );
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_forged_mise_attributed_inventory_source\(\)[\s\S]*service_role/
  );
  assert.match(
    ledger,
    /forged_mise_attribution_source/
  );
  assert.match(
    transport,
    /message\.includes\("mise attribution"\)\) return "forged_mise_attribution_source"/
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
  assert.match(pgTap, /Inventory event source cannot claim Mise attribution/);
  assert.match(pgTap, /'mise_auto'/);
  assert.match(pgTap, /'operator_receipt'/);
  assert.match(pgTap, /actor_type follows actor_user_id/);
});
