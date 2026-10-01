import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { INVENTORY_EVENT_QUANTITY_MAX } from "../services/domain/securityLimits";
import { operatingLimits } from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903090000_bound_inventory_event_quantity_magnitude.sql",
    import.meta.url
  ),
  "utf8"
);

const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);

const pgTap = readFileSync(
  new URL("../supabase/tests/database/inventory_event_ledger.test.sql", import.meta.url),
  "utf8"
);

test("additive migration bounds inventory_events quantity magnitude", () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.reject_oversized_inventory_event_quantity/i
  );
  assert.match(migration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    new RegExp(String.raw`abs\(new\.quantity\)\s*>\s*${INVENTORY_EVENT_QUANTITY_MAX}`, "i")
  );
  assert.match(migration, /Inventory event quantity exceeds supported limits/i);
  assert.match(
    migration,
    /add constraint inventory_events_quantity_magnitude_check[\s\S]*abs\(quantity\)\s*<=\s*1000000/i
  );
  assert.match(
    migration,
    /create trigger reject_oversized_inventory_event_quantity[\s\S]*before insert on public\.inventory_events/i
  );
  // Privileges stay manager-authenticated; no client DML grant is introduced.
  assert.doesNotMatch(
    migration,
    /grant\s+(insert|update|delete)[\s\S]*inventory_events[\s\S]*to\s+authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.record_inventory_event/i
  );
});

test("foundation historically left ledger quantity magnitude unbounded", () => {
  assert.match(
    foundation,
    /p_quantity is null[\s\S]*p_event_type in \('receipt', 'count', 'waste', 'usage'\) and p_quantity < 0/i
  );
  assert.doesNotMatch(foundation, /inventory_events_quantity_magnitude_check/i);
  assert.doesNotMatch(foundation, /Inventory event quantity exceeds supported limits/i);
  assert.doesNotMatch(foundation, /abs\(\s*p_quantity\s*\)\s*>\s*1000000/i);
});

test("operator inventoryQuantity ceiling matches ledger magnitude constant", () => {
  assert.equal(operatingLimits.inventoryQuantity, INVENTORY_EVENT_QUANTITY_MAX);
});

test("pgTAP proves oversized ledger quantity fails closed", () => {
  assert.match(pgTap, /select plan\(27\)/);
  assert.match(pgTap, /manager-oversized-quantity-1/);
  assert.match(pgTap, /Inventory event quantity exceeds supported limits/);
  assert.match(
    pgTap,
    new RegExp(String.raw`'receipt',\s*${INVENTORY_EVENT_QUANTITY_MAX + 1},`, "i")
  );
});
