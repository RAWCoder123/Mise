import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildPurchaseLineInputsFromDraft,
  createEmptyPurchaseLineEntryDraftLine,
  presentPurchaseLineIngestionSummary,
  type PurchaseLineEntryDraft
} from "../services/presentation/purchaseLineEntry";

function draft(
  partial: Partial<PurchaseLineEntryDraft> &
    Pick<PurchaseLineEntryDraft, "sourceDocumentReference" | "lines">
): PurchaseLineEntryDraft {
  return {
    source: "invoice",
    lineType: "purchase",
    supplierId: "supplier-a",
    transactionDate: "2026-11-11",
    receivedDate: "",
    currency: "USD",
    parseConfidence: "confirmed",
    ...partial
  };
}

test("buildPurchaseLineInputsFromDraft accepts a complete invoice line", () => {
  const built = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "INV-100",
      lines: [
        {
          rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
          quantityText: "2",
          unitOfMeasure: "case",
          packSize: "40lb",
          unitPriceText: "86.5",
          extendedPriceText: "173",
          creditsLineId: ""
        },
        createEmptyPurchaseLineEntryDraftLine()
      ]
    })
  );
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.sourceDocumentReference, "INV-100");
  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.lineIndex, 0);
  assert.equal(built.lines[0]!.quantity, 2);
  assert.equal(built.lines[0]!.currency, "USD");
  assert.equal(built.lines[0]!.packSize, "40lb");
});

test("buildPurchaseLineInputsFromDraft rejects incomplete and priced-without-currency drafts", () => {
  const missingDocument = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "",
      lines: [
        {
          ...createEmptyPurchaseLineEntryDraftLine(),
          rawItemDescription: "Oil"
        }
      ]
    })
  );
  assert.equal(missingDocument.ok, false);
  if (!missingDocument.ok) {
    assert.equal(missingDocument.error, "missing_document_reference");
  }

  const incomplete = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "INV-2",
      lines: [
        {
          ...createEmptyPurchaseLineEntryDraftLine(),
          quantityText: "1"
        }
      ]
    })
  );
  assert.equal(incomplete.ok, false);
  if (incomplete.ok) return;
  assert.equal(incomplete.error, "incomplete_line");

  const priced = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "INV-3",
      currency: "",
      lines: [
        {
          ...createEmptyPurchaseLineEntryDraftLine(),
          rawItemDescription: "Flour 50lb",
          unitPriceText: "22"
        }
      ]
    })
  );
  assert.equal(priced.ok, false);
  if (priced.ok) return;
  assert.equal(priced.error, "priced_without_currency");
});

test("buildPurchaseLineInputsFromDraft keeps credit linkage fail-closed on purchases", () => {
  const purchase = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "INV-4",
      lineType: "purchase",
      lines: [
        {
          ...createEmptyPurchaseLineEntryDraftLine(),
          rawItemDescription: "Chicken",
          creditsLineId: "line-1"
        }
      ]
    })
  );
  assert.equal(purchase.ok, false);
  if (purchase.ok) return;
  assert.equal(purchase.error, "credits_line_on_purchase");

  const credit = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "CM-1",
      source: "credit_memo",
      lineType: "credit",
      lines: [
        {
          ...createEmptyPurchaseLineEntryDraftLine(),
          rawItemDescription: "Chicken",
          quantityText: "1",
          unitOfMeasure: "case",
          unitPriceText: "10",
          extendedPriceText: "10",
          creditsLineId: "line-1"
        }
      ]
    })
  );
  assert.equal(credit.ok, true);
  if (!credit.ok) return;
  assert.equal(credit.lines[0]!.lineType, "credit");
  assert.equal(credit.lines[0]!.creditsLineId, "line-1");
});

test("presentPurchaseLineIngestionSummary mirrors recorded and unverified counts", () => {
  assert.deepEqual(
    presentPurchaseLineIngestionSummary({
      correlationId: "c1",
      sourceDocumentReference: "INV-1",
      supplierId: null,
      submittedLineCount: 3,
      recordedLineCount: 2,
      duplicateLineCount: 1,
      confirmedCount: 1,
      estimatedCount: 0,
      couldNotVerifyCount: 1,
      consistencyDowngradeCount: 0,
      activityEventId: "a1"
    }),
    {
      recorded: 2,
      duplicates: 1,
      couldNotVerify: 1,
      estimated: 0,
      confirmed: 1
    }
  );
});

test("form draft path records purchase lines through the demo ledger", async () => {
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
  const { normalizePurchaseLineInput } = await import("../services/domain/purchaseLines");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);

  const built = buildPurchaseLineInputsFromDraft(
    draft({
      sourceDocumentReference: "INV-ENTRY-1",
      source: "invoice",
      lines: [
        {
          rawItemDescription: "Roma Tomatoes 25LB",
          quantityText: "3",
          unitOfMeasure: "case",
          packSize: "",
          unitPriceText: "28.5",
          extendedPriceText: "85.5",
          creditsLineId: ""
        }
      ]
    })
  );
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const result = await repository.ingestPurchaseLines({
    restaurantId: DEMO_RESTAURANT_ID,
    source: "invoice",
    sourceDocumentReference: built.sourceDocumentReference,
    supplierId: null,
    lines: built.lines.map(normalizePurchaseLineInput)
  });
  assert.equal(result.recordedLineCount, 1);
  assert.equal(result.couldNotVerifyCount, 0);
  assert.ok(result.activityEventId);

  const history = await repository.fetchPurchaseLines(DEMO_RESTAURANT_ID);
  const recorded = history.find((line) => line.sourceDocumentReference === "INV-ENTRY-1");
  assert.equal(recorded?.normalizedItemKey, "roma tomatoes");
  assert.equal(recorded?.quantity, 3);
  assert.equal(recorded?.unitPrice, 28.5);
});

test("purchase-line entry screen stays on application ingest and hub readiness", () => {
  const screen = readFileSync("app/more/purchase-line-entry.tsx", "utf8");
  assert.match(screen, /ingestPurchaseLines/);
  assert.match(screen, /from \"\.\.\/\.\.\/services\/miseService\"/);
  assert.match(screen, /canManageRestaurantData/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /buildPurchaseLineInputsFromDraft/);
  assert.doesNotMatch(screen, /\.from\(\s*[\"']purchase_lines[\"']/);
  assert.doesNotMatch(screen, /ingest_purchase_lines/);
  assert.doesNotMatch(screen, /service_role|SERVICE_ROLE|supabaseKey/i);

  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  assert.match(more, /\/more\/purchase-line-entry/);
  assert.match(more, /more\.row\.purchaseLineEntry\.title/);
});
