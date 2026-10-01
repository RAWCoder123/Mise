import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCreateRestaurantTaskInput } from "../services/domain/restaurantTasks";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001200000_mise_005ep_restaurant_tasks_detail_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_detail_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = ["[", "\\x00-\\x08", "\\x0B", "\\x0C", "\\x0E-\\x1F", "\\x7F", "]"].join("");

const baseInput = {
  restaurantId: "a0000000-0000-4000-8000-000000000001",
  clientTaskId: "task-detail-cntrl-check",
  title: "Confirm chicken count"
};

test("MISE-005EP pins restaurant_tasks.detail CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EP"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_detail_check check \(\s*detail is null\s*or \(\s*length\(trim\(detail\)\) between 1 and 2000\s*and detail collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`detail collate "C" !~ E'${multilineControlClass}'`),
    "restaurant_tasks detail CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(detail)) between 1 and 2000"),
    "exact length(trim) bound must be preserved"
  );
  assert.ok(migration.includes("detail is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite task RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /insights_content_bounds/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
});

test("original restaurant_tasks.detail CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /detail text check \(detail is null or length\(trim\(detail\)\) between 1 and 2000\)/
  );
  assert.doesNotMatch(
    original,
    /detail text check \(detail is null or length\(trim\(detail\)\) between 1 and 2000\)[\s\S]{0,120}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("normalizeCreateRestaurantTaskInput allows LF/TAB/CR and rejects unsafe controls in detail", () => {
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      detail: " Count the walk-in case before ordering. "
    }).detail,
    "Count the walk-in case before ordering."
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      detail: "Count the walk-in\ncase before ordering."
    }).detail,
    "Count the walk-in\ncase before ordering."
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      detail: "Count the walk-in\tcase"
    }).detail,
    "Count the walk-in\tcase"
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      detail: null
    }).detail,
    null
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      detail: ""
    }).detail,
    null
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        detail: "Count the walk-in\u0000case"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        detail: "Count the walk-in\u0007case"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        detail: "Count the walk-in\u007fcase"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        detail: "A".repeat(2001)
      }),
    /without control characters|2000 characters/
  );
  assert.match(
    domain,
    /function optionalTaskDetail[\s\S]*hasUnsafeMultilineControlCharacters\(normalized\)/
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

  assert.ok(
    pgTap.includes(`!~ E'${multilineControlClass}'`),
    "pgTAP must exercise the exact COLLATE C multiline control class"
  );
  assert.match(pgTap, /length\\\(trim\\\(detail\\\)\\\) between 1 and 2000/);
  assert.match(pgTap, /LF in restaurant task detail text is accepted/);
  assert.match(pgTap, /DEL in restaurant task detail text is rejected/);
});
