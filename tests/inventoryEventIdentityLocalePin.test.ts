import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928170000_mise_005br_inventory_event_identity_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const countSessions = readFileSync(
  new URL(
    "../supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_event_identity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outbox = readFileSync(
  new URL("../services/application/deviceInventoryOutbox.ts", import.meta.url),
  "utf8"
);
const createIdSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CLIENT_EVENT_PATTERN = "^[A-Za-z0-9:_-]{1,200}$";
const IDEMPOTENCY_PATTERN = "^[A-Za-z0-9:_-]{1,240}$";

test("MISE-005BR pins inventory-event identity CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BR"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_events_client_event_id_check check \(\s*client_event_id collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,200\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint inventory_events_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`client_event_id collate "C" ~ '${CLIENT_EVENT_PATTERN}'`),
    "client_event_id CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`idempotency_key collate "C" ~ '${IDEMPOTENCY_PATTERN}'`),
    "idempotency_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers, #375 trigger, or free-form source.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.record_inventory_event/i
  );
  assert.doesNotMatch(
    sqlBody,
    /reject_oversized_inventory_event_identity/i
  );
  assert.doesNotMatch(sqlBody, /inventory_events_source_check/i);
  assert.doesNotMatch(sqlBody, /source_reference/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(
    sqlBody,
    /alter table public\.operational_finding_decisions/i
  );
});

test("original inventory-event identity CHECKs were length-only", () => {
  assert.match(
    originalLedger,
    /client_event_id text not null check \(length\(trim\(client_event_id\)\) between 1 and 200\)/
  );
  assert.match(
    originalLedger,
    /idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    originalLedger,
    /client_event_id collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,200\}\$'/
  );
  assert.doesNotMatch(
    originalLedger,
    /idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'/
  );

  assert.match(outbox, /createId\("inventory_event"\)/);
  assert.match(outbox, /idempotencyKey: `inventory:\$\{clientEventId\}`/);
  assert.match(createIdSource, /return `\$\{prefix\}_\$\{uuid\}`/);
  assert.match(
    countSessions,
    /stable_event_key := 'count_session:' \|\| p_session_id::text \|\| ':' \|\| line_row\.inventory_item_id::text/
  );
});

test("pgTAP fixture pins inventory-event identity shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /inventory_events_client_event_id_check exists/);
  assert.match(pgTap, /inventory_events_idempotency_key_check exists/);
  assert.match(pgTap, /inventory_events client_event_id CHECK uses COLLATE C/);
  assert.match(pgTap, /inventory_events idempotency_key CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /inventory_events client_event_id CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /inventory_events idempotency_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer client_event_id createId mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer idempotency_key inventory prefix matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced inventory-event client_event_id is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty inventory-event idempotency_key is rejected under COLLATE C/
  );
});
