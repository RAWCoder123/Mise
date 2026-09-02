import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  normalizeOrderSales,
  selectedModifierIdsFromLineItem
} from "../supabase/functions/_shared/square";

test("selectedModifierIdsFromLineItem keeps catalog-backed ids only", () => {
  assert.deepEqual(
    selectedModifierIdsFromLineItem({
      modifiers: [
        { catalog_object_id: "mod-a", name: "A", quantity: "1" },
        { name: "No id", quantity: "1" },
        { catalog_object_id: "mod-a", name: "A again", quantity: "2" },
        { catalog_object_id: "mod-b", name: "B", quantity: "0" }
      ]
    }),
    ["mod-a"]
  );
});

test("normalizeOrderSales attaches selected_modifier_ids on the sale row", () => {
  const rows = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-1",
    closed_at: "2026-09-02T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Bowl",
        quantity: "1",
        catalog_object_id: "var-bowl",
        gross_sales_money: { amount: 1000, currency: "USD" },
        total_money: { amount: 1000, currency: "USD" },
        modifiers: [
          { catalog_object_id: "mod-extra-avo", name: "Extra avocado", quantity: "1" }
        ]
      }
    ]
  });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]?.selected_modifier_ids, ["mod-extra-avo"]);
});

test("pos sale selected modifier migration persists ids after Square sync apply", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260902050000_pos_sale_selected_modifier_ids.sql"
    ),
    "utf8"
  );
  assert.match(migration, /selected_modifier_ids text\[]/);
  assert.match(migration, /normalize_selected_modifier_ids/);
  assert.match(migration, /fetch_planning_sales/);
  assert.match(migration, /provider_complete_with_modifiers/);
  assert.match(
    migration,
    /set selected_modifier_ids = modifier_ids/
  );
});
