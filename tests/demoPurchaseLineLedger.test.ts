import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";
import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";

const INVOICE = [
  {
    lineIndex: 0,
    lineType: "purchase" as const,
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    quantity: 2,
    unitOfMeasure: "case",
    unitPrice: 86.5,
    extendedPrice: 173,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed" as const
  },
  {
    lineIndex: 1,
    lineType: "purchase" as const,
    rawItemDescription: "Olive Oil X-Virgin 6/1GAL",
    quantity: 1,
    unitOfMeasure: "case",
    unitPrice: 121.4,
    extendedPrice: 121.4,
    currency: "USD",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed" as const
  },
  {
    // The parser could not read a price off this line.
    lineIndex: 2,
    lineType: "purchase" as const,
    rawItemDescription: "Napa Cabbage - 50 ct",
    quantity: 1,
    unitOfMeasure: "case",
    transactionDate: "2026-09-01",
    parseConfidence: "confirmed" as const
  }
];

async function demoRepository() {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  return repository;
}

function ingest(lines: typeof INVOICE) {
  return { lines: lines.map(normalizePurchaseLineInput) };
}

test("demo ingestion is idempotent, truthful, and append-only", async () => {
  const repository = await demoRepository();
  const first = await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    ...ingest(INVOICE)
  });
  assert.equal(first.recordedLineCount, 3);
  assert.equal(first.duplicateLineCount, 0);
  assert.equal(first.confirmedCount, 2);
  assert.equal(first.couldNotVerifyCount, 1, "the unpriced line is visible, not dropped");
  assert.ok(first.activityEventId, "every ingestion emits an activity record");

  const replay = await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    ...ingest(INVOICE)
  });
  assert.equal(replay.recordedLineCount, 0);
  assert.equal(replay.duplicateLineCount, 3);

  const lines = await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID);
  const invoiceLines = lines.filter((line) => line.sourceDocumentReference === "INV-4471");
  assert.equal(invoiceLines.length, 3, "re-ingestion must not duplicate lines");
  assert.deepEqual(
    invoiceLines.map((line) => line.normalizedItemKey).sort(),
    ["chicken thighs boneless case", "napa cabbage", "olive oil x virgin"]
  );
  const unpriced = invoiceLines.find((line) => line.lineIndex === 2);
  assert.equal(unpriced?.parseConfidence, "could_not_verify");
  assert.equal(unpriced?.unitPrice, null, "an unreadable price stays null, never zero");
});

test("demo ingestion refuses two lines claiming one document position", async () => {
  const repository = await demoRepository();
  await assert.rejects(
    repository.ingestPurchaseLines({
      restaurantId: DEMO_RESTAURANT_ID,
      source: "invoice",
      sourceDocumentReference: "INV-DUP",
      ...ingest([INVOICE[0]!, { ...INVOICE[1]!, lineIndex: 0 }])
    }),
    /submitted twice/
  );
});

test("demo ingestion fails closed on a supplier from another restaurant", async () => {
  const repository = await demoRepository();
  await assert.rejects(
    repository.ingestPurchaseLines({
      restaurantId: DEMO_RESTAURANT_ID,
      source: "invoice",
      sourceDocumentReference: "INV-FOREIGN",
      supplierId: "00000000-0000-4000-8000-0000000000ff",
      ...ingest(INVOICE)
    }),
    /Supplier identity is not available/
  );
});

test("demo corrections append a superseding line and leave history intact", async () => {
  const repository = await demoRepository();
  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    ...ingest(INVOICE)
  });
  const original = (await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)).find(
    (line) => line.sourceDocumentReference === "INV-4471" && line.lineIndex === 2
  );
  assert.ok(original);

  const correction = await repository.supersedePurchaseLine(
    DEMO_RESTAURANT_ID,
    original.id,
    normalizePurchaseLineInput({
      lineIndex: 2,
      lineType: "purchase" as const,
      rawItemDescription: "Napa Cabbage - 50 ct",
      quantity: 2,
      unitOfMeasure: "case",
      unitPrice: 31.25,
      extendedPrice: 62.5,
      currency: "USD",
      transactionDate: "2026-09-01",
      parseConfidence: "confirmed"
    })
  );
  assert.equal(correction.revision, 1);
  assert.equal(correction.supersedesLineId, original.id);
  assert.equal(correction.parseConfidence, "confirmed");
  assert.equal(correction.source, "manual_entry");

  const after = (await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)).find(
    (line) => line.id === original.id
  );
  assert.equal(after?.quantity, 1, "the corrected line is never rewritten");
  assert.equal(after?.parseConfidence, "could_not_verify");

  await assert.rejects(
    repository.supersedePurchaseLine(
      DEMO_RESTAURANT_ID,
      original.id,
      normalizePurchaseLineInput({
        lineIndex: 2,
        lineType: "purchase" as const,
        rawItemDescription: "Napa Cabbage - 50 ct",
        transactionDate: "2026-09-01",
        parseConfidence: "estimated"
      })
    ),
    /already been corrected/
  );
});

test("demo reads stay inside the requested restaurant", async () => {
  const repository = await demoRepository();
  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    ...ingest(INVOICE)
  });
  const lines = await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID);
  assert.ok(lines.length > 0);
  assert.ok(
    lines.every((line) => line.restaurantId === DEMO_RESTAURANT_ID),
    "no line may leak across restaurants"
  );
});

test("demo credits net against purchases and flag what they cannot match", async () => {
  const repository = await demoRepository();
  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    ...ingest(INVOICE)
  });
  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "credit_memo",
    sourceDocumentReference: "CM-8892",
    lines: [
      {
        lineIndex: 0,
        lineType: "credit" as const,
        rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
        quantity: 1,
        unitOfMeasure: "case",
        unitPrice: 86.5,
        extendedPrice: 86.5,
        currency: "USD",
        transactionDate: "2026-09-03",
        parseConfidence: "confirmed" as const
      },
      {
        // Wording the invoice never used, so it cannot net. 004A may not
        // fuzzy-match it into the chicken group.
        lineIndex: 1,
        lineType: "credit" as const,
        rawItemDescription: "Saffron Threads 2oz",
        quantity: 1,
        unitOfMeasure: "each",
        unitPrice: 41,
        extendedPrice: 41,
        currency: "USD",
        transactionDate: "2026-09-03",
        parseConfidence: "confirmed" as const
      }
    ].map(normalizePurchaseLineInput)
  });

  const nets = await repository.fetchPurchaseLineNetByItem(DEMO_RESTAURANT_ID);
  const chicken = nets.find((net) => net.normalizedItemKey === "chicken thighs boneless case");
  assert.equal(chicken?.netQuantity, 1, "two purchased less one credited");
  assert.equal(chicken?.netExtendedPrice, 86.5);
  assert.equal(chicken?.unmatchedCredit, false);

  const saffron = nets.find((net) => net.normalizedItemKey === "saffron threads");
  assert.equal(saffron?.netQuantity, -1);
  assert.equal(
    saffron?.unmatchedCredit,
    true,
    "a credit matching no purchase is surfaced, not netted into silence"
  );

  const credit = (await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)).find(
    (line) => line.sourceDocumentReference === "CM-8892" && line.lineIndex === 0
  );
  assert.equal(credit?.quantity, 1, "magnitudes stay positive");
  assert.equal(credit?.signedQuantity, -1, "direction lives in the signed projection");
  assert.equal(credit?.parseConfidence, "confirmed", "linkage never affects confidence");
});
