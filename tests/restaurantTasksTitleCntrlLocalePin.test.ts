import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCreateRestaurantTaskInput } from "../services/domain/restaurantTasks";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001220000_mise_005er_restaurant_tasks_title_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_title_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

const baseInput = {
  restaurantId: "a0000000-0000-4000-8000-000000000001",
  clientTaskId: "task-title-cntrl-check"
};

test("MISE-005ER pins restaurant_tasks.title CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005ER"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_title_check check \(\s*length\(trim\(title\)\) between 1 and 160\s*and title collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`title collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_tasks title CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(title)) between 1 and 160"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite task RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /add constraint restaurant_tasks_detail_check/i);
  assert.doesNotMatch(sqlBody, /drop constraint(?: if exists)? restaurant_tasks_detail_check/i);
  assert.doesNotMatch(sqlBody, /add constraint.*completion_result/i);
  assert.match(
    migration,
    /not ilike '%completion_result%'/,
    "must leave completion_result bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%client_task_id%'/,
    "must leave client_task_id shape untouched"
  );
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
});

test("original restaurant_tasks.title CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /title text not null check \(length\(trim\(title\)\) between 1 and 160\)/
  );
  assert.doesNotMatch(
    original,
    /title text not null check \(length\(trim\(title\)\) between 1 and 160\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("normalizeCreateRestaurantTaskInput rejects ASCII C control characters in title", () => {
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      title: " Confirm chicken count "
    }).title,
    "Confirm chicken count"
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      title: "Confirm  chicken   count"
    }).title,
    "Confirm chicken count"
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        title: "Confirm\tchicken count"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        title: "Confirm\nchicken count"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        title: "Confirm\u0000chicken count"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        title: "Confirm\u007fchicken count"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        title: "A".repeat(161)
      }),
    /without control characters|160 characters|invalid/
  );
  assert.match(
    domain,
    /function requiredTaskTitle[\s\S]*hasAsciiControlCharacters\(trimmed\)/
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
  assert.match(pgTap, /length\\\(trim\\\(title\\\)\\\) between 1 and 160/);
  assert.match(pgTap, /tab in restaurant task title is rejected/);
  assert.match(pgTap, /DEL in restaurant task title is rejected/);
});
