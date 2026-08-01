import assert from "node:assert/strict";
import test from "node:test";

import {
  applyManualPosSalesIngestToDemoState,
  createInitialDemoState,
  DEMO_RESTAURANT_ID
} from "../services/demoData";
import {
  assertManualPosSalesIngestReady,
  buildManualPosSalesIngestPayload
} from "../services/domain/posCsvIngest";
import {
  assertNoConsumedPosSaleCorrections,
  buildRecipeConsumptionPlan,
  collectConsumedPosSourceRecordIds,
  CONSUMED_POS_SALE_CORRECTION_ERROR,
  findConsumedPosSaleCorrectionConflicts,
  projectedQuantityAfterSales,
  sumAppliedRecipeConsumption
} from "../services/domain/posConsumption";
import { buildInventoryPrediction } from "../services/domain/miseDomain";
import type { InventoryItem, InventoryMovement, MenuItemIngredient, PosSale } from "../types/mise";

const chickenId = "00000000-0000-4000-8000-000000000101";
const riceId = "00000000-0000-4000-8000-000000000103";

function inventory(id: string, name: string, quantity: number, unit = "lbs"): InventoryItem {
  return {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    item_name: name,
    category: "Protein",
    unit,
    current_quantity: quantity,
    par_level: 100,
    reorder_threshold: 40,
    estimated_unit_cost: 1,
    supplier_name: "Test Supplier",
    last_updated: "2026-07-28T16:00:00.000Z"
  };
}

function mapping(
  id: string,
  menuItemName: string,
  inventoryItemId: string,
  quantityUsed: number,
  unit = "lbs"
): MenuItemIngredient {
  return {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    menu_item_name: menuItemName,
    inventory_item_id: inventoryItemId,
    quantity_used_per_sale: quantityUsed,
    unit
  };
}

function sale(id: string, itemName: string, quantitySold: number, sourceRecordId: string): PosSale {
  return {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    source_record_id: sourceRecordId,
    sale_date: "2026-07-28",
    item_name: itemName,
    category: "Entrees",
    quantity_sold: quantitySold,
    gross_sales: quantitySold * 15,
    net_sales: quantitySold * 14,
    source_pos: "Manual CSV Upload",
    created_at: "2026-07-28T16:00:00.000Z"
  };
}

test("recipe consumption plan maps sales through compatible recipe baselines", () => {
  const plan = buildRecipeConsumptionPlan({
    restaurantId: DEMO_RESTAURANT_ID,
    sales: [
      sale("sale_1", "General Tso Chicken", 10, "csv_1"),
      sale("sale_2", "Unknown Special", 5, "csv_2")
    ],
    mappings: [
      mapping("map_1", " general  tso chicken ", chickenId, 0.42),
      mapping("map_2", "General Tso Chicken", riceId, 0.24),
      mapping("map_3", "General Tso Chicken", chickenId, 0.1, "kg")
    ],
    inventoryItems: [inventory(chickenId, "Chicken thigh", 80), inventory(riceId, "Rice", 50)]
  });

  assert.equal(plan.lines.length, 2);
  assert.equal(plan.itemDeltas.get(chickenId), 4.2);
  assert.equal(plan.itemDeltas.get(riceId), 2.4);
  assert.equal(plan.unmappedSales.length, 1);
  assert.equal(plan.unmappedSales[0]?.itemName, "Unknown Special");
  assert.equal(plan.skippedIncompatible.length, 1);
});

test("projected quantity subtracts only unapplied POS usage", () => {
  assert.deepEqual(projectedQuantityAfterSales(80, 10, 0), {
    projectedQuantity: 70,
    unappliedUsage: 10
  });
  assert.deepEqual(projectedQuantityAfterSales(70, 10, 10), {
    projectedQuantity: 70,
    unappliedUsage: 0
  });
  assert.deepEqual(projectedQuantityAfterSales(75, 10, 5), {
    projectedQuantity: 70,
    unappliedUsage: 5
  });
  assert.deepEqual(projectedQuantityAfterSales(2, 10, 0), {
    projectedQuantity: 0,
    unappliedUsage: 10
  });
});

