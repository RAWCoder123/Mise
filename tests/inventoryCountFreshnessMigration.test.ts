import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260817090000_inventory_count_freshness_and_sale_time.sql",
  "utf8"
);

test("count freshness migration stamps last_counted_at separately from last_updated", () => {
  assert.match(migration, /add column if not exists last_counted_at timestamptz/i);
  assert.match(migration, /add column if not exists sold_at timestamptz/i);
  assert.match(
    migration,
    /when new\.event_type = 'count' then new\.effective_at/i
  );
  assert.match(migration, /stamp_approved_count_session_freshness/i);
  assert.match(migration, /sale->>'sold_at'/i);
  assert.match(
    migration,
    /sold_at = coalesce\(excluded\.sold_at, public\.pos_sales\.sold_at\)/i
  );
  assert.doesNotMatch(
    migration,
    /grant insert[\s\S]*inventory_items[\s\S]*authenticated/i
  );
});
