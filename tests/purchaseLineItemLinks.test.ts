import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPurchaseLineLinkCandidates,
  selectLatestConfirmedUnitPriceForLink,
  suggestInventoryItemsForPurchaseLineKey
} from "../services/domain/purchaseLineItemLinks";
import {
  normalizePurchaseLineDescription,
  type PurchaseLine
} from "../services/domain/purchaseLines";
import type { InventoryItem } from "../types/mise";

function inventory(id: string, itemName: string): InventoryItem {
  return {
    id,
    restaurant_id: "rest-1",
    item_name: itemName,
    category: "produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2,
    supplier_id: "supplier-1",
    supplier_name: "Metro",
    last_updated: "2026-09-01T00:00:00.000Z"
  };
}

function line(partial: Partial<PurchaseLine> & Pick<PurchaseLine, "id" | "rawItemDescription">): PurchaseLine {
  const normalized = normalizePurchaseLineDescription(partial.rawItemDescription);
  return {
    restaurantId: "rest-1",
    supplierId: "supplier-1",
    lineIndex: 0,
    revision: 0,
    lineType: "purchase",
    normalizedItemKey: normalized.normalizedItemKey,
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
    ...partial
  };
}

test("suggestions require exact normalized purchase-line key equality", () => {
  const chicken = inventory("item-chicken", "Chicken Thighs Boneless 40 LB Case");
  const oil = inventory("item-oil", "Olive Oil Extra Virgin");
  const key = normalizePurchaseLineDescription("CHICKEN THIGHS, BONELESS - 40 LB CASE").normalizedItemKey!;
  const matches = suggestInventoryItemsForPurchaseLineKey(key, [chicken, oil]);
  assert.deepEqual(
    matches.map((item) => item.id),
    ["item-chicken"]
  );
  assert.equal(
    suggestInventoryItemsForPurchaseLineKey("chicken thigh boneless case", [chicken]).length,
    0,
    "near spellings must not fuzzy-match"
  );
});

test("link candidates stay supplier-scoped and prefer newest confirmed unit price", () => {
  const lines = [
    line({
      id: "line-1",
      rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
      unitPrice: 80,
      transactionDate: "2026-09-01",
      lineIndex: 0
    }),
    line({
      id: "line-2",
      rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
      unitPrice: 86.5,
      transactionDate: "2026-09-08",
      lineIndex: 0,
      sourceDocumentReference: "INV-2"
    }),
    line({
      id: "line-3",
      supplierId: null,
      rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
      unitPrice: 70,
      transactionDate: "2026-09-09",
      sourceDocumentReference: "INV-3"
    })
  ];
  const candidates = buildPurchaseLineLinkCandidates(lines, []);
  assert.equal(candidates.length, 2);
  const named = candidates.find((candidate) => candidate.supplierId === "supplier-1");
  const unnamed = candidates.find((candidate) => candidate.supplierId === null);
  assert.equal(named?.latestConfirmedUnitPrice, 86.5);
  assert.equal(named?.lineCount, 2);
  assert.equal(unnamed?.latestConfirmedUnitPrice, 70);
});

test("latest confirmed unit price lookup ignores credits and superseded lines", () => {
  const original = line({
    id: "line-original",
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    unitPrice: 100,
    transactionDate: "2026-09-01"
  });
  const correction = line({
    id: "line-correction",
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    unitPrice: 121.4,
    transactionDate: "2026-09-01",
    revision: 1,
    supersedesLineId: original.id,
    source: "manual_entry"
  });
  const credit = line({
    id: "line-credit",
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    lineType: "credit",
    unitPrice: 50,
    signedQuantity: -1,
    signedExtendedPrice: -50,
    transactionDate: "2026-09-10",
    source: "credit_memo",
    sourceDocumentReference: "CM-1"
  });
  const priced = selectLatestConfirmedUnitPriceForLink([original, correction, credit], {
    supplierId: "supplier-1",
    normalizedItemKey: correction.normalizedItemKey!
  });
  assert.equal(priced?.unitPrice, 121.4);
  assert.equal(priced?.lineId, correction.id);
});
