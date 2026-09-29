import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930110000_mise_005cw_operational_issues_status_locale_pin.sql",
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
    "../supabase/tests/database/operational_issues_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CW pins operational_issues status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CW"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_issues_status_check\s+check \(\s*status in \(\s*'open',\s*'monitoring',\s*'action_prepared',\s*'resolved',\s*'dismissed',\s*'expired'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'open'") &&
      migration.includes("'monitoring'") &&
      migration.includes("'action_prepared'") &&
      migration.includes("'resolved'") &&
      migration.includes("'dismissed'") &&
      migration.includes("'expired'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /operational_issues_category_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_severity_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_dedupe_key_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_autonomy_rules/i);
  assert.doesNotMatch(sqlBody, /restaurant_autonomy_rules_operational_category_check/i);
  assert.doesNotMatch(sqlBody, /category in/i);
  assert.doesNotMatch(sqlBody, /severity in/i);
});

test("original operational_issues status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /status text not null default 'open' check \(status in \(\s*'open', 'monitoring', 'action_prepared', 'resolved', 'dismissed', 'expired'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins operational_issues status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(14\)/);
  assert.match(pgTap, /operational_issues_status_check exists/);
  assert.match(pgTap, /operational_issues status CHECK keeps exact allowlist/);
  assert.match(pgTap, /operational_issues status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token open matches under COLLATE C/);
  assert.match(pgTap, /writer token monitoring matches under COLLATE C/);
  assert.match(pgTap, /writer token action_prepared matches under COLLATE C/);
  assert.match(pgTap, /writer token resolved matches under COLLATE C/);
  assert.match(pgTap, /writer token dismissed matches under COLLATE C/);
  assert.match(pgTap, /writer token expired matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
