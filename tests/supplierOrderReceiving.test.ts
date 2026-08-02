import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS,
  applyPlannedReceiveToInventory,
  buildReceiveLinesFromFormInputs,
  defaultReceiveLinesFromRecommendations,
  isReceiveQuantityInputReady,
  linkedOrderedRecommendationsForOrder,
  planSupplierOrderReceive,
  resolveReceiveStorageLocation
} from "../services/domain/supplierOrderReceiving";
import { parseLocalizedNumber } from "../i18n/formatters";
import type { InventoryItem, PurchaseRecommendation, StorageLocation, SupplierOrder } from "../types/mise";

const restaurantId = "rest_1";
const orderId = "order_1";

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: orderId,
    restaurant_id: restaurantId,
    supplier_name: "Sysco",
    order_message: "Tomatoes - 10 lb",
    operator_note: null,
    status: "sent",
    delivery_date: "2026-07-31",
    created_at: "2026-07-30T12:00:00.000Z",
    ...overrides
  };
}

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "item_1",
    item_name: "Tomatoes",
    supplier_name: "Sysco",
    recommended_quantity: 10,
    unit: "lb",
    reason: "Below par",
    urgency: "high",
    status: "ordered",
    supplier_order_id: orderId,
    created_at: "2026-07-30T11:00:00.000Z",
    ...overrides
  };
}

function inventory(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item_1",
    restaurant_id: restaurantId,
    item_name: "Tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 4,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 1.5,
    supplier_name: "Sysco",
    last_updated: "2026-07-30T10:00:00.000Z",
    ...overrides
  };
}

test("plans receiving with ordered-versus-received discrepancies", () => {
  const linked = linkedOrderedRecommendationsForOrder(orderId, [
    recommendation(),
    recommendation({
      id: "rec_2",
      inventory_item_id: "item_2",
      item_name: "Onions",
      recommended_quantity: 5,
      created_at: "2026-07-30T11:01:00.000Z"
    }),
    recommendation({ id: "rec_other", supplier_order_id: "other", status: "ordered" })
  ]);
  assert.equal(linked.length, 2);

  const planned = planSupplierOrderReceive({
    order: order(),
    recommendations: linked,
    inventoryItems: [
      inventory(),
      inventory({ id: "item_2", item_name: "Onions", current_quantity: 2 })
    ],
    receiveLines: [
      { inventoryItemId: "item_1", quantityReceived: 9 },
      { inventoryItemId: "item_2", quantityReceived: 5, note: "Full case" }
    ]
  });

  assert.equal(planned.lines.length, 2);
  assert.equal(planned.lines[0]?.quantityAfter, 13);
  assert.equal(planned.lines[0]?.discrepancy, -1);
  assert.equal(planned.lines[0]?.hasDiscrepancy, true);
  assert.equal(planned.lines[1]?.metadata.note, "Full case");
  assert.equal(planned.discrepancyCount, 1);
});

function storageLocation(overrides: Partial<StorageLocation> = {}): StorageLocation {
  return {
    id: "loc_main",
    restaurant_id: restaurantId,
    name: "Main",
    sort_order: 0,
    is_active: true,
    created_at: "2026-07-30T10:00:00.000Z",
    updated_at: "2026-07-30T10:00:00.000Z",
    ...overrides
  };
}

test("defaults receive quantities from ordered recommendations", () => {
  const defaults = defaultReceiveLinesFromRecommendations([recommendation()], "loc_walkin");
  assert.deepEqual(defaults, [
    {
      inventoryItemId: "item_1",
      quantityReceived: 10,
      note: null,
      storageLocationId: "loc_walkin"
    }
  ]);
});

test("builds receive lines from locale-aware quantity strings and optional notes", () => {
  const spanish = buildReceiveLinesFromFormInputs({
    inventoryItemIds: ["item_1", "item_2"],
    quantitiesByItemId: { item_1: "9,5", item_2: "5" },
    notesByItemId: { item_1: "  Short case  ", item_2: "   " },
    storageLocationId: "loc_walkin",
    parseNumber: (value) => parseLocalizedNumber("es", value)
  });
  assert.equal(spanish.ok, true);
  if (!spanish.ok) return;
  assert.deepEqual(spanish.lines, [
    {
      inventoryItemId: "item_1",
      quantityReceived: 9.5,
      note: "Short case",
      storageLocationId: "loc_walkin"
    },
    {
      inventoryItemId: "item_2",
      quantityReceived: 5,
      note: null,
      storageLocationId: "loc_walkin"
    }
  ]);

  assert.equal(isReceiveQuantityInputReady("1.234,5", (value) => parseLocalizedNumber("es", value)), true);
  assert.equal(isReceiveQuantityInputReady("abc", (value) => parseLocalizedNumber("en", value)), false);

  const tooLong = buildReceiveLinesFromFormInputs({
    inventoryItemIds: ["item_1"],
    quantitiesByItemId: { item_1: "3" },
    notesByItemId: { item_1: "x".repeat(SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS + 1) },
    parseNumber: (value) => parseLocalizedNumber("en", value)
  });
  assert.deepEqual(tooLong, { ok: false, error: "note_too_long" });

  const invalid = buildReceiveLinesFromFormInputs({
    inventoryItemIds: ["item_1"],
    quantitiesByItemId: { item_1: "" },
    parseNumber: (value) => parseLocalizedNumber("en", value)
  });
  assert.deepEqual(invalid, { ok: false, error: "invalid_quantity" });
});

