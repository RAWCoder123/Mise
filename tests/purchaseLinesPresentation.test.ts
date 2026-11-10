import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_LINE_EVIDENCE_VERSION,
  PURCHASE_LINE_NORMALIZATION_VERSION,
  type PurchaseLine,
  type PurchaseLineNetByItem
} from "../services/domain/purchaseLines";
import {
  countUnmatchedPurchaseLineCredits,
  presentPurchaseLineHistory,
  presentPurchaseLineItemLabel,
  presentPurchaseLineNets
} from "../services/presentation/purchaseLinesPresentation";

function net(partial: Partial<PurchaseLineNetByItem> & Pick<PurchaseLineNetByItem, "normalizedItemKey">): PurchaseLineNetByItem {
  return {
    supplierId: "supplier-a",
    unitOfMeasure: "lb",
    currency: "USD",
    purchaseLineCount: 1,
    creditLineCount: 0,
    netQuantity: 2,
    netExtendedPrice: 20,
    unmatchedCredit: false,
    firstTransactionDate: "2026-09-01",
    lastTransactionDate: "2026-09-01",
    ...partial
  };
}

function line(
  partial: Partial<PurchaseLine & { current: boolean }> &
    Pick<PurchaseLine, "id" | "rawItemDescription" | "transactionDate">
): PurchaseLine & { current: boolean } {
  return {
    restaurantId: "restaurant-a",
    supplierId: "supplier-a",
    lineIndex: 0,
    revision: 1,
    lineType: "purchase",
    normalizedItemKey: "chicken thighs",
    normalizationVersion: PURCHASE_LINE_NORMALIZATION_VERSION,
    quantity: 2,
    unitOfMeasure: "lb",
    packSize: null,
    unitPrice: 10,
    extendedPrice: 20,
    currency: "USD",
    receivedDate: null,
    source: "invoice",
    sourceDocumentReference: "INV-1",
    correlationId: "corr-1",
    parseConfidence: "confirmed",
    consistencyFlags: [],
    signedQuantity: 2,
    signedExtendedPrice: 20,
    creditsLineId: null,
    supersedesLineId: null,
    evidenceVersion: PURCHASE_LINE_EVIDENCE_VERSION,
    recordedBy: null,
    recordedAt: "2026-09-01T12:00:00.000Z",
    current: true,
    ...partial
  };
}

test("presentPurchaseLineNets sorts unmatched credits first then newest date", () => {
  const presented = presentPurchaseLineNets([
    net({
      normalizedItemKey: "older matched",
      lastTransactionDate: "2026-09-01",
      unmatchedCredit: false
    }),
    net({
      normalizedItemKey: "newer matched",
      lastTransactionDate: "2026-09-03",
      unmatchedCredit: false
    }),
    net({
      normalizedItemKey: "unmatched credit",
      lastTransactionDate: "2026-08-01",
      unmatchedCredit: true,
      purchaseLineCount: 0,
      creditLineCount: 1,
      netQuantity: -1,
      netExtendedPrice: -41
    })
  ]);

  assert.equal(presented[0]?.itemLabel, "unmatched credit");
  assert.equal(presented[0]?.unmatchedCredit, true);
  assert.equal(presented[1]?.itemLabel, "newer matched");
  assert.equal(presented[2]?.itemLabel, "older matched");
  assert.equal(countUnmatchedPurchaseLineCredits(presented), 1);
});

test("presentPurchaseLineItemLabel soft-nulls blank labels without inventing from padding alone as truthy display", () => {
  assert.equal(presentPurchaseLineItemLabel("chicken thighs"), "chicken thighs");
  assert.equal(presentPurchaseLineItemLabel("  chicken thighs  "), "  chicken thighs  ");
  assert.equal(presentPurchaseLineItemLabel(""), null);
  assert.equal(presentPurchaseLineItemLabel("   "), null);
  assert.equal(presentPurchaseLineItemLabel(null), null);
  assert.equal(presentPurchaseLineItemLabel(undefined), null);
});

test("presentPurchaseLineHistory sorts newest first and preserves current flag", () => {
  const presented = presentPurchaseLineHistory([
    line({
      id: "old",
      rawItemDescription: "Old chicken",
      transactionDate: "2026-09-01",
      recordedAt: "2026-09-01T10:00:00.000Z",
      current: true
    }),
    line({
      id: "new",
      rawItemDescription: "New chicken",
      transactionDate: "2026-09-03",
      recordedAt: "2026-09-03T10:00:00.000Z",
      current: false,
      lineType: "credit"
    }),
    line({
      id: "blank",
      rawItemDescription: "   ",
      transactionDate: "2026-09-02",
      recordedAt: "2026-09-02T10:00:00.000Z",
      current: true
    })
  ]);

  assert.deepEqual(
    presented.map((row) => row.id),
    ["new", "blank", "old"]
  );
  assert.equal(presented[0]?.lineType, "credit");
  assert.equal(presented[0]?.current, false);
  assert.equal(presented[1]?.itemLabel, null);
  assert.equal(presented[2]?.itemLabel, "Old chicken");
});
