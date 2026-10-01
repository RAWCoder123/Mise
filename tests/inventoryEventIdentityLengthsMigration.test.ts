import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INVENTORY_EVENT_CLIENT_EVENT_ID_MAX_CHARACTERS,
  INVENTORY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS,
  INVENTORY_EVENT_SOURCE_MAX_CHARACTERS
} from "../services/domain/securityLimits";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260903180000_bound_inventory_event_identity_lengths.sql",
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
  new URL("../supabase/tests/database/inventory_event_identity_lengths.test.sql", import.meta.url),
  "utf8"
);

test("additive migration installs clear oversized identity guards without redeclaring the RPC", () => {
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+private\.reject_oversized_inventory_event_identity/i
  );
  assert.match(migration, /security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i);
  assert.match(
    migration,
    new RegExp(
      String.raw`char_length\(pg_catalog\.btrim\(new\.source\)\)\s*>\s*${INVENTORY_EVENT_SOURCE_MAX_CHARACTERS}`,
      "i"
    )
  );
  assert.match(
    migration,
    new RegExp(
      String.raw`char_length\(pg_catalog\.btrim\(new\.client_event_id\)\)\s*>\s*${INVENTORY_EVENT_CLIENT_EVENT_ID_MAX_CHARACTERS}`,
      "i"
    )
  );
  assert.match(
    migration,
    new RegExp(
      String.raw`char_length\(pg_catalog\.btrim\(new\.idempotency_key\)\)\s*>\s*${INVENTORY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS}`,
      "i"
    )
  );
  assert.match(migration, /Inventory event source is too long/i);
  assert.match(migration, /Inventory event client event id is too long/i);
  assert.match(migration, /Inventory event idempotency key is too long/i);
  assert.match(
    migration,
    /create trigger reject_oversized_inventory_event_identity[\s\S]*before insert on public\.inventory_events/i
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

test("foundation already CHECKs identity field lengths", () => {
  assert.match(
    foundation,
    /source text not null check \(length\(trim\(source\)\) between 1 and 80\)/i
  );
  assert.match(
    foundation,
    /client_event_id text not null check \(length\(trim\(client_event_id\)\) between 1 and 200\)/i
  );
  assert.match(
    foundation,
    /idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\)/i
  );
  assert.doesNotMatch(foundation, /Inventory event source is too long/i);
  assert.doesNotMatch(foundation, /reject_oversized_inventory_event_identity/i);
});

test("pgTAP proves oversized identity fields fail closed at the boundary", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /Inventory event source is too long/);
  assert.match(pgTap, /Inventory event client event id is too long/);
  assert.match(pgTap, /Inventory event idempotency key is too long/);
  assert.match(
    pgTap,
    new RegExp(String.raw`repeat\('s',\s*${INVENTORY_EVENT_SOURCE_MAX_CHARACTERS}\)`, "i")
  );
  assert.match(
    pgTap,
    new RegExp(String.raw`repeat\('s',\s*${INVENTORY_EVENT_SOURCE_MAX_CHARACTERS + 1}\)`, "i")
  );
  assert.match(
    pgTap,
    new RegExp(
      String.raw`repeat\('c',\s*${INVENTORY_EVENT_CLIENT_EVENT_ID_MAX_CHARACTERS}\)`,
      "i"
    )
  );
  assert.match(
    pgTap,
    new RegExp(
      String.raw`repeat\('c',\s*${INVENTORY_EVENT_CLIENT_EVENT_ID_MAX_CHARACTERS + 1}\)`,
      "i"
    )
  );
  assert.match(
    pgTap,
    new RegExp(
      String.raw`repeat\('i',\s*${INVENTORY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS}\)`,
      "i"
    )
  );
  assert.match(
    pgTap,
    new RegExp(
      String.raw`repeat\('i',\s*${INVENTORY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS + 1}\)`,
      "i"
    )
  );
});
