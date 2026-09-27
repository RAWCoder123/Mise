import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927190000_mise_005av_operational_issues_dedupe_key_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_issues_dedupe_key_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const DEDUPE_KEY_PATTERN = "^[A-Za-z0-9:_-]{1,240}$";

test("MISE-005AV pins operational_issues.dedupe_key CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_issues_dedupe_key_check check \(\s*dedupe_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`dedupe_key collate "C" ~ '${DEDUPE_KEY_PATTERN}'`),
    "dedupe_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
});

test("original operational_issues.dedupe_key CHECK was length-only", () => {
  assert.match(
    originalFoundation,
    /dedupe_key text not null check \(length\(trim\(dedupe_key\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /dedupe_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'/
  );

  assert.match(
    originalFoundation,
    /format\('inventory-risk:%s',\s*new\.inventory_item_id\)/
  );
  assert.match(
    originalFoundation,
    /format\('inventory-risk:%s',\s*recommendation\.inventory_item_id\)/
  );
});

test("pgTAP fixture pins operational_issues.dedupe_key shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(pgTap, /operational_issues_dedupe_key_check exists/);
  assert.match(pgTap, /operational_issues dedupe_key CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /operational_issues dedupe_key CHECK is not length-only/
  );
  assert.match(
    pgTap,
    /writer dedupe_key inventory-risk UUID mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /fixture dedupe_key hyphenated mint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced operational-issue dedupe_key is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty operational-issue dedupe_key is rejected under COLLATE C/
  );
});
