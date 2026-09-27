import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927170000_mise_005at_finding_decision_identity_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260728192830_append_operational_finding_decisions.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/finding_decision_identity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outbox = readFileSync(
  new URL("../services/application/findingDecisionOutbox.ts", import.meta.url),
  "utf8"
);
const createIdSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const CLIENT_EVENT_PATTERN = "^[A-Za-z0-9:_-]{1,200}$";
const IDEMPOTENCY_PATTERN = "^[A-Za-z0-9:_-]{1,240}$";

test("MISE-005AT pins finding-decision identity CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_finding_decisions_client_event_id_check check \(\s*client_event_id collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,200\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint operational_finding_decisions_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`client_event_id collate "C" ~ '${CLIENT_EVENT_PATTERN}'`),
    "client_event_id CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`idempotency_key collate "C" ~ '${IDEMPOTENCY_PATTERN}'`),
    "idempotency_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.record_operational_finding_decision/i
  );
  assert.doesNotMatch(
    sqlBody,
    /operational_finding_decisions_finding_id_shape_check/i
  );
  assert.doesNotMatch(sqlBody, /policy_version collate/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs_job_name_check/i);
  assert.doesNotMatch(
    sqlBody,
    /purchase_decision_events_source_event_key_check/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.recalculation_runs/i);
});

test("original finding-decision identity CHECKs were length-only", () => {
  assert.match(
    originalLedger,
    /client_event_id text not null\s+check \(length\(trim\(client_event_id\)\) between 1 and 200\)/
  );
  assert.match(
    originalLedger,
    /idempotency_key text not null\s+check \(length\(trim\(idempotency_key\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    originalLedger,
    /client_event_id collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,200\}\$'/
  );
  assert.doesNotMatch(
    originalLedger,
    /idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'/
  );

  assert.match(outbox, /createId\("finding_decision"\)/);
  assert.match(outbox, /idempotencyKey: `finding-decision:\$\{clientEventId\}`/);
  assert.match(
    createIdSource,
    /return `\$\{prefix\}_\$\{uuid\}`/
  );
});

test("pgTAP fixture pins finding-decision identity shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(
    pgTap,
    /operational_finding_decisions_client_event_id_check exists/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions_idempotency_key_check exists/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions client_event_id CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions idempotency_key CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions client_event_id CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions idempotency_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer client_event_id createId mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer idempotency_key finding-decision prefix matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced finding-decision client_event_id is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty finding-decision idempotency_key is rejected under COLLATE C/
  );
});