test("consumed POS sale correction conflicts reject quantity and fingerprint changes", () => {
  const movements: InventoryMovement[] = [
    {
      id: "m1",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: chickenId,
      actor_user_id: null,
      reason: "recipe_consumption",
      quantity_before: 80,
      quantity_after: 75.8,
      delta: -4.2,
      source_workflow: "manual_pos_csv_ingest",
      metadata: { source_record_id: "csv_1", sale_date: "2026-07-28" },
      created_at: "2026-07-28T16:01:00.000Z"
    }
  ];
  const consumed = collectConsumedPosSourceRecordIds(movements);
  assert.deepEqual([...consumed], ["csv_1"]);
  assert.deepEqual(
    findConsumedPosSaleCorrectionConflicts({
      incoming: [
        {
          source_record_id: "csv_1",
          quantity_sold: 12,
          item_name: "General Tso Chicken",
          category: "Entrees",
          sale_date: "2026-07-28"
        }
      ],
      existing: [
        {
          source_record_id: "csv_1",
          quantity_sold: 10,
          item_name: "General Tso Chicken",
          category: "Entrees",
          sale_date: "2026-07-28"
        }
      ],
      consumedSourceRecordIds: consumed
    }),
    [{ sourceRecordId: "csv_1", field: "quantity_sold" }]
  );
  assert.deepEqual(
    findConsumedPosSaleCorrectionConflicts({
      incoming: [
        {
          source_record_id: "csv_1_corrected",
          quantity_sold: 12,
          item_name: "General Tso Chicken",
          category: "Entrees",
          sale_date: "2026-07-28"
        }
      ],
      existing: [
        {
          source_record_id: "csv_1",
          quantity_sold: 10,
          item_name: "General Tso Chicken",
          category: "Entrees",
          sale_date: "2026-07-28"
        }
      ],
      consumedSourceRecordIds: consumed
    }),
    [{ sourceRecordId: "csv_1_corrected", field: "quantity_sold" }]
  );
  assert.throws(
    () =>
      assertNoConsumedPosSaleCorrections({
        incoming: [
          {
            source_record_id: "csv_1",
            quantity_sold: 10,
            item_name: "Dumplings",
            category: "Entrees",
            sale_date: "2026-07-28"
          }
        ],
        existing: [
          {
            source_record_id: "csv_1",
            quantity_sold: 10,
            item_name: "General Tso Chicken",
            category: "Entrees",
            sale_date: "2026-07-28"
          }
        ],
        consumedSourceRecordIds: consumed
      }),
    (error: unknown) =>
      error instanceof Error && error.message === CONSUMED_POS_SALE_CORRECTION_ERROR
  );
  assert.doesNotThrow(() =>
    assertNoConsumedPosSaleCorrections({
      incoming: [
        {
          source_record_id: "csv_1",
          quantity_sold: 10,
          item_name: "General  Tso Chicken",
          category: "Entrees",
          sale_date: "2026-07-28"
        }
      ],
      existing: [
        {
          source_record_id: "csv_1",
          quantity_sold: 10,
          item_name: "General Tso Chicken",
          category: "Entrees",
          sale_date: "2026-07-28"
        }
      ],
      consumedSourceRecordIds: consumed
    })
  );
});

test("sumAppliedRecipeConsumption aggregates ledger rows for an item", () => {
  const movements: InventoryMovement[] = [
    {
      id: "m1",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: chickenId,
      actor_user_id: null,
      reason: "recipe_consumption",
      quantity_before: 80,
      quantity_after: 75.8,
      delta: -4.2,
      source_workflow: "manual_pos_csv_ingest",
      metadata: { source_record_id: "csv_1", sale_date: "2026-07-28" },
      created_at: "2026-07-28T16:01:00.000Z"
    },
    {
      id: "m2",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: chickenId,
      actor_user_id: null,
      reason: "manual_count",
      quantity_before: 75.8,
      quantity_after: 90,
      delta: 14.2,
      source_workflow: "update_inventory",
      metadata: {},
      created_at: "2026-07-28T17:00:00.000Z"
    }
  ];

  assert.equal(sumAppliedRecipeConsumption(movements, chickenId, { saleDate: "2026-07-28" }), 4.2);
  assert.equal(sumAppliedRecipeConsumption(movements, riceId, { saleDate: "2026-07-28" }), 0);
});

