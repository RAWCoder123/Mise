import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261110180000_reject_noop_stockout_inventory_events.sql",
  "utf8"
);

test("noop stockout migration uses an additive BEFORE INSERT trigger", () => {
  assert.match(migration, /create or replace function private\.reject_noop_stockout_inventory_event\(\)/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(
    migration,
    /create trigger reject_noop_stockout_inventory_event\s+before insert on public\.inventory_events/i
  );
  assert.match(migration, /from public\.inventory_items item/i);
  assert.match(migration, /item\.current_quantity/i);
  assert.match(migration, /for update/i);
  assert.match(
    migration,
    /On-hand is already zero; stockout would not change inventory/
  );
  assert.match(migration, /errcode = '22023'/);
});

test("noop stockout migration does not redeclare the inventory RPC or widen grants", () => {
  assert.doesNotMatch(migration, /create or replace function public\.record_inventory_event/i);
  assert.doesNotMatch(migration, /grant\s+insert[\s\S]*inventory_events[\s\S]*to authenticated/i);
  assert.doesNotMatch(migration, /grant\s+all[\s\S]*inventory_events[\s\S]*to authenticated/i);
  assert.match(
    migration,
    /revoke all on function private\.reject_noop_stockout_inventory_event\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
});
