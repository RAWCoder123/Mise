import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004200000_mise_005hh_inventory_events_reason_code_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_events_reason_code_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HH pins inventory_events.reason_code CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_events_reason_code_check check \(\s*reason_code is null\s*or \(\s*length\(trim\(reason_code\)\) between 1 and 80\s*and reason_code collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`reason_code collate "C" !~ '[[:cntrl:]]'`),
    "reason_code CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(reason_code)) between 1 and 80"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /record_inventory_event/i);
  assert.doesNotMatch(
    sqlBody,
    /inventory_events_client_event_id_check/,
    "must not reattach client_event_id CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /inventory_events_idempotency_key_check/,
    "must not reattach idempotency_key CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /inventory_events_event_type_check/,
    "must not reattach event_type CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint inventory_events_source_check/,
    "must not reattach bare source CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint inventory_events_source_reference_check/,
    "must not reattach source_reference CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count/i);
  assert.doesNotMatch(
    sqlBody,
    /operational_mode_changes/,
    "must not touch private operational_mode_changes.reason_code (#448)"
  );
  assert.doesNotMatch(
    sqlBody,
    /pilot_operational_control_changes/,
    "must not touch private pilot reason_code (#448)"
  );
  assert.match(
    migration,
    /not ilike '%client_event_id%'/,
    "must leave client_event_id bounds untouched when dropping prior reason_code CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched when dropping prior reason_code CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%event_type%'/,
    "must leave event_type bounds untouched when dropping prior reason_code CHECKs"
  );
  assert.match(
    migration,
    /inventory_events_source_check/,
    "must explicitly guard the bare source CHECK name from #622"
  );
  assert.match(
    migration,
    /inventory_events_source_reference_check/,
    "must explicitly guard the source_reference CHECK name from #623"
  );
});

test("original reason_code column had no CHECK; writer nullif-trims", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.inventory_events \([\s\S]*?source_reference text,\s*reason_code text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.inventory_events \([\s\S]*?reason_code text[^\n]*check/
  );
  assert.match(originalFoundation, /nullif\(trim\(p_reason_code\), ''\)/);
});

test("null-or-length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedInventoryEventReasonCode = (value: string | null) => {
    if (value === null) return true;
    return (
      value.trim().length >= 1 &&
      value.trim().length <= 80 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedInventoryEventReasonCode(null), true);
  assert.equal(isAllowedInventoryEventReasonCode("cycle_count"), true);
  assert.equal(isAllowedInventoryEventReasonCode("demo_closeout"), true);
  assert.equal(isAllowedInventoryEventReasonCode("a".repeat(80)), true);
  assert.equal(isAllowedInventoryEventReasonCode("a".repeat(81)), false);
  assert.equal(isAllowedInventoryEventReasonCode(""), false);
  assert.equal(isAllowedInventoryEventReasonCode("   "), false);
  assert.equal(isAllowedInventoryEventReasonCode("cycle\tcount"), false);
  assert.equal(isAllowedInventoryEventReasonCode("cycle\ncount"), false);
  assert.equal(isAllowedInventoryEventReasonCode("cycle\u007fcount"), false);
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

  assert.match(pgTap, /reason_code collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(reason_code\\\)\\\) between 1 and 80/
  );
  assert.match(pgTap, /inventory_events source CHECK remains attachable/);
  assert.match(
    pgTap,
    /reason_code CHECK stays dedicated \(excludes client_event_id\)/
  );
  assert.match(
    pgTap,
    /tab in inventory event reason_code is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in inventory event reason_code is rejected under COLLATE C/
  );
});
