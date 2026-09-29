import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930100000_mise_005cv_operational_issues_severity_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_issues_severity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CV pins operational_issues severity CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_issues_severity_check\s+check \(\s*severity in \(\s*'info',\s*'watch',\s*'warning',\s*'critical'\s*\)\s*and severity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`severity collate "C" ~ '${TOKEN_PATTERN}'`),
    "severity CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'info'") &&
      migration.includes("'watch'") &&
      migration.includes("'warning'") &&
      migration.includes("'critical'"),
    "exact severity allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /operational_issues_category_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_status_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_dedupe_key_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_autonomy_rules/i);
  assert.doesNotMatch(sqlBody, /restaurant_autonomy_rules_operational_category_check/i);
  assert.doesNotMatch(sqlBody, /category in/i);
  assert.doesNotMatch(sqlBody, /status in/i);
});

test("original operational_issues severity used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /severity text not null check \(severity in \('info', 'watch', 'warning', 'critical'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /severity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins operational_issues severity to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /operational_issues_severity_check exists/);
  assert.match(pgTap, /operational_issues severity CHECK keeps exact allowlist/);
  assert.match(pgTap, /operational_issues severity CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token info matches under COLLATE C/);
  assert.match(pgTap, /writer token watch matches under COLLATE C/);
  assert.match(pgTap, /writer token warning matches under COLLATE C/);
  assert.match(pgTap, /writer token critical matches under COLLATE C/);
  assert.match(pgTap, /spaced severity token is rejected under COLLATE C/);
  assert.match(pgTap, /empty severity token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated severity token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII severity token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted severity tokens match under COLLATE C/);
});
