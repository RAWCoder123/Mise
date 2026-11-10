import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDeliveryHistorySource,
  supplierNameFromDeliveryMetadata
} from "../services/domain/deliveryHistorySource";

test("classifyDeliveryHistorySource maps operator and supplier write paths", () => {
  assert.equal(classifyDeliveryHistorySource("operator_receipt"), "operator_receipt");
  assert.equal(classifyDeliveryHistorySource(" supplier_delivery "), "supplier_delivery");
  assert.equal(classifyDeliveryHistorySource("receiving"), "other");
  assert.equal(classifyDeliveryHistorySource(""), "other");
  assert.equal(classifyDeliveryHistorySource(null), "other");
  assert.equal(classifyDeliveryHistorySource(undefined), "other");
});

test("supplierNameFromDeliveryMetadata soft-nulls blank and non-string values", () => {
  assert.equal(
    supplierNameFromDeliveryMetadata({ supplierName: "Fresh Poultry Supply" }),
    "Fresh Poultry Supply"
  );
  assert.equal(supplierNameFromDeliveryMetadata({ supplierName: "  " }), null);
  assert.equal(supplierNameFromDeliveryMetadata({ supplierName: 12 }), null);
  assert.equal(supplierNameFromDeliveryMetadata({ note: "Morning drop" }), null);
  assert.equal(supplierNameFromDeliveryMetadata(null), null);
  assert.equal(supplierNameFromDeliveryMetadata(undefined), null);
});
