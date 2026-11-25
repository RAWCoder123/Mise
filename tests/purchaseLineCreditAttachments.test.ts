import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPurchaseLineCreditAttachmentCandidates,
  effectiveCreditsLineId,
  suggestPurchaseLinesForCredit,
  type PurchaseLineCreditAttachment
} from "../services/domain/purchaseLineCreditAttachments";
import {
  normalizePurchaseLineDescription,
  type PurchaseLine
} from "../services/domain/purchaseLines";

function line(
  partial: Partial<PurchaseLine> &
    Pick<PurchaseLine, "id" | "rawItemDescription" | "lineType">
): PurchaseLine {
  const normalized = normalizePurchaseLineDescription(partial.rawItemDescription);
  const quantity = partial.quantity ?? 1;
  const extended = partial.extendedPrice ?? 10;
  const sign = partial.lineType === "credit" ? -1 : 1;
  return {
    restaurantId: "rest-1",
    supplierId: "supplier-1",
    lineIndex: 0,
    revision: 0,
    normalizedItemKey: normalized.normalizedItemKey,
    normalizationVersion: "mise.purchase_line_normalization.v1",
    quantity,
    unitOfMeasure: "case",
    packSize: normalized.packSize,
    unitPrice: 10,
    extendedPrice: extended,
    currency: "USD",
    transactionDate: "2026-09-01",
    receivedDate: null,
    source: "invoice",
    sourceDocumentReference: "INV-1",
    correlationId: "corr-1",
    parseConfidence: "confirmed",
    consistencyFlags: [],
    signedQuantity: sign * quantity,
    signedExtendedPrice: sign * extended,
    creditsLineId: null,
    supersedesLineId: null,
    evidenceVersion: "mise.purchase_line.v1",
    recordedBy: "user-1",
    recordedAt: "2026-09-01T12:00:00.000Z",
    ...partial
  };
}

function attachment(
  partial: Partial<PurchaseLineCreditAttachment> &
    Pick<PurchaseLineCreditAttachment, "id" | "creditLineId" | "purchaseLineId">
): PurchaseLineCreditAttachment {
  return {
    restaurantId: "rest-1",
    status: "verified",
    evidenceVersion: "mise.purchase_line_credit_attachment.v1",
    linkedBy: "user-1",
    linkedAt: "2026-09-10T12:00:00.000Z",
    revokedBy: null,
    revokedAt: null,
    ...partial
  };
}

test("suggestions stay same-supplier and rank exact normalized keys first", () => {
  const credit = line({
    id: "credit-1",
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    sourceDocumentReference: "CM-1"
  });
  const exact = line({
    id: "purchase-exact",
    lineType: "purchase",
    rawItemDescription: "CHICKEN THIGHS, BONELESS - 40 LB CASE",
    transactionDate: "2026-08-20",
    sourceDocumentReference: "INV-A"
  });
  const otherItem = line({
    id: "purchase-oil",
    lineType: "purchase",
    rawItemDescription: "Olive Oil Extra Virgin",
    transactionDate: "2026-09-05",
    sourceDocumentReference: "INV-B"
  });
  const otherSupplier = line({
    id: "purchase-other-supplier",
    lineType: "purchase",
    supplierId: "supplier-2",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    sourceDocumentReference: "INV-C"
  });
  const matches = suggestPurchaseLinesForCredit(credit, [exact, otherItem, otherSupplier]);
  assert.deepEqual(
    matches.map((entry) => entry.id),
    ["purchase-exact", "purchase-oil"]
  );
  assert.equal(matches[0]?.normalizedItemKey, credit.normalizedItemKey);
});

test("candidates prefer unlinked credits and honor document-stated links", () => {
  const purchase = line({
    id: "purchase-1",
    lineType: "purchase",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case"
  });
  const unlinked = line({
    id: "credit-unlinked",
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    sourceDocumentReference: "CM-1",
    transactionDate: "2026-09-08"
  });
  const documentLinked = line({
    id: "credit-document",
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    sourceDocumentReference: "CM-2",
    creditsLineId: purchase.id,
    transactionDate: "2026-09-09"
  });
  const managerLinked = line({
    id: "credit-manager",
    lineType: "credit",
    rawItemDescription: "Olive Oil Extra Virgin",
    sourceDocumentReference: "CM-3",
    transactionDate: "2026-09-07"
  });
  const verified = attachment({
    id: "attach-1",
    creditLineId: managerLinked.id,
    purchaseLineId: purchase.id
  });

  const candidates = buildPurchaseLineCreditAttachmentCandidates(
    [purchase, unlinked, documentLinked, managerLinked],
    [verified]
  );
  assert.equal(candidates[0]?.credit.id, "credit-unlinked");
  assert.equal(candidates[0]?.needsManagerAttachment, true);
  assert.equal(candidates[0]?.exactKeyPurchaseMatches[0]?.id, "purchase-1");

  const document = candidates.find((entry) => entry.credit.id === "credit-document");
  assert.equal(document?.needsManagerAttachment, false);
  assert.equal(document?.documentCreditsLineId, purchase.id);

  const managed = candidates.find((entry) => entry.credit.id === "credit-manager");
  assert.equal(managed?.needsManagerAttachment, false);
  assert.equal(managed?.attachmentId, "attach-1");
});

test("effective credits line prefers document-stated links over attachments", () => {
  const credit = line({
    id: "credit-1",
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case",
    creditsLineId: "purchase-document"
  });
  const verified = attachment({
    id: "attach-1",
    creditLineId: credit.id,
    purchaseLineId: "purchase-manager"
  });
  assert.equal(effectiveCreditsLineId(credit, [verified]), "purchase-document");
  assert.equal(
    effectiveCreditsLineId({ ...credit, creditsLineId: null }, [verified]),
    "purchase-manager"
  );
  assert.equal(
    effectiveCreditsLineId(
      { ...credit, creditsLineId: null },
      [{ ...verified, status: "revoked", revokedAt: "2026-09-11T00:00:00.000Z" }]
    ),
    null
  );
});

test("near spellings never fuzzy-match into suggestions", () => {
  const credit = line({
    id: "credit-1",
    lineType: "credit",
    rawItemDescription: "Chicken Thighs Boneless 40 LB Case"
  });
  const near = line({
    id: "purchase-near",
    lineType: "purchase",
    rawItemDescription: "Chicken Thigh Boneless Case"
  });
  const matches = suggestPurchaseLinesForCredit(credit, [near]);
  assert.equal(matches.length, 1, "same-supplier purchases remain choosable");
  assert.notEqual(matches[0]?.normalizedItemKey, credit.normalizedItemKey);
  assert.equal(
    buildPurchaseLineCreditAttachmentCandidates([credit, near], [])[0]?.exactKeyPurchaseMatches
      .length,
    0
  );
});
