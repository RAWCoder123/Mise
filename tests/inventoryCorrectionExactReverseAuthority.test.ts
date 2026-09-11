import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  acceptInventoryEvent,
  inventoryCorrectionReverseQuantity,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

const migration = readFileSync(
  "supabase/migrations/20260904130000_inventory_correction_exact_reverse.sql",
  "utf8"
);
const ledger = readFileSync("services/domain/inventoryLedger.ts", "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/inventory_correction_exact_reverse.test.sql",
  "utf8"
);

test("additive migration enforces exact reverse inventory corrections", () => {
  assert.match(migration, /enforce_inventory_correction_exact_reverse/);
  assert.match(
    migration,
    /Inventory correction quantity must exactly reverse the superseded event/
  );
  assert.match(
    migration,
    /Inventory correction can only reverse receipt, waste, usage, adjustment, or transfer events/
  );
  assert.match(
    migration,
    /inventory_events_correction_exact_reverse/
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_inventory_correction_exact_reverse\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.record_inventory_event/i
  );
});

test("domain and pgTAP pin exact reverse correction authority", () => {
  assert.match(ledger, /inventoryCorrectionReverseQuantity/);
  assert.match(ledger, /correction_quantity_mismatch/);
  assert.match(ledger, /correction_target_not_reversible/);
  assert.match(ledger, /correction_unit_mismatch/);
  assert.match(pgTap, /mismatched inventory correction quantities are rejected/);
  assert.match(pgTap, /corrections cannot reverse count events/);
  assert.match(pgTap, /an exact reverse waste correction is accepted/);
});

test("reverse quantity mirrors projection deltas for correctable types", () => {
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "receipt", quantity: 100 }),
    -100
  );
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "waste", quantity: 40 }),
    40
  );
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "usage", quantity: 12 }),
    12
  );
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "adjustment", quantity: -8 }),
    8
  );
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "transfer", quantity: 3 }),
    -3
  );
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "count", quantity: 50 }),
    null
  );
  assert.equal(
    inventoryCorrectionReverseQuantity({ eventType: "stockout", quantity: 0 }),
    null
  );
});

test("acceptInventoryEvent restores waste with the exact reverse quantity", () => {
  const wasteInput: InventoryEventInput = {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "waste",
    quantity: 75,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "waste-exact",
    idempotencyKey: "waste-exact",
    supersedesEventId: null,
    metadata: {}
  };
  const waste = acceptInventoryEvent({
    existingEvents: [],
    candidate: wasteInput,
    authority: {
      id: "waste-1",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:01:00.000Z"
    }
  });
  assert.equal(waste.status, "accepted");
  if (waste.status !== "accepted") throw new Error("expected waste");

  const correction = acceptInventoryEvent({
    existingEvents: [waste.event],
    candidate: {
      ...wasteInput,
      eventType: "correction",
      quantity: 75,
      clientEventId: "waste-exact-correction",
      idempotencyKey: "waste-exact-correction",
      supersedesEventId: "waste-1",
      source: "operator_correction"
    },
    authority: {
      id: "correction-1",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:02:00.000Z"
    }
  });
  assert.equal(correction.status, "accepted");
});