test("inventory prediction does not double-subtract applied recipe consumption", () => {
  const item = inventory(chickenId, "Chicken thigh", 75.8);
  const todaySales = [sale("sale_1", "General Tso Chicken", 10, "csv_1")];
  const mappings = [mapping("map_1", "General Tso Chicken", chickenId, 0.42)];

  const withoutApplied = buildInventoryPrediction(item, todaySales, mappings, "2026-07-28");
  assert.equal(withoutApplied.todayDepletion, 4.2);
  assert.equal(withoutApplied.projectedQuantity, 71.6);

  const withApplied = buildInventoryPrediction(item, todaySales, mappings, "2026-07-28", undefined, {
    appliedTodayConsumption: 4.2
  });
  assert.equal(withApplied.todayDepletion, 4.2);
  assert.equal(withApplied.projectedQuantity, 75.8);
});

test("demo CSV ingest deducts mapped recipe usage once and writes ledger rows", () => {
  const state = createInitialDemoState(
    "Toast",
    { preset: "default" },
    new Date("2026-07-28T16:00:00.000Z")
  );
  const chickenBefore = state.inventoryItems.find((item) => item.id === chickenId)?.current_quantity ?? 0;
  const riceBefore = state.inventoryItems.find((item) => item.id === riceId)?.current_quantity ?? 0;
  const wrappersId = "00000000-0000-4000-8000-000000000107";
  const wrappersBefore = state.inventoryItems.find((item) => item.id === wrappersId)?.current_quantity ?? 0;

  const rows = assertManualPosSalesIngestReady(
    buildManualPosSalesIngestPayload(
      [
        "sale_date,item_name,category,quantity_sold,gross_sales",
        "2026-07-28,General Tso Chicken,Entrees,10,150",
        "2026-07-28,Dumplings,Appetizers,6,54"
      ].join("\n")
    )
  );

  const first = applyManualPosSalesIngestToDemoState(state, DEMO_RESTAURANT_ID, rows, "consume.csv");
  assert.equal(first.posSalesRowsSaved, 2);
  assert.equal(first.consumptionMovementsWritten, 5);
  assert.equal(first.unmappedSaleCount, 0);
  assert.equal(first.skippedIncompatibleCount, 0);

  const chickenAfter = state.inventoryItems.find((item) => item.id === chickenId)?.current_quantity;
  const riceAfter = state.inventoryItems.find((item) => item.id === riceId)?.current_quantity;
  const wrappersAfter = state.inventoryItems.find((item) => item.id === wrappersId)?.current_quantity;

  // General Tso: 10 * 0.42 chicken + 10 * 0.24 rice; Dumplings: 6 * 0.18 chicken + 6 * 0.33 wrappers
  assert.equal(chickenAfter, Math.round((chickenBefore - 4.2 - 1.08) * 10000) / 10000);
  assert.equal(riceAfter, Math.round((riceBefore - 2.4) * 10000) / 10000);
  assert.equal(wrappersAfter, Math.round((wrappersBefore - 1.98) * 10000) / 10000);

  const consumption = state.inventoryMovements.filter((movement) => movement.reason === "recipe_consumption");
  assert.equal(consumption.length, 5);
  assert.ok(consumption.every((movement) => movement.source_workflow === "manual_pos_csv_ingest"));
  assert.ok(consumption.every((movement) => typeof movement.metadata.source_record_id === "string"));

  const second = applyManualPosSalesIngestToDemoState(state, DEMO_RESTAURANT_ID, rows, "consume.csv");
  assert.equal(second.consumptionMovementsWritten, 0);
  assert.equal(state.inventoryItems.find((item) => item.id === chickenId)?.current_quantity, chickenAfter);
  assert.equal(
    state.inventoryMovements.filter((movement) => movement.reason === "recipe_consumption").length,
    5
  );

  const corrected = assertManualPosSalesIngestReady(
    buildManualPosSalesIngestPayload(
      [
        "date,item_name,category,quantity,gross_sales",
        "2026-07-28,General Tso Chicken,Entrees,12,180",
        "2026-07-28,Dumplings,Appetizers,6,54"
      ].join("\n")
    )
  );
  assert.throws(
    () => applyManualPosSalesIngestToDemoState(state, DEMO_RESTAURANT_ID, corrected, "corrected.csv"),
    /already drove inventory consumption/i
  );
  assert.equal(state.inventoryItems.find((item) => item.id === chickenId)?.current_quantity, chickenAfter);
  assert.equal(
    state.posSales.find((sale) => sale.source_record_id === rows[0]?.source_record_id)?.quantity_sold,
    10
  );
});
