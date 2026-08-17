import assert from "node:assert/strict";
import test from "node:test";

import {
  inventoryCountAsOf,
  isFreshInventoryCount,
  isSaleInDepletionWindow,
  saleEffectiveAt
} from "../services/domain/inventoryCountFreshness";
import type { InventoryItem, PosSale } from "../types/mise";

const operatingDate = "2026-08-17";
const middayCount = "2026-08-17T17:00:00.000Z";

function sale(overrides: Partial<PosSale> = {}): PosSale {
  return {
    id: "sale_1",
    restaurant_id: "rest_a",
    sale_date: operatingDate,
    item_name: "Chicken Bowl",
    category: "Mains",
    quantity_sold: 2,
    gross_sales: 20,
    net_sales: 18,
    source_pos: "Square",
    created_at: "2026-08-17T20:00:00.000Z",
    ...overrides
  };
}

test("inventoryCountAsOf never falls back to last_updated", () => {
  const item = {
    last_counted_at: null,
    last_updated: "2026-08-17T12:00:00.000Z"
  } as Pick<InventoryItem, "last_counted_at" | "last_updated">;
  assert.equal(inventoryCountAsOf(item), null);
  assert.equal(
    inventoryCountAsOf({ last_counted_at: middayCount }),
    middayCount
  );
});

test("same-day depletion excludes pre-count sales and date-only rows", () => {
  assert.equal(
    isSaleInDepletionWindow(
      sale({ sold_at: "2026-08-17T12:00:00.000Z" }),
      operatingDate,
      middayCount
    ),
    false
  );
  assert.equal(
    isSaleInDepletionWindow(
      sale({ sold_at: "2026-08-17T18:00:00.000Z" }),
      operatingDate,
      middayCount
    ),
    true
  );
  assert.equal(
    isSaleInDepletionWindow(sale({ sold_at: null }), operatingDate, middayCount),
    false
  );
});

test("counts from prior days still deplete the full operating day", () => {
  assert.equal(
    isSaleInDepletionWindow(
      sale({ sold_at: null }),
      operatingDate,
      "2026-08-16T22:00:00.000Z"
    ),
    true
  );
});

test("missing verified count keeps prior full-day depletion", () => {
  assert.equal(isSaleInDepletionWindow(sale({ sold_at: null }), operatingDate, null), true);
});

test("saleEffectiveAt prefers sold_at and ignores sync created_at", () => {
  assert.equal(saleEffectiveAt(sale({ sold_at: middayCount })), middayCount);
  assert.equal(saleEffectiveAt(sale({ sold_at: null })), null);
});

test("automation freshness requires a recent verified count", () => {
  const now = new Date("2026-08-17T20:00:00.000Z");
  assert.equal(
    isFreshInventoryCount({ last_counted_at: "2026-08-17T12:00:00.000Z" }, now, 24),
    true
  );
  assert.equal(
    isFreshInventoryCount({ last_counted_at: "2026-08-15T12:00:00.000Z" }, now, 24),
    false
  );
  assert.equal(isFreshInventoryCount({ last_counted_at: null }, now, 24), false);
});
