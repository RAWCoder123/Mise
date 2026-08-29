import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSupplierOrdersBySearch,
  SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD
} from "../services/domain/supplierOrderLaneSearch";

const supplierOrders = [
  {
    id: "ord-sysco",
    supplier_name: "Sysco Produce",
    order_message: "Tomatoes x12\nLettuce x6",
    operator_note: "Deliver before lunch"
  },
  {
    id: "ord-farm",
    supplier_name: "Local Farm",
    order_message: "Chicken thighs 20 lb",
    operator_note: null
  },
  {
    id: "ord-dairy",
    supplier_name: "Dairy Direct",
    order_message: "Cream and butter",
    operator_note: "Ask for cold pack"
  },
  {
    id: "ord-sysco-dry",
    supplier_name: "Sysco Dry Goods",
    order_message: "Rice and oil",
    operator_note: "Weekly standing"
  },
  {
    id: "ord-seafood",
    supplier_name: "Harbor Seafood",
    order_message: "Salmon portions",
    operator_note: "Hold if late"
  }
] as const;

test("SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD stays at five orders", () => {
  assert.equal(SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD, 5);
});

test("filterSupplierOrdersBySearch returns the full list for an empty query", () => {
  assert.deepEqual(
    filterSupplierOrdersBySearch(supplierOrders, " ").map((order) => order.id),
    supplierOrders.map((order) => order.id)
  );
  assert.equal(filterSupplierOrdersBySearch(supplierOrders, "").length, 5);
});

test("filterSupplierOrdersBySearch ranks supplier name matches", () => {
  assert.deepEqual(
    filterSupplierOrdersBySearch(supplierOrders, "sysco").map((order) => order.id),
    ["ord-sysco", "ord-sysco-dry"]
  );
  assert.equal(filterSupplierOrdersBySearch(supplierOrders, "harbor")[0]?.id, "ord-seafood");
  assert.deepEqual(filterSupplierOrdersBySearch(supplierOrders, "missing-vendor"), []);
});

test("filterSupplierOrdersBySearch matches order message text", () => {
  assert.deepEqual(
    filterSupplierOrdersBySearch(supplierOrders, "chicken").map((order) => order.id),
    ["ord-farm"]
  );
  assert.deepEqual(
    filterSupplierOrdersBySearch(supplierOrders, "tomatoes").map((order) => order.id),
    ["ord-sysco"]
  );
});

test("filterSupplierOrdersBySearch matches operator notes", () => {
  assert.deepEqual(
    filterSupplierOrdersBySearch(supplierOrders, "cold pack").map((order) => order.id),
    ["ord-dairy"]
  );
  assert.deepEqual(
    filterSupplierOrdersBySearch(supplierOrders, "weekly").map((order) => order.id),
    ["ord-sysco-dry"]
  );
});
