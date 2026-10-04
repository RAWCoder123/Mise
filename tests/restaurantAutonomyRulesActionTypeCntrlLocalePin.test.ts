import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004110000_mise_005gy_restaurant_autonomy_rules_action_type_cntrl_locale_pin.sql",
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
const durableSupplierIdentity = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_autonomy_rules_action_type_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GY pins restaurant_autonomy_rules.action_type CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_autonomy_rules_action_type_check check \(\s*length\(trim\(action_type\)\) between 1 and 120\s*and action_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`action_type collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_autonomy_rules.action_type CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(action_type)) between 1 and 120"),
    "exact length(trim) bound must match writer left(trim(...), 120) ceiling"
  );
  assert.ok(
    !migration.includes("action_type is null"),
    "action_type is NOT NULL; dedicated CHECK must not add a null OR branch"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /upsert_restaurant_autonomy_rule/i);
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_communication_type_check/,
    "must not reattach communication_type_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_supplier_name_check/,
    "must not reattach supplier_name_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_supplier_scope_check/,
    "must not reattach supplier_scope_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_execute_guard/,
    "must not reattach execute_guard by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]+/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%communication_type%'/,
    "must leave communication_type_check untouched when dropping prior action_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_name%'/,
    "must leave supplier_name_check untouched when dropping prior action_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_id%'/,
    "must leave supplier_scope_check untouched when dropping prior action_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%execute%'/,
    "must leave execute_guard untouched when dropping prior action_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%maximum_autonomy%'/,
    "must leave execute_guard maximum_autonomy_level untouched when dropping prior action_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%operational_category%'/,
    "must leave operational_category bounds untouched when dropping prior action_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%spend_limit%'/,
    "must leave spend_limit bounds untouched when dropping prior action_type CHECKs"
  );
});

test("original autonomy action_type had no CHECK; writers trim to 120; execute_guard mentions action_type without length/cntrl", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_autonomy_rules \([\s\S]*?action_type text not null,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_autonomy_rules \([\s\S]*?action_type text not null[^\n]*check/
  );
  assert.doesNotMatch(original, /restaurant_autonomy_rules_action_type_check/);

  assert.match(original, /left\(trim\(p_action_type\), 120\)/);
  assert.match(
    durableSupplierIdentity,
    /pg_catalog\.left\(pg_catalog\.btrim\(p_action_type\), 120\)/
  );

  const executeGuardMatch = original.match(
    /constraint restaurant_autonomy_rules_execute_guard\s+check \(\s*maximum_autonomy_level < 4[\s\S]*?\)\s*\)/
  );
  assert.ok(
    executeGuardMatch,
    "foundation must attach restaurant_autonomy_rules_execute_guard"
  );
  assert.match(executeGuardMatch[0], /\baction_type\b/);
  assert.doesNotMatch(executeGuardMatch[0], /\[\[:cntrl:\]\]/);
  assert.doesNotMatch(executeGuardMatch[0], /between 1 and 120/);
  assert.doesNotMatch(executeGuardMatch[0], /length\(trim\(action_type\)\)/);
});

test("NOT NULL length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedActionType = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedActionType("send_supplier_order"), true);
  assert.equal(isAllowedActionType("a".repeat(120)), true);
  assert.equal(isAllowedActionType("a".repeat(121)), false);
  assert.equal(isAllowedActionType(""), false);
  assert.equal(isAllowedActionType("   "), false);
  assert.equal(isAllowedActionType("send\tsupplier_order"), false);
  assert.equal(isAllowedActionType("send\nsupplier_order"), false);
  assert.equal(isAllowedActionType("send\u007fsupplier_order"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /action_type collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(action_type\\\)\\\) between 1 and 120/
  );
  assert.match(
    pgTap,
    /restaurant_autonomy_rules execute_guard remains attached/
  );
  assert.match(
    pgTap,
    /action_type CHECK stays dedicated \(excludes execute_guard \/ siblings\)/
  );
  assert.match(
    pgTap,
    /tab in autonomy-rule action_type is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in autonomy-rule action_type is rejected under COLLATE C/
  );
});