test("builds receive lines with per-item put-away stations over a shared default", () => {
  const mixed = buildReceiveLinesFromFormInputs({
    inventoryItemIds: ["item_1", "item_2", "item_3"],
    quantitiesByItemId: { item_1: "4", item_2: "6", item_3: "2" },
    storageLocationId: "loc_main",
    storageLocationIdsByItemId: {
      item_1: "loc_walkin",
      item_2: "  ",
      item_3: "loc_line"
    },
    parseNumber: (value) => parseLocalizedNumber("en", value)
  });
  assert.equal(mixed.ok, true);
  if (!mixed.ok) return;
  assert.deepEqual(
    mixed.lines.map((line) => [line.inventoryItemId, line.storageLocationId]),
    [
      ["item_1", "loc_walkin"],
      ["item_2", "loc_main"],
      ["item_3", "loc_line"]
    ]
  );

  const onlyPerLine = buildReceiveLinesFromFormInputs({
    inventoryItemIds: ["item_1"],
    quantitiesByItemId: { item_1: "3" },
    storageLocationIdsByItemId: { item_1: "loc_walkin" },
    parseNumber: (value) => parseLocalizedNumber("en", value)
  });
  assert.equal(onlyPerLine.ok, true);
  if (!onlyPerLine.ok) return;
  assert.equal(onlyPerLine.lines[0]?.storageLocationId, "loc_walkin");
});

test("rejects receive when the order is not sent or lines are incomplete", () => {
  assert.throws(
    () =>
      planSupplierOrderReceive({
        order: order({ status: "draft" }),
        recommendations: [recommendation()],
        inventoryItems: [inventory()],
        receiveLines: defaultReceiveLinesFromRecommendations([recommendation()])
      }),
    /Only sent supplier orders/
  );

  assert.throws(
    () =>
      planSupplierOrderReceive({
        order: order(),
        recommendations: [recommendation(), recommendation({ id: "rec_2", inventory_item_id: "item_2" })],
        inventoryItems: [inventory(), inventory({ id: "item_2" })],
        receiveLines: [{ inventoryItemId: "item_1", quantityReceived: 10 }]
      }),
    /Receive every ordered line/
  );
});

test("applies planned receive quantities to inventory snapshots", () => {
  const planned = planSupplierOrderReceive({
    order: order(),
    recommendations: [recommendation()],
    inventoryItems: [inventory()],
    receiveLines: [{ inventoryItemId: "item_1", quantityReceived: 6 }]
  });
  const next = applyPlannedReceiveToInventory([inventory()], planned, "2026-07-31T15:00:00.000Z");
  assert.equal(next[0]?.current_quantity, 10);
  assert.equal(next[0]?.last_updated, "2026-07-31T15:00:00.000Z");
});

test("plans receive put-away onto a non-Main storage location", () => {
  const locations = [
    storageLocation(),
    storageLocation({ id: "loc_walkin", name: "Walk-in", sort_order: 10 })
  ];
  assert.equal(resolveReceiveStorageLocation(locations, null).id, "loc_main");
  assert.equal(resolveReceiveStorageLocation(locations, "loc_walkin").name, "Walk-in");
  assert.throws(() => resolveReceiveStorageLocation(locations, "missing"), /not found/i);

  const planned = planSupplierOrderReceive({
    order: order(),
    recommendations: [recommendation()],
    inventoryItems: [inventory()],
    receiveLines: [
      { inventoryItemId: "item_1", quantityReceived: 8, storageLocationId: "loc_walkin" }
    ],
    storageLocations: locations
  });

  assert.equal(planned.lines[0]?.storageLocationId, "loc_walkin");
  assert.equal(planned.lines[0]?.storageLocationName, "Walk-in");
  assert.equal(planned.lines[0]?.metadata.storage_location_id, "loc_walkin");
  assert.equal(planned.lines[0]?.metadata.storage_location_name, "Walk-in");
});

test("receive put-away has pgTAP coverage for service RPC station balances", () => {
  const databaseTests = readFileSync(
    "supabase/tests/database/receive_supplier_order_putaway.test.sql",
    "utf8"
  );
  const migration = readFileSync(
    "supabase/migrations/20260801110000_receive_supplier_order_storage_location.sql",
    "utf8"
  );

  assert.match(migration, /private\.apply_inventory_receive_putaway/i);
  assert.match(migration, /service_receive_supplier_order_and_signals/i);
  assert.match(databaseTests, /service_receive_supplier_order_and_signals/i);
  assert.match(databaseTests, /Walk-in put-away lands the received quantity on the chosen station/i);
  assert.match(databaseTests, /Walk-in put-away returns Main station balance to the pre-receive on-hand amount/i);
  assert.match(databaseTests, /service_role can execute the receive supplier-order service RPC/i);
  assert.match(databaseTests, /staff cannot receive a supplier order through the service RPC/i);
  assert.match(databaseTests, /receive rejects a cross-tenant storage location id/i);
  assert.match(databaseTests, /re-receiving a completed order is idempotent/i);
});
