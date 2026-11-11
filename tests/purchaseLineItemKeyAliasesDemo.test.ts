import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";
import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";

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

test("demo aliases join unmatched credits into invoice nets and support revoke", async () => {
  const repository = await demoRepository();

  const suppliers = await repository.fetchSuppliers(DEMO_RESTAURANT_ID);
  const supplierId = suppliers[0]?.id ?? null;
  assert.ok(supplierId, "demo seed exposes a supplier");

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-ALIAS-DEMO",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
        quantity: 2,
        unitOfMeasure: "case",
        unitPrice: 80,
        extendedPrice: 160,
        currency: "USD",
        transactionDate: "2026-09-10",
        parseConfidence: "confirmed"
      })
    ]
  });

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "credit_memo",
    sourceDocumentReference: "CM-ALIAS-DEMO",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "credit",
        rawItemDescription: "Chicken Thigh Boneless",
        quantity: 1,
        unitOfMeasure: "case",
        unitPrice: 80,
        extendedPrice: 80,
        currency: "USD",
        transactionDate: "2026-09-11",
        parseConfidence: "confirmed"
      })
    ]
  });

  const before = await repository.fetchPurchaseLineNetByItem(DEMO_RESTAURANT_ID);
  const unmatched = before.find((net) => net.normalizedItemKey === "chicken thigh boneless");
  assert.equal(unmatched?.unmatchedCredit, true);

  const created = await repository.aliasPurchaseLineItemKey({
    restaurantId: DEMO_RESTAURANT_ID,
    aliasItemKey: "chicken thigh boneless",
    canonicalItemKey: "chicken thighs boneless case",
    supplierId
  });
  assert.equal(created.status, "verified");

  const after = await repository.fetchPurchaseLineNetByItem(DEMO_RESTAURANT_ID);
  const joined = after.find((net) => net.normalizedItemKey === "chicken thighs boneless case");
  assert.equal(joined?.netQuantity, 1);
  assert.equal(joined?.unmatchedCredit, false);
  assert.equal(
    after.some((net) => net.normalizedItemKey === "chicken thigh boneless"),
    false
  );

  const revoked = await repository.revokePurchaseLineItemKeyAlias(DEMO_RESTAURANT_ID, created.id);
  assert.equal(revoked.status, "revoked");
  const restored = await repository.fetchPurchaseLineNetByItem(DEMO_RESTAURANT_ID);
  assert.equal(
    restored.find((net) => net.normalizedItemKey === "chicken thigh boneless")?.unmatchedCredit,
    true
  );
});
