import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  HIGH_ATTENTION_STOCKOUT_REASON_CODES,
  isStockoutReasonCode,
  requireStockoutReasonCode,
  STOCKOUT_REASON_CODES,
  stockoutReasonMessageKey
} from "../services/domain/stockoutReasonCodes";
import { requireInventoryOperation } from "../services/miseValidation";

test("stockout reason allowlist covers the operator categories", () => {
  assert.deepEqual([...STOCKOUT_REASON_CODES], [
    "under_ordered",
    "unexpected_demand",
    "delivery_missed",
    "spoilage_cleared",
    "theft_loss",
    "other"
  ]);
  assert.equal(isStockoutReasonCode("under_ordered"), true);
  assert.equal(isStockoutReasonCode("delivery"), false);
  assert.equal(stockoutReasonMessageKey("delivery_missed"), "stockout.reason.delivery_missed");
  assert.equal(stockoutReasonMessageKey(null), "stockout.reason.unspecified");
  assert.ok(HIGH_ATTENTION_STOCKOUT_REASON_CODES.has("unexpected_demand"));
  assert.equal(HIGH_ATTENTION_STOCKOUT_REASON_CODES.has("other"), false);
});

test("stockout reason codes normalize spacing and reject blank or unknown values", () => {
  assert.equal(requireStockoutReasonCode(" Under Ordered "), "under_ordered");
  assert.equal(requireStockoutReasonCode("delivery-missed"), "delivery_missed");
  assert.throws(() => requireStockoutReasonCode(""), /Choose a stockout reason/);
  assert.throws(() => requireStockoutReasonCode(undefined), /Choose a stockout reason/);
  assert.throws(() => requireStockoutReasonCode("delivery"), /supported stockout reason/);
  assert.throws(() => requireStockoutReasonCode(12), /Choose a stockout reason/);
});

test("stockout inventory operations require allowlisted reason codes", () => {
  const base = {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z"
  } as const;

  assert.equal(
    requireInventoryOperation({ ...base, reasonCode: " Unexpected Demand " }).reasonCode,
    "unexpected_demand"
  );
  assert.throws(() => requireInventoryOperation(base), /Choose a stockout reason/);
  assert.throws(
    () => requireInventoryOperation({ ...base, reasonCode: "delivery" }),
    /supported stockout reason/
  );
  assert.equal(
    requireInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "receipt",
      quantity: 250,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      reasonCode: "delivery"
    }).reasonCode,
    "delivery"
  );
});

test("inventory detail requires a stockout reason before queueing stockout events", () => {
  const detail = readFileSync(join(process.cwd(), "app/inventory/[id].tsx"), "utf8");
  assert.match(detail, /STOCKOUT_REASON_CODES/);
  assert.match(detail, /inventory\.ops\.stockoutReason\.required/);
  assert.match(detail, /reasonCode:\s*operation === "stockout" \? stockoutReason/);
  assert.match(detail, /stockoutReasonMessageKey/);
});
