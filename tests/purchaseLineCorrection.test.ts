import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  markCurrentPurchaseLines,
  normalizePurchaseLineInput,
  type PurchaseLine
} from "../services/domain/purchaseLines";
import {
  buildPurchaseLineCorrectionFromDraft,
  createPurchaseLineCorrectionDraft,
  listCorrectablePurchaseLines,
  type PurchaseLineCorrectionDraft
} from "../services/presentation/purchaseLineCorrection";

function sampleLine(overrides: Partial<PurchaseLine> = {}): PurchaseLine {
  return {
    id: "line-1",
    restaurantId: "rest-1",
    supplierId: "supplier-1",
    lineIndex: 2,
    revision: 0,
    lineType: "purchase",
    rawItemDescription: "Napa Cabbage - 50 ct",
    normalizedItemKey: "napa cabbage",
    normalizationVersion: "mise.purchase_line_normalization.v1",
    quantity: 1,
    unitOfMeasure: "case",
    packSize: "50ct",
    unitPrice: null,
    extendedPrice: null,
    currency: null,
    transactionDate: "2026-09-01",
    receivedDate: null,
    source: "invoice",
    sourceDocumentReference: "INV-4471",
    correlationId: "corr-1",
    parseConfidence: "could_not_verify",
    consistencyFlags: [],
    signedQuantity: 1,
    signedExtendedPrice: null,
    creditsLineId: null,
    supersedesLineId: null,
    evidenceVersion: "mise.purchase_line.v1",
    recordedBy: "user-1",
    recordedAt: "2026-09-01T12:00:00.000Z",
    ...overrides
  };
}

function draftFrom(line: PurchaseLine = sampleLine(), patch: Partial<PurchaseLineCorrectionDraft> = {}) {
  return {
    ...createPurchaseLineCorrectionDraft(line),
    ...patch
  };
}

test("listCorrectablePurchaseLines keeps only current lines newest first", () => {
  const lines = markCurrentPurchaseLines([
    sampleLine({ id: "old", transactionDate: "2026-08-01" }),
    sampleLine({
      id: "newer",
      transactionDate: "2026-09-10",
      sourceDocumentReference: "INV-2"
    }),
    sampleLine({
      id: "correction",
      supersedesLineId: "old",
      revision: 1,
      transactionDate: "2026-09-11"
    })
  ]);
  const correctable = listCorrectablePurchaseLines(lines);
  assert.deepEqual(
    correctable.map((line) => line.id),
    ["correction", "newer"]
  );
});

test("createPurchaseLineCorrectionDraft prefills measurable fields and raises unverified confidence", () => {
  const draft = createPurchaseLineCorrectionDraft(sampleLine());
  assert.equal(draft.rawItemDescription, "Napa Cabbage - 50 ct");
  assert.equal(draft.quantityText, "1");
  assert.equal(draft.unitOfMeasure, "case");
  assert.equal(draft.packSize, "50ct");
  assert.equal(draft.unitPriceText, "");
  assert.equal(draft.parseConfidence, "estimated");
});

