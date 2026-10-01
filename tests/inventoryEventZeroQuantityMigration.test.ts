import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903170000_reject_zero_quantity_inventory_events.sql",
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
  new URL("../supabase/tests/database/inventory_event_zero_quantity.test.sql", import.meta.url),
  "utf8"
);

test("additive migration rejects zero-quantity inventory movements", () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.reject_zero_quantity_inventory_event/i
  );
  assert.match(migration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    /new\.event_type\s+not\s+in\s*\(\s*'count'\s*,\s*'stockout'\s*\)[\s\S]*new\.quantity\s*=\s*0/i
  );
  assert.match(
    migration,
    /Inventory ledger events other than count and stockout cannot have a zero quantity/i
  );
  assert.match(
    migration,
    /create trigger reject_zero_quantity_inventory_event[\s\S]*before insert on public\.inventory_events/i
  );
  assert.match(
    migration,
    /add constraint inventory_events_nonzero_movement_check[\s\S]*not valid/i
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(insert|update|delete)[\s\S]*inventory_events[\s\S]*to\s+authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.record_inventory_event/i
  );
});

test("foundation historically allowed zero receipt waste usage quantities", () => {
  assert.match(
    foundation,
    /\(event_type in \('receipt', 'count', 'waste', 'usage'\) and quantity >= 0\)/
  );
  assert.match(
    foundation,
    /p_event_type in \('receipt', 'count', 'waste', 'usage'\) and p_quantity < 0/
  );
  assert.doesNotMatch(foundation, /reject_zero_quantity_inventory_event/i);
  assert.doesNotMatch(foundation, /cannot have a zero quantity/i);
});

test("dedicated pgTAP proves zero-quantity ledger movements fail closed", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /zero-qty-receipt-0/);
  assert.match(pgTap, /zero-qty-waste-0/);
  assert.match(pgTap, /zero-qty-count-0/);
  assert.match(pgTap, /zero-qty-stockout-0/);
  assert.match(
    pgTap,
    /Inventory ledger events other than count and stockout cannot have a zero quantity/
  );
});
