import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { INVENTORY_EVENT_SOURCE_REFERENCE_MAX_CHARACTERS } from "../services/domain/securityLimits";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903083000_bound_inventory_event_source_reference.sql",
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

test("additive migration bounds source_reference on inventory_events inserts", () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.reject_oversized_inventory_event_source_reference/i
  );
  assert.match(migration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    new RegExp(
      String.raw`char_length\(new\.source_reference\)\s*>\s*${INVENTORY_EVENT_SOURCE_REFERENCE_MAX_CHARACTERS}`,
      "i"
    )
  );
  assert.match(migration, /Inventory event source reference is too long/i);
  assert.match(
    migration,
    /add constraint inventory_events_source_reference_length_check[\s\S]*char_length\(source_reference\)\s*<=\s*200/i
  );
  assert.match(
    migration,
    /create trigger reject_oversized_inventory_event_source_reference[\s\S]*before insert on public\.inventory_events/i
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

test("foundation column historically left source_reference unbounded", () => {
  assert.match(foundation, /source_reference text,/i);
  assert.doesNotMatch(
    foundation,
    /inventory_events_source_reference_length_check/i
  );
  assert.doesNotMatch(
    foundation,
    /Inventory event source reference is too long/i
  );
});

test("pgTAP proves oversized source_reference fails closed", () => {
  assert.match(pgTap, /select plan\(27\)/);
  assert.match(pgTap, /manager-oversized-source-reference-1/);
  assert.match(pgTap, /Inventory event source reference is too long/);
  assert.match(
    pgTap,
    new RegExp(
      String.raw`repeat\('r',\s*${INVENTORY_EVENT_SOURCE_REFERENCE_MAX_CHARACTERS + 1}\)`,
      "i"
    )
  );
});
