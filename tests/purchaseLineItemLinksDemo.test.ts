import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";
import { normalizePurchaseLineDescription, normalizePurchaseLineInput } from "../services/domain/purchaseLines";

async function demoRepository() {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  return repository;
}

test("demo managers can link invoice keys, apply confirmed cost, and revoke", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const target = items[0];
  assert.ok(target, "demo inventory must include at least one item");

  const rawDescription = target.item_name;
  const key = normalizePurchaseLineDescription(rawDescription).normalizedItemKey;
  assert.ok(key, "demo inventory names must normalize to a purchase-line key");

  const supplierId = target.supplier_id ?? null;
  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-LINK-1",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: rawDescription,
        quantity: 2,
        unitOfMeasure: target.unit,
        unitPrice: 12.75,
        extendedPrice: 25.5,
        currency: "USD",
        transactionDate: "2026-09-10",
        parseConfidence: "confirmed"
      })
    ]
  });

  const linked = await repository.linkPurchaseLineItem({
    restaurantId: DEMO_RESTAURANT_ID,
    normalizedItemKey: key!,
    inventoryItemId: target.id,
    supplierId
  });
  assert.equal(linked.status, "verified");
  assert.equal(linked.inventoryItemId, target.id);
  assert.equal(linked.normalizedItemKey, key);

  const replay = await repository.linkPurchaseLineItem({
    restaurantId: DEMO_RESTAURANT_ID,
    normalizedItemKey: key!,
    inventoryItemId: target.id,
    supplierId
  });
  assert.equal(replay.id, linked.id, "identical verification is idempotent");

  const updated = await repository.applyPurchaseLineLinkedUnitCost(DEMO_RESTAURANT_ID, linked.id);
  assert.equal(updated.estimated_unit_cost, 12.75);

  const revoked = await repository.revokePurchaseLineItemLink(DEMO_RESTAURANT_ID, linked.id);
  assert.equal(revoked.status, "revoked");
  assert.ok(revoked.revokedAt);

  await assert.rejects(
    () => repository.applyPurchaseLineLinkedUnitCost(DEMO_RESTAURANT_ID, linked.id),
    /Verified purchase line item link is required/
  );
});
