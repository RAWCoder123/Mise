import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCreateRestaurantTaskInput } from "../services/domain/restaurantTasks";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001250000_mise_005eu_restaurant_tasks_source_reference_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_tasks_source_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

const baseInput = {
  restaurantId: "a0000000-0000-4000-8000-000000000001",
  clientTaskId: "task-source-reference-cntrl-check",
  title: "Confirm chicken delivery"
};

test("MISE-005EU pins restaurant_tasks.source_reference CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_source_reference_bound_check check \(\s*source_reference is null\s*or \(\s*length\(trim\(source_reference\)\) between 1 and 240\s*and source_reference collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`source_reference collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_tasks source_reference CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(source_reference)) between 1 and 240"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite task RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /add constraint restaurant_tasks_title_check/i);
  assert.doesNotMatch(sqlBody, /drop constraint(?: if exists)? restaurant_tasks_title_check/i);
  assert.doesNotMatch(sqlBody, /add constraint restaurant_tasks_detail_check/i);
  assert.doesNotMatch(sqlBody, /add constraint.*completion_result/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_supplier_bound_check/i);
  assert.match(
    migration,
    /not ilike '%related_supplier_name%'/,
    "must leave related_supplier_name bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%completion_result%'/,
    "must leave completion_result bounds untouched"
  );
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
});

test("original restaurant_tasks.source_reference CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /constraint restaurant_tasks_source_reference_bound_check\s+check \(source_reference is null or length\(trim\(source_reference\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    original,
    /constraint restaurant_tasks_source_reference_bound_check[\s\S]{0,200}\[\[:cntrl:\]\]/
  );
});

test("normalizeCreateRestaurantTaskInput rejects ASCII C control characters in sourceReference", () => {
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      sourceReference: " inventory-risk:item-1 "
    }).sourceReference,
    "inventory-risk:item-1"
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      sourceReference: null
    }).sourceReference,
    null
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      sourceReference: "   "
    }).sourceReference,
    null
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        sourceReference: "inventory-risk:\titem-1"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        sourceReference: "inventory-risk:\nitem-1"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        sourceReference: "inventory-risk:\u0000item-1"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        sourceReference: "inventory-risk:\u007fitem-1"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        sourceReference: "A".repeat(241)
      }),
    /without control characters|240 characters|invalid/
  );
  assert.match(
    domain,
    /function optionalSourceReference[\s\S]*hasAsciiControlCharacters\(normalized\)/
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

  assert.match(pgTap, /source_reference collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(source_reference\\\)\\\) between 1 and 240/);
  assert.match(pgTap, /tab in source reference is rejected/);
  assert.match(pgTap, /DEL in source reference is rejected/);
});
