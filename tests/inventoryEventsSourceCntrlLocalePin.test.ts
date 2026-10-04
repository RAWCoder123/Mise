import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004180000_mise_005hf_inventory_events_source_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/inventory_events_source_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HF pins inventory_events.source CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_events_source_check check \(\s*length\(trim\(source\)\) between 1 and 80\s*and source collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
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
    /inventory_events_source_reference_length_check/,
    "must not reattach source_reference length CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count/i);
  assert.match(
    migration,
    /not ilike '%source_reference%'/,
    "must leave source_reference bounds untouched when dropping prior source CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%client_event_id%'/,
    "must leave client_event_id bounds untouched when dropping prior source CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched when dropping prior source CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%event_type%'/,
    "must leave event_type bounds untouched when dropping prior source CHECKs"
  );
});

test("original source CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.inventory_events \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.inventory_events \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );

  // Writer trims source; CHECK enforces the 1..80 ceiling.
  assert.match(
    originalFoundation,
    /trim\(p_source\)/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedInventoryEventSource = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedInventoryEventSource("manual"), true);
  assert.equal(isAllowedInventoryEventSource("pos"), true);
  assert.equal(isAllowedInventoryEventSource("count_session"), true);
  assert.equal(isAllowedInventoryEventSource("a".repeat(80)), true);
  assert.equal(isAllowedInventoryEventSource("a".repeat(81)), false);
  assert.equal(isAllowedInventoryEventSource(""), false);
  assert.equal(isAllowedInventoryEventSource("   "), false);
  assert.equal(isAllowedInventoryEventSource("manual\tpos"), false);
  assert.equal(isAllowedInventoryEventSource("manual\npos"), false);
  assert.equal(isAllowedInventoryEventSource("manual\u007fpos"), false);
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
    /inventory_events client_event_id or identity CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /source CHECK stays dedicated \(excludes client_event_id\)/
  );
  assert.match(pgTap, /tab in inventory event source is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in inventory event source is rejected under COLLATE C/);
});
