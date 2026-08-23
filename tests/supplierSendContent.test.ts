import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSupplierSendContentPreview,
  requireSupplierSendContentFingerprint
} from "../services/miseValidation";
import { SUPPLIER_SEND_CONTENT_VERSION } from "../types/mise";

const restaurantId = "10000000-0000-4000-8000-000000000001";
const orderId = "20000000-0000-4000-8000-000000000001";
const fingerprint = "a".repeat(64);

function readyPreview(): {
  ready: boolean;
  blockerCodes: string[];
  lineCount: number;
  contentVersion: string;
  contentFingerprint: string | null;
  contentRevision: number;
  restaurantId: string;
  orderId: string;
  supplierName: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  body: string;
  deliveryDate: string | null;
  operatorNote: string | null;
  lines: Array<{
    recommendationId: string;
    inventoryItemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    supplierName: string;
  }>;
} {
  return {
    ready: true,
    blockerCodes: [],
    lineCount: 2,
    contentVersion: SUPPLIER_SEND_CONTENT_VERSION,
    contentFingerprint: fingerprint,
    contentRevision: 7,
    restaurantId,
    orderId,
    supplierName: "Local Produce Co.",
    from: "orders@example.com",
    to: "produce@example.com",
    subject: "Mise Cafe order for Local Produce Co.",
    body: "Order draft for Local Produce Co.\n\nTomatoes - 4 each",
    deliveryDate: "2026-08-24",
    operatorNote: "Use the side entrance.",
    lines: [
      {
        recommendationId: "30000000-0000-4000-8000-000000000001",
        inventoryItemId: "40000000-0000-4000-8000-000000000001",
        itemName: "Tomatoes",
        quantity: 4,
        unit: "each",
        supplierName: "Local Produce Co."
      },
      {
        recommendationId: "30000000-0000-4000-8000-000000000002",
        inventoryItemId: "40000000-0000-4000-8000-000000000002",
        itemName: "Onions",
        quantity: 2.5,
        unit: "kg",
        supplierName: "Local Produce Co."
      }
    ]
  };
}

test("supplier send preview parser accepts only the exact ready canonical snapshot", () => {
  const direct = normalizeSupplierSendContentPreview(readyPreview(), restaurantId, orderId);
  const array = normalizeSupplierSendContentPreview([readyPreview()], restaurantId, orderId);

  assert.equal(direct.ready, true);
  assert.equal(direct.canSend, true);
  assert.equal(direct.contentFingerprint, fingerprint);
  assert.equal(direct.lines.length, 2);
  assert.deepEqual(array, direct);
  assert.equal(requireSupplierSendContentFingerprint(fingerprint), fingerprint);
});

test("supplier send preview parser preserves bounded blocked readiness semantics", () => {
  const blocked = readyPreview();
  blocked.ready = false;
  blocked.blockerCodes = ["order_lines_missing"];
  blocked.lineCount = 0;
  blocked.lines = [];
  blocked.contentFingerprint = null;

  const preview = normalizeSupplierSendContentPreview(blocked, restaurantId, orderId);
  assert.equal(preview.ready, false);
  assert.equal(preview.canSend, false);
  assert.equal(preview.contentFingerprint, null);
  assert.deepEqual(preview.blockerCodes, ["order_lines_missing"]);
});

test("supplier send preview parser fails closed on stale scope, malformed authority, and noncanonical lines", () => {
  assert.throws(
    () => normalizeSupplierSendContentPreview(readyPreview(), restaurantId, `${orderId}-other`),
    /order identity/i
  );

  const missingFingerprint = readyPreview();
  missingFingerprint.contentFingerprint = null;
  assert.throws(
    () => normalizeSupplierSendContentPreview(missingFingerprint, restaurantId, orderId),
    /inconsistent authority/i
  );

  const mismatchedCount = readyPreview();
  mismatchedCount.lineCount = 1;
  assert.throws(
    () => normalizeSupplierSendContentPreview(mismatchedCount, restaurantId, orderId),
    /line count/i
  );

  const unsorted = readyPreview();
  unsorted.lines.reverse();
  assert.throws(
    () => normalizeSupplierSendContentPreview(unsorted, restaurantId, orderId),
    /not canonical/i
  );

  const oversizedSubject = readyPreview();
  oversizedSubject.subject = "S".repeat(501);
  assert.throws(
    () => normalizeSupplierSendContentPreview(oversizedSubject, restaurantId, orderId),
    /invalid subject/i
  );

  const unknownBlocker = readyPreview();
  unknownBlocker.ready = false;
  unknownBlocker.contentFingerprint = null;
  unknownBlocker.blockerCodes = ["unbounded_server_detail"];
  assert.throws(
    () => normalizeSupplierSendContentPreview(unknownBlocker, restaurantId, orderId),
    /invalid blocker/i
  );

  const unsafeBody = readyPreview();
  unsafeBody.body += "\u001b";
  assert.throws(
    () => normalizeSupplierSendContentPreview(unsafeBody, restaurantId, orderId),
    /invalid body/i
  );
});

test("supplier send content fingerprints require exact lowercase SHA-256 hex", () => {
  assert.throws(() => requireSupplierSendContentFingerprint("A".repeat(64)), /fingerprint/i);
  assert.throws(() => requireSupplierSendContentFingerprint(` ${fingerprint}`), /fingerprint/i);
  assert.throws(() => requireSupplierSendContentFingerprint("a".repeat(63)), /fingerprint/i);
  assert.throws(() => requireSupplierSendContentFingerprint(`${"a".repeat(62)}zz`), /fingerprint/i);
});
