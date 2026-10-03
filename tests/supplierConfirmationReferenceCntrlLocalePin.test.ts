import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003230000_mise_005gn_supplier_confirmation_reference_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/supplier_confirmation_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GN pins confirmation_reference CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_order_confirmations_confirmation_reference_check check \(\s*confirmation_reference is null\s*or \(\s*length\(trim\(confirmation_reference\)\) between 1 and 512\s*and confirmation_reference collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(
      `confirmation_reference collate "C" !~ '[[:cntrl:]]'`
    ),
    "confirmation_reference CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      "length(trim(confirmation_reference)) between 1 and 512"
    ),
    "exact length(trim) bound must match foundation writer left(trim(...), 512)"
  );
  assert.ok(
    migration.includes("confirmation_reference is null"),
    "nullability must be preserved"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
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
    "must leave confirmation_status bounds untouched when dropping prior confirmation_reference CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched when dropping prior confirmation_reference CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%normalized_details%'/,
    "must leave normalized_details bounds untouched when dropping prior confirmation_reference CHECKs"
  );
});

test("original confirmation_reference had no CHECK; writer already bounds 1..512", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.supplier_order_confirmations \([\s\S]*?confirmation_reference text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.supplier_order_confirmations \([\s\S]*?confirmation_reference text[^\n]*check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /supplier_order_confirmations_confirmation_reference_check/
  );

  assert.match(
    originalFoundation,
    /nullif\(left\(trim\(p_confirmation_reference\),\s*512\),\s*''\)/
  );

  assert.match(
    migration,
    /matches foundation writer|left\(trim\(\.\.\.\),\s*512\)/
  );
});

test("nullable length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedConfirmationReference = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 512 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedConfirmationReference(null), true);
  assert.equal(isAllowedConfirmationReference("PO-ACK-88421"), true);
  assert.equal(isAllowedConfirmationReference("a".repeat(512)), true);
  assert.equal(isAllowedConfirmationReference("a".repeat(513)), false);
  assert.equal(isAllowedConfirmationReference(""), false);
  assert.equal(isAllowedConfirmationReference("   "), false);
  assert.equal(isAllowedConfirmationReference("PO\tACK"), false);
  assert.equal(isAllowedConfirmationReference("PO\nACK"), false);
  assert.equal(isAllowedConfirmationReference("PO\u007fACK"), false);
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

  assert.match(
    pgTap,
    /confirmation_reference collate "C" !~ ''\[\[:cntrl:\]\]''/
  );
  assert.match(
    pgTap,
    /length\\\(trim\\\(confirmation_reference\\\)\\\) between 1 and 512/
  );
  assert.match(
    pgTap,
    /supplier_order_confirmations confirmation_status CHECK remains attached/
  );
  assert.match(
    pgTap,
    /confirmation_reference CHECK stays dedicated \(excludes confirmation_status\)/
  );
  assert.match(
    pgTap,
    /tab in confirmation reference is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in confirmation reference is rejected under COLLATE C/
  );
});
