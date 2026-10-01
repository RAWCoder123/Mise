import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001160000_mise_005el_insights_content_bounds_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260713100023_harden_workflow_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/insights_content_bounds_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EL pins insights_content_bounds_check to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint insights_content_bounds_check check \(\s*length\(trim\(title\)\) between 1 and 240\s*and title collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(description\)\) between 1 and 4000\s*and description collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(recommended_action\)\) between 1 and 2000\s*and recommended_action collate "C" !~ '\[\[:cntrl:\]\]'\s*and \(\s*why_it_matters is null\s*or \(\s*length\(why_it_matters\) <= 2000\s*and why_it_matters collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`title collate "C" !~ '[[:cntrl:]]'`),
    "insights.title CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(`description collate "C" !~ '[[:cntrl:]]'`),
    "insights.description CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(`recommended_action collate "C" !~ '[[:cntrl:]]'`),
    "insights.recommended_action CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(`why_it_matters collate "C" !~ '[[:cntrl:]]'`),
    "insights.why_it_matters CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(migration.includes("between 1 and 240"), "exact title length bound must be preserved");
  assert.ok(migration.includes("between 1 and 4000"), "exact description length bound must be preserved");
  assert.ok(migration.includes("between 1 and 2000"), "exact recommended_action length bound must be preserved");
  assert.ok(migration.includes("length(why_it_matters) <= 2000"), "exact why_it_matters length bound must be preserved");

  // Compose: CHECK-only. Do not rewrite insight writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /insights_insight_type_check/i);
  assert.doesNotMatch(sqlBody, /insights_severity_check/i);
  assert.doesNotMatch(sqlBody, /generation_source/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /ai_insights/i);
});

test("original insights_content_bounds_check had length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint insights_content_bounds_check check \(\s*length\(trim\(title\)\) between 1 and 240 and\s*length\(trim\(description\)\) between 1 and 4000 and\s*length\(trim\(recommended_action\)\) between 1 and 2000 and\s*\(why_it_matters is null or length\(why_it_matters\) <= 2000\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /insights_content_bounds_check[\s\S]*?\[\[:cntrl:\]\]/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(/^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim)
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /title collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /description collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /recommended_action collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /why_it_matters collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(title\\\)\\\) between 1 and 240/);
  assert.match(pgTap, /length\\\(why_it_matters\\\) <= 2000/);
});
