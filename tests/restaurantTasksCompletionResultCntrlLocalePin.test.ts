import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCompleteRestaurantTaskInput } from "../services/domain/restaurantTasks";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001230000_mise_005es_restaurant_tasks_completion_result_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_completion_result_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = ["[", "\\x00-\\x08", "\\x0B", "\\x0C", "\\x0E-\\x1F", "\\x7F", "]"].join("");

const baseInput = {
  restaurantId: "a0000000-0000-4000-8000-000000000001",
  taskId: "b0000000-0000-4000-8000-000000000001"
};

test("MISE-005ES pins restaurant_tasks.completion_result CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005ES"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_completion_result_bound_check check \(\s*completion_result is null\s*or \(\s*length\(trim\(completion_result\)\) between 1 and 1000\s*and completion_result collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`completion_result collate "C" !~ E'${multilineControlClass}'`),
    "restaurant_tasks completion_result CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(completion_result)) between 1 and 1000"),
    "exact length(trim) bound must be preserved"
  );
  assert.ok(migration.includes("completion_result is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite task RPCs, status machine, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_title_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_detail_check/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /insights_content_bounds/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
});

test("original restaurant_tasks.completion_result had length(trim) only inside completion_check without cntrl gate", () => {
  assert.match(
    original,
    /completion_result is not null\s+and length\(trim\(completion_result\)\) between 1 and 1000/
  );
  assert.doesNotMatch(
    original,
    /completion_result[\s\S]{0,200}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
  assert.doesNotMatch(original, /restaurant_tasks_completion_result_bound_check/);
});

test("normalizeCompleteRestaurantTaskInput allows LF/TAB/CR and rejects unsafe controls in completion result", () => {
  assert.equal(
    normalizeCompleteRestaurantTaskInput({
      ...baseInput,
      completionResult: " Counted 18 lb "
    }).completionResult,
    "Counted 18 lb"
  );
  assert.equal(
    normalizeCompleteRestaurantTaskInput({
      ...baseInput,
      completionResult: "Counted 18 lb\nof chicken."
    }).completionResult,
    "Counted 18 lb\nof chicken."
  );
  assert.equal(
    normalizeCompleteRestaurantTaskInput({
      ...baseInput,
      completionResult: "Counted 18 lb\tof chicken."
    }).completionResult,
    "Counted 18 lb\tof chicken."
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        ...baseInput,
        completionResult: "Counted 18 lb\u0000of chicken."
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        ...baseInput,
        completionResult: "Counted 18 lb\u0007of chicken."
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        ...baseInput,
        completionResult: "Counted 18 lb\u007fof chicken."
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        ...baseInput,
        completionResult: "A".repeat(1001)
      }),
    /without control characters|1000 characters/
  );
  assert.throws(
    () =>
      normalizeCompleteRestaurantTaskInput({
        ...baseInput,
        completionResult: "   "
      }),
    /without control characters|required|invalid/
  );
  assert.match(
    domain,
    /function requiredTaskCompletionResult[\s\S]*hasUnsafeMultilineControlCharacters\(normalized\)/
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
  assert.match(pgTap, /length\\\(trim\\\(completion_result\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /LF in restaurant task completion result text is accepted/);
  assert.match(pgTap, /DEL in restaurant task completion result text is rejected/);
});
