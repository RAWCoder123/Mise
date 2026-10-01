import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSaleInDepletionWindow,
  saleEffectiveAt,
  type InventoryCountEvidence
} from "../services/domain/inventoryCountAuthority";

const migration = readFileSync(
  "supabase/migrations/20260902220000_pos_sales_sold_at.sql",
  "utf8"
);

function evidence(overrides: Partial<InventoryCountEvidence> = {}): InventoryCountEvidence {
  return {
    restaurantId: "r1",
    inventoryItemId: "i1",
    status: "verified",
    count: null,
    countedAt: "2026-09-02T13:00:00.000Z",
    countedOperatingDate: "2026-09-02",
    countAgeHours: 1,
    freshness: "fresh",
    ...overrides
  };
}

test("sold_at migration adds column and preserves timed planning sales", () => {
  assert.match(migration, /add column if not exists sold_at timestamptz/i);
  assert.match(
    migration,
    /create or replace function private\.service_apply_square_sync_result_mise_003a_base/i
  );
  assert.match(migration, /sold_at = coalesce\(excluded\.sold_at, public\.pos_sales\.sold_at\)/i);
  assert.match(migration, /create or replace function public\.fetch_planning_sales/i);
  assert.match(migration, /provider_today as/i);
  assert.match(migration, /sale\.sold_at/i);
  assert.doesNotMatch(migration, /last_counted_at/i);
});

test("isSaleInDepletionWindow prefers sold_at on the count's operating day", () => {
  assert.equal(saleEffectiveAt({ sold_at: "2026-09-02T15:00:00.000Z" }), "2026-09-02T15:00:00.000Z");
  assert.equal(saleEffectiveAt({ sold_at: "not-a-time" }), null);
  assert.equal(saleEffectiveAt({}), null);

  const sameDay = evidence();
  assert.equal(
    isSaleInDepletionWindow(
      { sale_date: "2026-09-02", sold_at: "2026-09-02T15:00:00.000Z" },
      "2026-09-02",
      sameDay
    ),
    true
  );
  assert.equal(
    isSaleInDepletionWindow(
      { sale_date: "2026-09-02", sold_at: "2026-09-02T12:00:00.000Z" },
      "2026-09-02",
      sameDay
    ),
    false
  );
  assert.equal(
    isSaleInDepletionWindow({ sale_date: "2026-09-02" }, "2026-09-02", sameDay),
    false
  );
  assert.equal(
    isSaleInDepletionWindow(
      { sale_date: "2026-09-02", sold_at: "2026-09-02T12:00:00.000Z" },
      "2026-09-02",
      evidence({ countedOperatingDate: "2026-09-01" })
    ),
    true
  );
  assert.equal(
    isSaleInDepletionWindow(
      { sale_date: "2026-09-02" },
      "2026-09-02",
      evidence({ status: "missing", countedAt: null, countedOperatingDate: null })
    ),
    true
  );
});
