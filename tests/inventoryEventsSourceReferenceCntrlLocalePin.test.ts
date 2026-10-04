import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004190000_mise_005hg_inventory_events_source_reference_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/inventory_events_source_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HG pins inventory_events.source_reference CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_events_source_reference_check check \(\s*source_reference is null\s*or \(\s*length\(trim\(source_reference\)\) between 1 and 200\s*and source_reference collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`source_reference collate "C" !~ '[[:cntrl:]]'`),
    "source_reference CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(source_reference)) between 1 and 200"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /record_inventory_event/i);
  assert.doesNotMatch(
    sqlBody,
    /reject_oversized_inventory_event_source_reference/i,
    "must not rewrite #370 oversize trigger"
  );
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
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count/i);
  assert.match(
    migration,
    /not ilike '%client_event_id%'/,
    "must leave client_event_id bounds untouched when dropping prior source_reference CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched when dropping prior source_reference CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%event_type%'/,
    "must leave event_type bounds untouched when dropping prior source_reference CHECKs"
  );
  assert.match(
    migration,
    /inventory_events_source_check/,
    "must explicitly guard the bare source CHECK name from #622"
  );
});

test("original source_reference column had no CHECK; writer nullif-trims", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.inventory_events \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\),\s*source_reference text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.inventory_events \([\s\S]*?source_reference text[^\n]*check/
  );
  assert.match(
    originalFoundation,
    /nullif\(trim\(p_source_reference\), ''\)/
  );
});

test("null-or-length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedInventoryEventSourceReference = (value: string | null) => {
    if (value === null) return true;
    return (
      value.trim().length >= 1 &&
      value.trim().length <= 200 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedInventoryEventSourceReference(null), true);
  assert.equal(isAllowedInventoryEventSourceReference("delivery-1"), true);
  assert.equal(isAllowedInventoryEventSourceReference("count-session-abc"), true);
  assert.equal(isAllowedInventoryEventSourceReference("a".repeat(200)), true);
  assert.equal(isAllowedInventoryEventSourceReference("a".repeat(201)), false);
  assert.equal(isAllowedInventoryEventSourceReference(""), false);
  assert.equal(isAllowedInventoryEventSourceReference("   "), false);
  assert.equal(isAllowedInventoryEventSourceReference("delivery\t1"), false);
  assert.equal(isAllowedInventoryEventSourceReference("delivery\n1"), false);
  assert.equal(isAllowedInventoryEventSourceReference("delivery\u007f1"), false);
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

  assert.match(pgTap, /source_reference collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(source_reference\\\)\\\) between 1 and 200/
  );
  assert.match(
    pgTap,
    /inventory_events source CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /source_reference CHECK stays dedicated \(excludes client_event_id\)/
  );
  assert.match(
    pgTap,
    /tab in inventory event source_reference is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in inventory event source_reference is rejected under COLLATE C/
  );
});
