import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LEDGER_QUANTITY_MAX_SCALE } from "../services/domain/securityLimits";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903190000_bound_inventory_event_quantity_scale.sql",
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
  new URL("../supabase/tests/database/inventory_event_quantity_scale.test.sql", import.meta.url),
  "utf8"
);

test("additive migration installs quantity scale guards without redeclaring the RPC", () => {
  assert.equal(LEDGER_QUANTITY_MAX_SCALE, 6);
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.reject_oversized_inventory_event_quantity_scale/i
  );
  assert.match(migration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    new RegExp(String.raw`scale\(new\.quantity\)\s*>\s*${LEDGER_QUANTITY_MAX_SCALE}`, "i")
  );
  assert.match(migration, /Inventory event quantity scale exceeds supported limits/i);
  assert.match(
    migration,
    /add constraint inventory_events_quantity_scale_check[\s\S]*scale\(quantity\)\s*<=\s*6[\s\S]*not valid/i
  );
  assert.match(
    migration,
    /create trigger reject_oversized_inventory_event_quantity_scale[\s\S]*before insert on public\.inventory_events/i
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

test("foundation historically left ledger quantity scale unbounded", () => {
  assert.match(
    foundation,
    /p_quantity is null[\s\S]*p_event_type in \('receipt', 'count', 'waste', 'usage'\) and p_quantity < 0/i
  );
  assert.doesNotMatch(foundation, /inventory_events_quantity_scale_check/i);
  assert.doesNotMatch(foundation, /Inventory event quantity scale exceeds supported limits/i);
  assert.doesNotMatch(foundation, /reject_oversized_inventory_event_quantity_scale/i);
});

test("dedicated pgTAP proves boundary accept and oversized scale reject", () => {
  assert.match(pgTap, /select plan\(6\)/i);
  assert.match(pgTap, /0\.035274/i);
  assert.match(pgTap, /0\.1234567/i);
  assert.match(pgTap, /-1\.0000001/i);
  assert.match(pgTap, /Inventory event quantity scale exceeds supported limits/i);
  assert.match(pgTap, /exactly 6 decimal places remains accepted/i);
});
