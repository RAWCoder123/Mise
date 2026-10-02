import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001280000_mise_005ex_operational_issues_explanation_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_issues_explanation_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EX pins operational_issues.explanation CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_issues_explanation_check check \(\s*length\(trim\(explanation\)\) between 1 and 2000\s*and explanation collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`explanation collate "C" !~ '[[:cntrl:]]'`),
    "operational_issues explanation CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(explanation)) between 1 and 2000"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /operational_issues_title/i);
  assert.doesNotMatch(sqlBody, /operational_issues_dedupe_key/i);
  assert.doesNotMatch(sqlBody, /operational_issues_category_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_severity_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_status_check/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.match(
    migration,
    /not ilike '%title%'/,
    "must leave title bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%dedupe_key%'/,
    "must leave dedupe_key bounds untouched"
  );
});

test("original operational_issues.explanation CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.operational_issues \([\s\S]*?explanation text not null check \(length\(trim\(explanation\)\) between 1 and 2000\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.operational_issues \([\s\S]*?explanation text not null check \(length\(trim\(explanation\)\) between 1 and 2000\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /explanation collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(explanation\\\)\\\) between 1 and 2000/);
  assert.match(pgTap, /tab in operational issue explanation is rejected/);
  assert.match(pgTap, /DEL in operational issue explanation is rejected/);
});
