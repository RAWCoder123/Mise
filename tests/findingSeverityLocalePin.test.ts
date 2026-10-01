import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001120000_mise_005eh_finding_severity_locale_pin.sql",
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
    "../supabase/tests/database/finding_severity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EH pins finding severity CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_finding_decisions_severity_check\s+check \(\s*severity in \(\s*'info',\s*'warning',\s*'urgent'\s*\)\s*and severity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`severity collate "C" ~ '${TOKEN_PATTERN}'`),
    "severity CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'info'") &&
      migration.includes("'warning'") &&
      migration.includes("'urgent'"),
    "exact severity allowlist must be preserved"
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
  assert.doesNotMatch(sqlBody, /decision_type/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /\binsights\b/i);
});

test("original finding severity used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /severity text not null check \(severity in \('info', 'warning', 'urgent'\)\)/
  );
  assert.doesNotMatch(
    original,
    /severity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins finding severity to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(
    pgTap,
    /operational_finding_decisions_severity_check exists/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions severity CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions severity CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token info matches under COLLATE C/);
  assert.match(pgTap, /writer token warning matches under COLLATE C/);
  assert.match(pgTap, /writer token urgent matches under COLLATE C/);
  assert.match(pgTap, /spaced severity token is rejected under COLLATE C/);
  assert.match(pgTap, /empty severity token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated severity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII severity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted severity tokens match under COLLATE C/
  );
});
