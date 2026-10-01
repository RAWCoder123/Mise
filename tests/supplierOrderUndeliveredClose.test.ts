import assert from "node:assert/strict";
import test from "node:test";

import {
  canCloseSupplierOrderUndelivered,
  normalizeUndeliveredCloseReason,
  requireUndeliveredCloseReason,
  undeliveredCloseReasonLabel
} from "../services/domain/supplierOrderUndeliveredClose";

test("undelivered close requires sent status and zero prior deliveries", () => {
  assert.equal(
    canCloseSupplierOrderUndelivered({ orderStatus: "sent", priorDeliveryCount: 0 }),
    true
  );
  assert.equal(
    canCloseSupplierOrderUndelivered({ orderStatus: "sent", priorDeliveryCount: 1 }),
    false
  );
  assert.equal(
    canCloseSupplierOrderUndelivered({ orderStatus: "draft", priorDeliveryCount: 0 }),
    false
  );
  assert.equal(
    canCloseSupplierOrderUndelivered({ orderStatus: "completed", priorDeliveryCount: 0 }),
    false
  );
});

test("undelivered close reasons are bounded and labeled", () => {
  assert.equal(normalizeUndeliveredCloseReason("never_arrived"), "never_arrived");
  assert.equal(normalizeUndeliveredCloseReason("supplier_cancelled"), "supplier_cancelled");
  assert.equal(normalizeUndeliveredCloseReason("ordered_in_error"), "ordered_in_error");
  assert.equal(normalizeUndeliveredCloseReason("other"), null);
  assert.equal(normalizeUndeliveredCloseReason(" never_arrived "), "never_arrived");
  assert.equal(requireUndeliveredCloseReason("ordered_in_error"), "ordered_in_error");
  assert.throws(() => requireUndeliveredCloseReason("short_accepted"));
  assert.equal(undeliveredCloseReasonLabel("never_arrived"), "Delivery never arrived");
  assert.equal(undeliveredCloseReasonLabel("supplier_cancelled"), "Supplier cancelled");
  assert.equal(undeliveredCloseReasonLabel("ordered_in_error"), "Ordered in error");
});
