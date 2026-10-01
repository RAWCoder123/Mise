import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCreateRestaurantTaskInput } from "../services/domain/restaurantTasks";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001240000_mise_005et_restaurant_tasks_related_supplier_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_related_supplier_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

const baseInput = {
  restaurantId: "a0000000-0000-4000-8000-000000000001",
  clientTaskId: "task-related-supplier-cntrl-check",
  title: "Confirm chicken delivery"
};

test("MISE-005ET pins restaurant_tasks.related_supplier_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005ET"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_supplier_bound_check check \(\s*related_supplier_name is null\s*or \(\s*length\(trim\(related_supplier_name\)\) between 1 and 200\s*and related_supplier_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`related_supplier_name collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_tasks related_supplier_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(related_supplier_name)) between 1 and 200"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite task RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /add constraint restaurant_tasks_title_check/i);
  assert.doesNotMatch(sqlBody, /drop constraint(?: if exists)? restaurant_tasks_title_check/i);
  assert.doesNotMatch(sqlBody, /add constraint restaurant_tasks_detail_check/i);
  assert.doesNotMatch(sqlBody, /add constraint.*completion_result/i);
  assert.doesNotMatch(sqlBody, /source_reference_bound_check/i);
  assert.match(
    migration,
    /not ilike '%source_reference%'/,
    "must leave source_reference bounds untouched"
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

test("original restaurant_tasks.related_supplier_name CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /constraint restaurant_tasks_supplier_bound_check\s+check \(related_supplier_name is null or length\(trim\(related_supplier_name\)\) between 1 and 200\)/
  );
  assert.doesNotMatch(
    original,
    /constraint restaurant_tasks_supplier_bound_check[\s\S]{0,200}\[\[:cntrl:\]\]/
  );
});

test("normalizeCreateRestaurantTaskInput rejects ASCII C control characters in relatedSupplierName", () => {
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      relatedSupplierName: " Regional Protein Co "
    }).relatedSupplierName,
    "Regional Protein Co"
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      relatedSupplierName: null
    }).relatedSupplierName,
    null
  );
  assert.equal(
    normalizeCreateRestaurantTaskInput({
      ...baseInput,
      relatedSupplierName: "   "
    }).relatedSupplierName,
    null
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        relatedSupplierName: "Regional\tProtein Co"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        relatedSupplierName: "Regional\nProtein Co"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        relatedSupplierName: "Regional\u0000Protein Co"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        relatedSupplierName: "Regional\u007fProtein Co"
      }),
    /without control characters/
  );
  assert.throws(
    () =>
      normalizeCreateRestaurantTaskInput({
        ...baseInput,
        relatedSupplierName: "A".repeat(201)
      }),
    /without control characters|200 characters|invalid/
  );
  assert.match(
    domain,
    /function optionalRelatedSupplierName[\s\S]*hasAsciiControlCharacters\(normalized\)/
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

  assert.match(pgTap, /related_supplier_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(related_supplier_name\\\)\\\) between 1 and 200/);
  assert.match(pgTap, /tab in related supplier name is rejected/);
  assert.match(pgTap, /DEL in related supplier name is rejected/);
});
