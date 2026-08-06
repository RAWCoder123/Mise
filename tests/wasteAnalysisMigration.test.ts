import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260803090000_waste_analysis_activity.sql",
    import.meta.url
  ),
  "utf8"
);

test("waste activity is derived from the authoritative ledger without a client insert", () => {
  assert.match(migration, /after insert on public\.inventory_events/i);
  assert.match(migration, /new\.event_type = 'waste'[\s\S]*waste_analysis_completed/i);
  assert.match(migration, /count\(distinct[\s\S]*restaurant\.timezone/i);
  assert.match(migration, /not exists[\s\S]*supersedes_event_id = waste_event\.id/i);
  assert.match(migration, /private\.append_activity_event/i);
  assert.match(migration, /format\('inventory_event:%s', new\.id\)/i);
});

test("the trigger preserves the supplier receipt dedupe boundary and private authority", () => {
  assert.match(
    migration,
    /new\.event_type = 'receipt' and new\.source = 'supplier_delivery'[\s\S]*return new/i
  );
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    migration,
    /revoke all on function private\.capture_inventory_event_activity_v2\(\) from public, anon, authenticated/i
  );
});
