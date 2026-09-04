import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptInventoryEvent,
  type InventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  clientComparableInventoryEventMetadata,
  stampStockoutQuantityBeforeMetadata,
  STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY,
  STOCKOUT_QUANTITY_BEFORE_METADATA_KEY
} from "../services/domain/stockoutQuantityBefore";

const migration = readFileSync(
  "supabase/migrations/20260904080000_stockout_quantity_before_metadata.sql",
  "utf8"
);

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-09-04T10:00:00.000Z",
    source: "operator_stockout",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "device-stockout-1",
    idempotencyKey: "inventory:device-stockout-1",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

test("migration stamps stockout quantity_before and ignores it for idempotency", () => {
  assert.match(migration, /create or replace function private\.stamp_stockout_inventory_event_quantity_before/i);
  assert.match(migration, /before insert on public\.inventory_events/i);
  assert.match(migration, /quantity_before/i);
  assert.match(migration, /canonical_quantity_before/i);
  assert.match(
    migration,
    /private\.inventory_event_client_comparable_metadata\(existing_event\.metadata\)/i
  );
  assert.match(migration, /overwrite any client-supplied values/i);
  assert.match(
    migration,
    /Stockout recorded; prior on-hand was %s %s/i
  );
});

test("clientComparableInventoryEventMetadata strips server-owned stockout keys", () => {
  assert.deepEqual(
    clientComparableInventoryEventMetadata({
      note: "empty cooler",
      [STOCKOUT_QUANTITY_BEFORE_METADATA_KEY]: 12,
      [STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY]: 12000,
      forged: true
    }),
    { note: "empty cooler", forged: true }
  );
});

test("stampStockoutQuantityBeforeMetadata overwrites client forgeries", () => {
  assert.deepEqual(
    stampStockoutQuantityBeforeMetadata(
      {
        note: "empty cooler",
        [STOCKOUT_QUANTITY_BEFORE_METADATA_KEY]: 999,
        [STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY]: 1
      },
      12,
      1000
    ),
    {
      note: "empty cooler",
      [STOCKOUT_QUANTITY_BEFORE_METADATA_KEY]: 12,
      [STOCKOUT_CANONICAL_QUANTITY_BEFORE_METADATA_KEY]: 12000
    }
  );
});

test("idempotent stockout replay ignores server-owned quantity_before stamps", () => {
  const stamped: InventoryEvent = {
    ...input(),
    id: "event-1",
    sequence: 1,
    recordedAt: "2026-09-04T10:00:01.000Z",
    actorUserId: "manager-1",
    metadata: stampStockoutQuantityBeforeMetadata({ note: "empty cooler" }, 12, 1000)
  };

  const replay = acceptInventoryEvent({
    existingEvents: [stamped],
    candidate: input({ metadata: { note: "empty cooler" } }),
    authority: {
      id: "event-2",
      actorUserId: "manager-1",
      recordedAt: "2026-09-04T10:00:02.000Z"
    }
  });

  assert.equal(replay.status, "duplicate");
  if (replay.status === "duplicate") {
    assert.equal(replay.event.id, "event-1");
    assert.equal(replay.event.metadata[STOCKOUT_QUANTITY_BEFORE_METADATA_KEY], 12);
  }
});

test("stockout note changes still conflict after stripping server stamps", () => {
  const stamped: InventoryEvent = {
    ...input(),
    id: "event-1",
    sequence: 1,
    recordedAt: "2026-09-04T10:00:01.000Z",
    actorUserId: "manager-1",
    metadata: stampStockoutQuantityBeforeMetadata({ note: "first" }, 12, 1000)
  };

  const conflict = acceptInventoryEvent({
    existingEvents: [stamped],
    candidate: input({ metadata: { note: "second" } }),
    authority: {
      id: "event-2",
      actorUserId: "manager-1",
      recordedAt: "2026-09-04T10:00:02.000Z"
    }
  });

  assert.equal(conflict.status, "conflict");
});
