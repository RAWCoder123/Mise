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

test("demo managers can attach unlinked credits and revoke attachments", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const target = items.find((item) => item.supplier_id);
  assert.ok(target, "demo inventory must include a supplier-backed item");
  const supplierId = target.supplier_id!;

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-CREDIT-ATTACH-1",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: target.item_name,
        quantity: 2,
        unitOfMeasure: target.unit,
        unitPrice: 12.75,
        extendedPrice: 25.5,
        currency: "USD",
        transactionDate: "2026-09-01",
        parseConfidence: "confirmed"
      })
    ]
  });

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "credit_memo",
    sourceDocumentReference: "CM-CREDIT-ATTACH-1",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "credit",
        rawItemDescription: target.item_name,
        quantity: 1,
        unitOfMeasure: target.unit,
        unitPrice: 12.75,
        extendedPrice: 12.75,
        currency: "USD",
        transactionDate: "2026-09-08",
        parseConfidence: "confirmed"
      })
    ]
  });

  const lines = await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID);
  const purchase = lines.find(
    (line) =>
      line.sourceDocumentReference === "INV-CREDIT-ATTACH-1" && line.lineType === "purchase"
  );
  const credit = lines.find(
    (line) => line.sourceDocumentReference === "CM-CREDIT-ATTACH-1" && line.lineType === "credit"
  );
  assert.ok(purchase);
  assert.ok(credit);
  assert.equal(credit.creditsLineId, null);

  const attached = await repository.attachPurchaseLineCredit({
    restaurantId: DEMO_RESTAURANT_ID,
    creditLineId: credit.id,
    purchaseLineId: purchase.id
  });
  assert.equal(attached.status, "verified");
  assert.equal(attached.creditLineId, credit.id);
  assert.equal(attached.purchaseLineId, purchase.id);

  const replay = await repository.attachPurchaseLineCredit({
    restaurantId: DEMO_RESTAURANT_ID,
    creditLineId: credit.id,
    purchaseLineId: purchase.id
  });
  assert.equal(replay.id, attached.id, "identical attachment is idempotent");

  const revoked = await repository.revokePurchaseLineCreditAttachment(
    DEMO_RESTAURANT_ID,
    attached.id
  );
  assert.equal(revoked.status, "revoked");
  assert.ok(revoked.revokedAt);

  await assert.rejects(
    () =>
      repository.attachPurchaseLineCredit({
        restaurantId: DEMO_RESTAURANT_ID,
        creditLineId: purchase.id,
        purchaseLineId: credit.id
      }),
    /Only a credit line may receive a manager attachment/
  );
});

test("demo refuses attaching when the credit already names a document link", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const target = items.find((item) => item.supplier_id);
  assert.ok(target);
  const supplierId = target.supplier_id!;

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-CREDIT-ATTACH-2",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: target.item_name,
        quantity: 1,
        unitOfMeasure: target.unit,
        unitPrice: 8,
        extendedPrice: 8,
        currency: "USD",
        transactionDate: "2026-09-02",
        parseConfidence: "confirmed"
      })
    ]
  });
  const purchase = (await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)).find(
    (line) => line.sourceDocumentReference === "INV-CREDIT-ATTACH-2"
  );
  assert.ok(purchase);

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "credit_memo",
    sourceDocumentReference: "CM-CREDIT-ATTACH-2",
    supplierId,
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "credit",
        rawItemDescription: target.item_name,
        creditsLineId: purchase.id,
        quantity: 1,
        unitOfMeasure: target.unit,
        unitPrice: 8,
        extendedPrice: 8,
        currency: "USD",
        transactionDate: "2026-09-03",
        parseConfidence: "confirmed"
      })
    ]
  });
  const credit = (await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)).find(
    (line) => line.sourceDocumentReference === "CM-CREDIT-ATTACH-2"
  );
  assert.ok(credit);
  assert.equal(credit.creditsLineId, purchase.id);

  await assert.rejects(
    () =>
      repository.attachPurchaseLineCredit({
        restaurantId: DEMO_RESTAURANT_ID,
        creditLineId: credit.id,
        purchaseLineId: purchase.id
      }),
    /Credit already names its offset on the source document/
  );
});
