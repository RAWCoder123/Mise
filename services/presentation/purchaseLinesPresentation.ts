import type {
  PurchaseLine,
  PurchaseLineConfidence,
  PurchaseLineNetByItem,
  PurchaseLineType
} from "../domain/purchaseLines";

export type PurchaseLineWithCurrency = PurchaseLine & { current: boolean };

export type PresentedPurchaseLineNet = {
  key: string;
  itemLabel: string | null;
  supplierId: string | null;
  unitOfMeasure: string | null;
  currency: string | null;
  purchaseLineCount: number;
  creditLineCount: number;
  netQuantity: number | null;
  netExtendedPrice: number | null;
  unmatchedCredit: boolean;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
};

export type PresentedPurchaseLineHistoryRow = {
  id: string;
  itemLabel: string | null;
  lineType: PurchaseLineType;
  quantity: number | null;
  unitOfMeasure: string | null;
  extendedPrice: number | null;
  currency: string | null;
  transactionDate: string;
  sourceDocumentReference: string;
  parseConfidence: PurchaseLineConfidence;
  current: boolean;
  supplierId: string | null;
};

/**
 * Soft-null blank free-form purchase-line labels. Does not Unicode-trim or invent
 * clean wording from padding — empty / whitespace-only labels fall through to
 * localized none copy in the screen.
 */
export function presentPurchaseLineItemLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  if (!value.trim()) return null;
  return value;
}

function netSortKey(net: PurchaseLineNetByItem) {
  return net.lastTransactionDate ?? net.firstTransactionDate ?? "";
}

/**
 * Present purchase-line nets for operator review. Unmatched credits sort first so
 * wording mismatches that MISE-004C cannot fuzzy-match stay visible rather than
 * buried under ordinary nets. Remaining rows are newest-first by transaction date.
 */
export function presentPurchaseLineNets(
  nets: readonly PurchaseLineNetByItem[]
): PresentedPurchaseLineNet[] {
  return [...nets]
    .sort((left, right) => {
      if (left.unmatchedCredit !== right.unmatchedCredit) {
        return left.unmatchedCredit ? -1 : 1;
      }
      const byDate = netSortKey(right).localeCompare(netSortKey(left));
      if (byDate !== 0) return byDate;
      const leftKey = left.normalizedItemKey ?? "";
      const rightKey = right.normalizedItemKey ?? "";
      return leftKey.localeCompare(rightKey);
    })
    .map((net) => ({
      key: [
        net.supplierId ?? "none",
        net.normalizedItemKey ?? "none",
        net.unitOfMeasure ?? "none",
        net.currency ?? "none"
      ].join("|"),
      itemLabel: presentPurchaseLineItemLabel(net.normalizedItemKey),
      supplierId: net.supplierId,
      unitOfMeasure: net.unitOfMeasure,
      currency: net.currency,
      purchaseLineCount: net.purchaseLineCount,
      creditLineCount: net.creditLineCount,
      netQuantity: net.netQuantity,
      netExtendedPrice: net.netExtendedPrice,
      unmatchedCredit: net.unmatchedCredit,
      firstTransactionDate: net.firstTransactionDate,
      lastTransactionDate: net.lastTransactionDate
    }));
}

/**
 * Newest-first history rows. Current (non-superseded) lines keep their ledger
 * wording; soft-null labels fall through to localized none copy.
 */
export function presentPurchaseLineHistory(
  lines: readonly PurchaseLineWithCurrency[]
): PresentedPurchaseLineHistoryRow[] {
  return [...lines]
    .sort((left, right) => {
      const byDate = right.transactionDate.localeCompare(left.transactionDate);
      if (byDate !== 0) return byDate;
      const byRecorded = right.recordedAt.localeCompare(left.recordedAt);
      if (byRecorded !== 0) return byRecorded;
      return right.lineIndex - left.lineIndex;
    })
    .map((line) => ({
      id: line.id,
      itemLabel: presentPurchaseLineItemLabel(line.rawItemDescription),
      lineType: line.lineType,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      extendedPrice: line.extendedPrice,
      currency: line.currency,
      transactionDate: line.transactionDate,
      sourceDocumentReference: line.sourceDocumentReference,
      parseConfidence: line.parseConfidence,
      current: line.current,
      supplierId: line.supplierId
    }));
}

export function countUnmatchedPurchaseLineCredits(
  nets: readonly PresentedPurchaseLineNet[]
): number {
  return nets.reduce((total, net) => total + (net.unmatchedCredit ? 1 : 0), 0);
}
