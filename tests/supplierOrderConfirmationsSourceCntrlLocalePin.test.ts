import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004010000_mise_005gp_supplier_order_confirmations_source_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/supplier_order_confirmations_source_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GP pins supplier_order_confirmations.source CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GP"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_order_confirmations_source_check check \(\s*length\(trim\(source\)\) between 1 and 80\s*and source collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`source collate "C" !~ '[[:cntrl:]]'`),
    "source CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(source)) between 1 and 80"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_record_supplier_confirmation/i);
  assert.doesNotMatch(sqlBody, /record_supplier_confirmation/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_order_confirmations_confirmation_status_check/,
    "must not reattach confirmation_status CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_order_confirmations_confirmation_reference_check/,
    "must not reattach confirmation_reference CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_order_confirmations_idempotency_key_check/,
    "must not reattach idempotency_key CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_order_confirmations_details_bound_check/,
    "must not reattach details_bound_check by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.match(
    migration,
    /not ilike '%confirmation_status%'/,
    "must leave confirmation_status bounds untouched when dropping prior source CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%confirmation_reference%'/,
    "must leave confirmation_reference bounds untouched when dropping prior source CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched when dropping prior source CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%normalized_details%'/,
    "must leave normalized_details bounds untouched when dropping prior source CHECKs"
  );
});

test("original source CHECK had length(trim) only without cntrl gate; writer already bounds 1..80", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.supplier_order_confirmations \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.supplier_order_confirmations \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );

  assert.match(
    originalFoundation,
    /left\(trim\(p_source\),\s*80\)/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedConfirmationSource = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedConfirmationSource("gmail"), true);
  assert.equal(isAllowedConfirmationSource("manual"), true);
  assert.equal(isAllowedConfirmationSource("a".repeat(80)), true);
  assert.equal(isAllowedConfirmationSource("a".repeat(81)), false);
  assert.equal(isAllowedConfirmationSource(""), false);
  assert.equal(isAllowedConfirmationSource("   "), false);
  assert.equal(isAllowedConfirmationSource("gmail\tmanual"), false);
  assert.equal(isAllowedConfirmationSource("gmail\nmanual"), false);
  assert.equal(isAllowedConfirmationSource("gmail\u007fmanual"), false);
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

  assert.match(pgTap, /source collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(source\\\)\\\) between 1 and 80/);
  assert.match(
    pgTap,
    /supplier_order_confirmations confirmation_status CHECK remains attached/
  );
  assert.match(
    pgTap,
    /source CHECK stays dedicated \(excludes confirmation_status\)/
  );
  assert.match(pgTap, /tab in confirmation source is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in confirmation source is rejected under COLLATE C/);
});