test("buildPurchaseLineCorrectionFromDraft accepts a priced correction and locks identity", () => {
  const line = sampleLine();
  const built = buildPurchaseLineCorrectionFromDraft({
    line,
    draft: draftFrom(line, {
      quantityText: "2",
      unitPriceText: "31.25",
      extendedPriceText: "62.5",
      currency: "USD",
      parseConfidence: "confirmed"
    })
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.lineId, "line-1");
  assert.equal(built.correction.lineIndex, 2);
  assert.equal(built.correction.lineType, "purchase");
  assert.equal(built.correction.quantity, 2);
  assert.equal(built.correction.unitPrice, 31.25);
  assert.equal(built.correction.currency, "USD");
  assert.equal(built.correction.parseConfidence, "confirmed");
});

test("buildPurchaseLineCorrectionFromDraft rejects unchanged and invalid drafts", () => {
  const line = sampleLine({
    parseConfidence: "estimated",
    unitPrice: 10,
    extendedPrice: 10,
    currency: "USD"
  });
  const unchanged = buildPurchaseLineCorrectionFromDraft({
    line,
    draft: draftFrom(line)
  });
  assert.equal(unchanged.ok, false);
  if (!unchanged.ok) assert.equal(unchanged.error, "unchanged");

  const missingDescription = buildPurchaseLineCorrectionFromDraft({
    line,
    draft: draftFrom(line, { rawItemDescription: "  ", quantityText: "3" })
  });
  assert.equal(missingDescription.ok, false);
  if (!missingDescription.ok) assert.equal(missingDescription.error, "missing_description");

  const pricedWithoutCurrency = buildPurchaseLineCorrectionFromDraft({
    line: sampleLine(),
    draft: draftFrom(sampleLine(), {
      unitPriceText: "12",
      currency: ""
    })
  });
  assert.equal(pricedWithoutCurrency.ok, false);
  if (!pricedWithoutCurrency.ok) {
    assert.equal(pricedWithoutCurrency.error, "priced_without_currency");
  }

  const creditOnPurchase = buildPurchaseLineCorrectionFromDraft({
    line: sampleLine(),
    draft: draftFrom(sampleLine(), {
      quantityText: "2",
      creditsLineId: "other-line"
    })
  });
  assert.equal(creditOnPurchase.ok, false);
  if (!creditOnPurchase.ok) {
    assert.equal(creditOnPurchase.error, "credits_line_on_purchase");
  }
});

test("correction draft path appends through the demo ledger without rewriting history", async () => {
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
  const { DEMO_RESTAURANT_ID } = await import("../services/demo/replaceableDemoData");
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: "INV-CORR-1",
    lines: [
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: "Roma Tomatoes 25LB",
        quantity: 1,
        unitOfMeasure: "case",
        transactionDate: "2026-11-11",
        parseConfidence: "confirmed"
      })
    ]
  });

  const history = markCurrentPurchaseLines(
    await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)
  );
  const original = listCorrectablePurchaseLines(history).find(
    (line) => line.sourceDocumentReference === "INV-CORR-1"
  );
  assert.ok(original);

  const built = buildPurchaseLineCorrectionFromDraft({
    line: original,
    draft: draftFrom(original, {
      quantityText: "3",
      unitPriceText: "28.5",
      extendedPriceText: "85.5",
      currency: "USD",
      parseConfidence: "confirmed"
    })
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const correction = await repository.supersedePurchaseLine(
    DEMO_RESTAURANT_ID,
    built.lineId,
    normalizePurchaseLineInput(built.correction)
  );
  assert.equal(correction.revision, 1);
  assert.equal(correction.supersedesLineId, original.id);
  assert.equal(correction.quantity, 3);
  assert.equal(correction.source, "manual_entry");

  const after = markCurrentPurchaseLines(
    await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID)
  );
  const originalAfter = after.find((line) => line.id === original.id);
  assert.equal(originalAfter?.current, false);
  assert.equal(originalAfter?.quantity, 1, "original history stays intact");
  assert.equal(
    listCorrectablePurchaseLines(after).some((line) => line.id === original.id),
    false
  );
  assert.equal(
    listCorrectablePurchaseLines(after).some((line) => line.id === correction.id),
    true
  );
});

test("purchase-line correction screen stays on application correctPurchaseLine and hub readiness", () => {
  const screen = readFileSync("app/more/purchase-line-correction.tsx", "utf8");
  assert.match(screen, /correctPurchaseLine/);
  assert.match(screen, /fetchPurchaseLineHistory/);
  assert.match(screen, /from \"\.\.\/\.\.\/services\/miseService\"/);
  assert.match(screen, /canManageRestaurantData/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /buildPurchaseLineCorrectionFromDraft/);
  assert.doesNotMatch(screen, /\.from\(\s*[\"']purchase_lines[\"']/);
  assert.doesNotMatch(screen, /supersede_purchase_line/);
  assert.doesNotMatch(screen, /service_role|SERVICE_ROLE|supabaseKey/i);

  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  assert.match(more, /\/more\/purchase-line-correction/);
  assert.match(more, /more\.row\.purchaseLineCorrection\.title/);
});
