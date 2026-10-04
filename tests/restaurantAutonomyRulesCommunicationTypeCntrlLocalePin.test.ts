import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004100000_mise_005gx_restaurant_autonomy_rules_communication_type_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_autonomy_rules_communication_type_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GX pins restaurant_autonomy_rules.communication_type CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_autonomy_rules_communication_type_check check \(\s*communication_type is null\s*or \(\s*length\(trim\(communication_type\)\) between 1 and 80\s*and communication_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`communication_type collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_autonomy_rules.communication_type CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(communication_type)) between 1 and 80"),
    "exact length(trim) bound must match writer left(trim(...), 80) ceiling"
  );
  assert.ok(
    migration.includes("communication_type is null"),
    "communication_type is nullable; dedicated CHECK must keep a null OR branch"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /upsert_restaurant_autonomy_rule/i);
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_supplier_scope_check/,
    "must not reattach supplier_scope_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_supplier_name_check/,
    "must not reattach supplier_name_check by name rewrite"
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
    /not ilike '%supplier_name%'/,
    "must leave supplier_name_check untouched when dropping prior communication_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_id%'/,
    "must leave supplier_scope_check untouched when dropping prior communication_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%execute%'/,
    "must leave execute_guard untouched when dropping prior communication_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%operational_category%'/,
    "must leave operational_category bounds untouched when dropping prior communication_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%spend_limit%'/,
    "must leave spend_limit bounds untouched when dropping prior communication_type CHECKs"
  );
});

test("original autonomy communication_type had no CHECK; writers trim to 80; scope_check is null-pair only", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_autonomy_rules \([\s\S]*?communication_type text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_autonomy_rules \([\s\S]*?communication_type text[^\n]*check/
  );
  assert.doesNotMatch(original, /restaurant_autonomy_rules_communication_type_check/);

  assert.match(
    original,
    /nullif\(left\(trim\(p_communication_type\), 80\), ''\)/
  );
  assert.match(
    durableSupplierIdentity,
    /nullif\(pg_catalog\.left\(pg_catalog\.btrim\(p_communication_type\), 80\), ''\)/
  );

  const scopeCheckMatch = durableSupplierIdentity.match(
    /add constraint restaurant_autonomy_rules_supplier_scope_check\s+check \(\(supplier_name is null\) = \(supplier_id is null\)\)[^;]*/
  );
  assert.ok(
    scopeCheckMatch,
    "MISE-003C must attach restaurant_autonomy_rules_supplier_scope_check as a null-pair only"
  );
  // Bound the scan to the scope_check statement only — the same 003C migration
  // later attaches suppliers_display_name_check with a bare [[:cntrl:]] gate.
  assert.doesNotMatch(scopeCheckMatch[0], /\[\[:cntrl:\]\]/);
  assert.doesNotMatch(scopeCheckMatch[0], /between 1 and 80/);
});

test("null-or-length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedCommunicationType = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 80 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedCommunicationType(null), true);
  assert.equal(isAllowedCommunicationType("email"), true);
  assert.equal(isAllowedCommunicationType("a".repeat(80)), true);
  assert.equal(isAllowedCommunicationType("a".repeat(81)), false);
  assert.equal(isAllowedCommunicationType(""), false);
  assert.equal(isAllowedCommunicationType("   "), false);
  assert.equal(isAllowedCommunicationType("email\tchannel"), false);
  assert.equal(isAllowedCommunicationType("email\nchannel"), false);
  assert.equal(isAllowedCommunicationType("email\u007fchannel"), false);
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

  assert.match(pgTap, /communication_type collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(communication_type\\\)\\\) between 1 and 80/
  );
  assert.match(
    pgTap,
    /restaurant_autonomy_rules supplier_scope_check remains attached/
  );
  assert.match(
    pgTap,
    /communication_type CHECK stays dedicated \(excludes supplier_name \/ scope siblings\)/
  );
  assert.match(
    pgTap,
    /tab in autonomy-rule communication_type is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in autonomy-rule communication_type is rejected under COLLATE C/
  );
});
