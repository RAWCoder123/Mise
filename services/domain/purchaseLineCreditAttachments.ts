/**
 * Manager-verified post-hoc attachment of a credit purchase line to the
 * purchase line it offsets.
 *
 * Document-stated `credits_line_id` on the ledger remains immutable and is set
 * only at ingest when the source document names the original line. When that
 * field is null, a manager may verify an attachment without rewriting append-only
 * ledger history. Attachments never fuzzy-match, never cross suppliers, and
 * never invent a target.
 */

import {
  markCurrentPurchaseLines,
  type PurchaseLine
} from "./purchaseLines";

export const PURCHASE_LINE_CREDIT_ATTACHMENT_EVIDENCE_VERSION =
  "mise.purchase_line_credit_attachment.v1" as const;

export type PurchaseLineCreditAttachmentStatus = "verified" | "revoked";

export interface PurchaseLineCreditAttachment {
  id: string;
  restaurantId: string;
  creditLineId: string;
  purchaseLineId: string;
  status: PurchaseLineCreditAttachmentStatus;
  evidenceVersion: typeof PURCHASE_LINE_CREDIT_ATTACHMENT_EVIDENCE_VERSION;
  linkedBy: string | null;
  linkedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface PurchaseLineCreditAttachmentCandidate {
  credit: PurchaseLine & { current: boolean };
  /** Document-stated link, when the source invoice/credit memo already named it. */
  documentCreditsLineId: string | null;
  attachmentId: string | null;
  attachedPurchaseLineId: string | null;
  /** Same-supplier current purchases with exact normalized key equality. */
  exactKeyPurchaseMatches: Array<PurchaseLine & { current: boolean }>;
  needsManagerAttachment: boolean;
}

function supplierScopeKey(supplierId: string | null) {
  return supplierId ?? "";
}

export function collectSupersededPurchaseLineIds(lines: readonly PurchaseLine[]) {
  return new Set(
    lines
      .map((line) => line.supersedesLineId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}

export function isPurchaseLineCurrent(line: PurchaseLine, supersededIds: ReadonlySet<string>) {
  return !supersededIds.has(line.id);
}

/**
 * Effective offset target: document-stated ledger link wins; otherwise a
 * verified manager attachment. Revoked attachments do not count.
 */
export function effectiveCreditsLineId(
  line: PurchaseLine,
  attachments: readonly PurchaseLineCreditAttachment[]
): string | null {
  if (line.creditsLineId) return line.creditsLineId;
  const verified = attachments.find(
    (attachment) =>
      attachment.status === "verified" && attachment.creditLineId === line.id
  );
  return verified?.purchaseLineId ?? null;
}

/**
 * Same-supplier purchase lines a manager may attach a credit to. Exact
 * normalized-key matches are sorted first; remaining current purchases follow.
 * No fuzzy matching.
 */
export function suggestPurchaseLinesForCredit(
  credit: PurchaseLine,
  lines: readonly PurchaseLine[],
  options: { limit?: number } = {}
): Array<PurchaseLine & { current: boolean }> {
  if (credit.lineType !== "credit") return [];
  const limit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? Math.max(1, Math.floor(options.limit))
      : 20;
  const current = markCurrentPurchaseLines([...lines]);
  const sameSupplier = current.filter(
    (line) =>
      line.lineType === "purchase" &&
      line.current &&
      supplierScopeKey(line.supplierId) === supplierScopeKey(credit.supplierId) &&
      line.id !== credit.id
  );
  const exact = sameSupplier.filter(
    (line) =>
      credit.normalizedItemKey !== null &&
      line.normalizedItemKey === credit.normalizedItemKey
  );
  const remainder = sameSupplier.filter(
    (line) =>
      credit.normalizedItemKey === null ||
      line.normalizedItemKey !== credit.normalizedItemKey
  );
  const ranked = [...exact, ...remainder].sort((left, right) => {
    const leftExact =
      credit.normalizedItemKey !== null &&
      left.normalizedItemKey === credit.normalizedItemKey
        ? 0
        : 1;
    const rightExact =
      credit.normalizedItemKey !== null &&
      right.normalizedItemKey === credit.normalizedItemKey
        ? 0
        : 1;
    if (leftExact !== rightExact) return leftExact - rightExact;
    const byDate = right.transactionDate.localeCompare(left.transactionDate);
    if (byDate !== 0) return byDate;
    return left.id.localeCompare(right.id);
  });
  return ranked.slice(0, limit);
}

/**
 * Builds manager review rows for current credit lines. Document-linked credits
 * are listed as already resolved; unlinked credits needing attachment are
 * surfaced with exact-key purchase suggestions.
 */
export function buildPurchaseLineCreditAttachmentCandidates(
  lines: readonly PurchaseLine[],
  attachments: readonly PurchaseLineCreditAttachment[]
): PurchaseLineCreditAttachmentCandidate[] {
  const current = markCurrentPurchaseLines([...lines]);
  const verifiedByCredit = new Map<string, PurchaseLineCreditAttachment>();
  for (const attachment of attachments) {
    if (attachment.status !== "verified") continue;
    verifiedByCredit.set(attachment.creditLineId, attachment);
  }

  return current
    .filter((line) => line.current && line.lineType === "credit")
    .map((credit) => {
      const attachment = verifiedByCredit.get(credit.id) ?? null;
      const documentCreditsLineId = credit.creditsLineId;
      const needsManagerAttachment =
        documentCreditsLineId === null && attachment === null;
      const exactKeyPurchaseMatches = suggestPurchaseLinesForCredit(credit, lines, {
        limit: 8
      }).filter(
        (line) =>
          credit.normalizedItemKey !== null &&
          line.normalizedItemKey === credit.normalizedItemKey
      );
      return {
        credit,
        documentCreditsLineId,
        attachmentId: attachment?.id ?? null,
        attachedPurchaseLineId:
          documentCreditsLineId ?? attachment?.purchaseLineId ?? null,
        exactKeyPurchaseMatches,
        needsManagerAttachment
      };
    })
    .sort((left, right) => {
      const leftNeed = left.needsManagerAttachment ? 0 : 1;
      const rightNeed = right.needsManagerAttachment ? 0 : 1;
      if (leftNeed !== rightNeed) return leftNeed - rightNeed;
      const byDate = right.credit.transactionDate.localeCompare(
        left.credit.transactionDate
      );
      if (byDate !== 0) return byDate;
      return left.credit.id.localeCompare(right.credit.id);
    });
}

export function normalizePurchaseLineCreditAttachmentRow(
  row: Record<string, unknown>
): PurchaseLineCreditAttachment {
  const nullableText = (name: string) => (row[name] === null ? null : String(row[name]));
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    creditLineId: String(row.credit_line_id),
    purchaseLineId: String(row.purchase_line_id),
    status: row.status as PurchaseLineCreditAttachmentStatus,
    evidenceVersion: PURCHASE_LINE_CREDIT_ATTACHMENT_EVIDENCE_VERSION,
    linkedBy: nullableText("linked_by"),
    linkedAt: String(row.linked_at),
    revokedBy: nullableText("revoked_by"),
    revokedAt: nullableText("revoked_at")
  };
}
