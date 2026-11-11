import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPurchaseLineAliasCandidates,
  netPurchaseLinesWithAliases,
  resolvePurchaseLineItemKey,
  type PurchaseLineItemKeyAlias
} from "../services/domain/purchaseLineItemKeyAliases";
import {
  normalizePurchaseLineDescription,
  type PurchaseLine
} from "../services/domain/purchaseLines";

function line(
  partial: Partial<PurchaseLine> & Pick<PurchaseLine, "id" | "rawItemDescription">
): PurchaseLine {
  const normalized = normalizePurchaseLineDescription(partial.rawItemDescription);
  return {
    restaurantId: "rest-1",
    supplierId: "supplier-1",
    lineIndex: 0,
    revision: 0,
    lineType: "purchase",
    normalizationVersion: "mise.purchase_line_normalization.v1",
    quantity: 1,
    unitOfMeasure: "case",
    packSize: normalized.packSize,
    unitPrice: 10,
    extendedPrice: 10,
    currency: "USD",
    transactionDate: "2026-09-01",
    receivedDate: null,
    source: "invoice",
    sourceDocumentReference: "INV-1",
    correlationId: "corr-1",
    parseConfidence: "confirmed",
    consistencyFlags: [],
    signedQuantity: 1,
    signedExtendedPrice: 10,
    creditsLineId: null,
    supersedesLineId: null,
    evidenceVersion: "mise.purchase_line.v1",
    recordedBy: "user-1",
    recordedAt: "2026-09-01T12:00:00.000Z",
    ...partial,
    normalizedItemKey: partial.normalizedItemKey ?? normalized.normalizedItemKey
  };
}

function alias(
  partial: Partial<PurchaseLineItemKeyAlias> &
    Pick<PurchaseLineItemKeyAlias, "id" | "aliasItemKey" | "canonicalItemKey">
): PurchaseLineItemKeyAlias {
  return {
    restaurantId: "rest-1",
    supplierId: "supplier-1",
    status: "verified",
    evidenceVersion: "mise.purchase_line_item_key_alias.v1",
    aliasedBy: "user-1",
    aliasedAt: "2026-09-12T12:00:00.000Z",
    revokedBy: null,
    revokedAt: null,
    ...partial
  };
}

test("resolvePurchaseLineItemKey applies one verified hop only", () => {
  const aliases = [
    alias({
      id: "alias-1",
      aliasItemKey: "chicken thigh boneless",
      canonicalItemKey: "chicken thighs boneless case"
    })
  ];
  assert.equal(
    resolvePurchaseLineItemKey("chicken thigh boneless", "supplier-1", aliases),
    "chicken thighs boneless case"
  );
  assert.equal(
    resolvePurchaseLineItemKey("chicken thigh boneless", "other-supplier", aliases),
    "chicken thigh boneless",
    "aliases never cross suppliers"
  );
  assert.equal(
    resolvePurchaseLineItemKey("unrelated key", "supplier-1", aliases),
    "unrelated key"
  );
});

test("alias candidates surface unmatched credits with exact purchase-key targets", () => {
  const purchaseKey = normalizePurchaseLineDescription(
    "Chicken Thighs Boneless 40 LB Case"
  ).normalizedItemKey!;
  const creditKey = normalizePurchaseLineDescription("Chicken Thigh Boneless").normalizedItemKey!;
  assert.notEqual(purchaseKey, creditKey);

  const candidates = buildPurchaseLineAliasCandidates(
    [
      line({
        id: "purchase-1",
        rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
        quantity: 2,
        extendedPrice: 160,
        signedQuantity: 2,
        signedExtendedPrice: 160
      }),
      line({
        id: "credit-1",
        rawItemDescription: "Chicken Thigh Boneless",
        lineType: "credit",
        source: "credit_memo",
        sourceDocumentReference: "CM-1",
        quantity: 1,
        extendedPrice: 80,
        signedQuantity: -1,
        signedExtendedPrice: -80,
        transactionDate: "2026-09-08"
      }),
      line({
        id: "credit-match",
        rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
        lineType: "credit",
        source: "credit_memo",
        sourceDocumentReference: "CM-2",
        quantity: 1,
        extendedPrice: 80,
        signedQuantity: -1,
        signedExtendedPrice: -80,
        transactionDate: "2026-09-09"
      })
    ],
    []
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.aliasItemKey, creditKey);
  assert.deepEqual(candidates[0]?.canonicalTargets, [purchaseKey]);
  assert.equal(candidates[0]?.aliasId, null);
});

test("nets apply aliases so unmatched credits join their invoice group", () => {
  const purchaseKey = normalizePurchaseLineDescription(
    "Chicken Thighs Boneless 40 LB Case"
  ).normalizedItemKey!;
  const creditKey = normalizePurchaseLineDescription("Chicken Thigh Boneless").normalizedItemKey!;
  const lines = [
    line({
      id: "purchase-1",
      rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
      quantity: 2,
      extendedPrice: 160,
      signedQuantity: 2,
      signedExtendedPrice: 160
    }),
    line({
      id: "credit-1",
      rawItemDescription: "Chicken Thigh Boneless",
      lineType: "credit",
      source: "credit_memo",
      sourceDocumentReference: "CM-1",
      quantity: 1,
      extendedPrice: 80,
      signedQuantity: -1,
      signedExtendedPrice: -80
    })
  ];

  const before = netPurchaseLinesWithAliases(lines, []);
  assert.equal(before.length, 2);
  assert.equal(before.find((net) => net.normalizedItemKey === creditKey)?.unmatchedCredit, true);

  const after = netPurchaseLinesWithAliases(lines, [
    alias({
      id: "alias-1",
      aliasItemKey: creditKey,
      canonicalItemKey: purchaseKey
    })
  ]);
  assert.equal(after.length, 1);
  assert.equal(after[0]?.normalizedItemKey, purchaseKey);
  assert.equal(after[0]?.netQuantity, 1);
  assert.equal(after[0]?.unmatchedCredit, false);
});

test("near spellings never appear as automatic alias targets", () => {
  const purchaseKey = normalizePurchaseLineDescription(
    "Olive Oil Extra Virgin"
  ).normalizedItemKey!;
  const creditKey = normalizePurchaseLineDescription("Olive Oil X Virgin").normalizedItemKey!;
  assert.notEqual(purchaseKey, creditKey);
  const candidates = buildPurchaseLineAliasCandidates(
    [
      line({
        id: "purchase-oil",
        rawItemDescription: "Olive Oil Extra Virgin"
      }),
      line({
        id: "credit-oil",
        rawItemDescription: "Olive Oil X Virgin",
        lineType: "credit",
        source: "credit_memo",
        sourceDocumentReference: "CM-OIL"
      })
    ],
    []
  );
  assert.equal(candidates[0]?.canonicalTargets.includes(creditKey), false);
  assert.deepEqual(candidates[0]?.canonicalTargets, [purchaseKey]);
});
