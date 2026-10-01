import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001030000_mise_005dy_finding_decision_type_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260728192830_append_operational_finding_decisions.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/finding_decision_type_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DY pins finding decision_type CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_finding_decisions_decision_type_check\s+check \(\s*decision_type in \(\s*'approved',\s*'edited',\s*'dismissed'\s*\)\s*and decision_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`decision_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "decision_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'approved'") &&
      migration.includes("'edited'") &&
      migration.includes("'dismissed'"),
    "exact decision_type allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_operational_finding_decision/i);
  assert.doesNotMatch(sqlBody, /operational_finding_decision_edit_check/i);
  assert.doesNotMatch(sqlBody, /client_event_id/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /policy_version/i);
  assert.doesNotMatch(sqlBody, /finding_id/i);
  assert.doesNotMatch(sqlBody, /finding_category/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_events/i);
});

test("original finding decision_type used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /decision_type text not null\s+check \(decision_type in \('approved', 'edited', 'dismissed'\)\)/
  );
  assert.doesNotMatch(
    original,
    /decision_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins finding decision_type to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(
    pgTap,
    /operational_finding_decisions_decision_type_check exists/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions decision_type CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions decision_type CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token approved matches under COLLATE C/);
  assert.match(pgTap, /writer token edited matches under COLLATE C/);
  assert.match(pgTap, /writer token dismissed matches under COLLATE C/);
  assert.match(pgTap, /spaced decision_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty decision_type token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated decision_type token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII decision_type token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted decision_type tokens match under COLLATE C/
  );
});
