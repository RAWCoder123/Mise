import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001110000_mise_005eg_finding_category_locale_pin.sql",
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
    "../supabase/tests/database/finding_category_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EG pins finding finding_category CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_finding_decisions_finding_category_check\s+check \(\s*finding_category in \(\s*'inventory',\s*'ordering',\s*'sales',\s*'waste',\s*'prep',\s*'cost',\s*'data_quality'\s*\)\s*and finding_category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`finding_category collate "C" ~ '${TOKEN_PATTERN}'`),
    "finding_category CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'inventory'") &&
      migration.includes("'ordering'") &&
      migration.includes("'sales'") &&
      migration.includes("'waste'") &&
      migration.includes("'prep'") &&
      migration.includes("'cost'") &&
      migration.includes("'data_quality'"),
    "exact finding_category allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_operational_finding_decision/i);
  assert.doesNotMatch(sqlBody, /operational_finding_decision_edit_check/i);
  assert.doesNotMatch(sqlBody, /decision_type/i);
  assert.doesNotMatch(sqlBody, /client_event_id/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /policy_version/i);
  assert.doesNotMatch(sqlBody, /finding_id/i);
  assert.doesNotMatch(sqlBody, /\bseverity\b/i);
  assert.doesNotMatch(sqlBody, /purchase_decision_events/i);
});

test("original finding finding_category used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /finding_category text not null\s+check \(\s*finding_category in \(\s*'inventory', 'ordering', 'sales', 'waste',\s*'prep', 'cost', 'data_quality'\s*\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /finding_category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins finding finding_category to COLLATE C", () => {
  assert.match(pgTap, /select plan\(15\)/);
  assert.match(
    pgTap,
    /operational_finding_decisions_finding_category_check exists/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions finding_category CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /operational_finding_decisions finding_category CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token inventory matches under COLLATE C/);
  assert.match(pgTap, /writer token ordering matches under COLLATE C/);
  assert.match(pgTap, /writer token sales matches under COLLATE C/);
  assert.match(pgTap, /writer token waste matches under COLLATE C/);
  assert.match(pgTap, /writer token prep matches under COLLATE C/);
  assert.match(pgTap, /writer token cost matches under COLLATE C/);
  assert.match(pgTap, /writer token data_quality matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced finding_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty finding_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated finding_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII finding_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted finding_category tokens match under COLLATE C/
  );
});
