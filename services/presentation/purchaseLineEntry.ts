import type {
  PurchaseLineConfidence,
  PurchaseLineIngestionResult,
  PurchaseLineInput,
  PurchaseLineSource,
  PurchaseLineType
} from "../domain/purchaseLines";

export type PurchaseLineEntryDraftLine = {
  rawItemDescription: string;
  quantityText: string;
  unitOfMeasure: string;
  packSize: string;
  unitPriceText: string;
  extendedPriceText: string;
  creditsLineId: string;
};

export type PurchaseLineEntryDraft = {
  sourceDocumentReference: string;
  source: PurchaseLineSource;
  lineType: PurchaseLineType;
  supplierId: string | null;
  transactionDate: string;
  receivedDate: string;
  currency: string;
  parseConfidence: PurchaseLineConfidence;
  lines: PurchaseLineEntryDraftLine[];
};

export type PurchaseLineEntryBuildResult =
  | { ok: true; lines: PurchaseLineInput[]; sourceDocumentReference: string; supplierId: string | null }
  | { ok: false; error: PurchaseLineEntryBuildError };

export type PurchaseLineEntryBuildError =
  | "missing_document_reference"
  | "missing_transaction_date"
  | "invalid_transaction_date"
  | "invalid_received_date"
  | "received_before_transaction"
  | "invalid_currency"
  | "no_lines"
  | "incomplete_line"
  | "invalid_quantity"
  | "invalid_unit_price"
  | "invalid_extended_price"
  | "priced_without_currency"
  | "credits_line_on_purchase";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CURRENCY = /^[A-Z]{3}$/u;

function optionalNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function optionalText(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

function isBlankLine(line: PurchaseLineEntryDraftLine) {
  return (
    !line.rawItemDescription.trim() &&
    !line.quantityText.trim() &&
    !line.unitOfMeasure.trim() &&
    !line.packSize.trim() &&
    !line.unitPriceText.trim() &&
    !line.extendedPriceText.trim() &&
    !line.creditsLineId.trim()
  );
}

function isPartialLine(line: PurchaseLineEntryDraftLine) {
  if (line.rawItemDescription.trim()) return false;
  return !isBlankLine(line);
}

/**
 * Turns the operator form into ledger inputs. Blank trailing rows are ignored;
 * a row with money or quantity but no description fails closed as incomplete.
 * Credit linkage is only accepted when the document line is a credit.
 */
export function buildPurchaseLineInputsFromDraft(
  draft: PurchaseLineEntryDraft
): PurchaseLineEntryBuildResult {
  const sourceDocumentReference = draft.sourceDocumentReference.trim();
  if (!sourceDocumentReference) {
    return { ok: false, error: "missing_document_reference" };
  }

  const transactionDate = draft.transactionDate.trim();
  if (!transactionDate) {
    return { ok: false, error: "missing_transaction_date" };
  }
  if (!ISO_DATE.test(transactionDate)) {
    return { ok: false, error: "invalid_transaction_date" };
  }

  const receivedDateText = draft.receivedDate.trim();
  const receivedDate = receivedDateText === "" ? null : receivedDateText;
  if (receivedDate !== null && !ISO_DATE.test(receivedDate)) {
    return { ok: false, error: "invalid_received_date" };
  }
  if (receivedDate !== null && receivedDate < transactionDate) {
    return { ok: false, error: "received_before_transaction" };
  }

  const currencyText = draft.currency.trim().toUpperCase();
  const currency = currencyText === "" ? null : currencyText;
  if (currency !== null && !CURRENCY.test(currency)) {
    return { ok: false, error: "invalid_currency" };
  }

  const activeLines = draft.lines.filter((line) => !isBlankLine(line));
  if (activeLines.length === 0) {
    return { ok: false, error: "no_lines" };
  }
  if (activeLines.some(isPartialLine)) {
    return { ok: false, error: "incomplete_line" };
  }

  const lines: PurchaseLineInput[] = [];
  for (let index = 0; index < activeLines.length; index += 1) {
    const line = activeLines[index]!;
    const quantity = optionalNumber(line.quantityText);
    if (quantity === undefined) return { ok: false, error: "invalid_quantity" };
    const unitPrice = optionalNumber(line.unitPriceText);
    if (unitPrice === undefined) return { ok: false, error: "invalid_unit_price" };
    const extendedPrice = optionalNumber(line.extendedPriceText);
    if (extendedPrice === undefined) return { ok: false, error: "invalid_extended_price" };
    if (currency === null && (unitPrice !== null || extendedPrice !== null)) {
      return { ok: false, error: "priced_without_currency" };
    }

    const creditsLineId = optionalText(line.creditsLineId);
    if (creditsLineId !== null && draft.lineType !== "credit") {
      return { ok: false, error: "credits_line_on_purchase" };
    }

    lines.push({
      lineIndex: index,
      lineType: draft.lineType,
      rawItemDescription: line.rawItemDescription,
      creditsLineId,
      quantity,
      unitOfMeasure: optionalText(line.unitOfMeasure),
      packSize: optionalText(line.packSize),
      unitPrice,
      extendedPrice,
      currency,
      transactionDate,
      receivedDate,
      parseConfidence: draft.parseConfidence
    });
  }

  return {
    ok: true,
    lines,
    sourceDocumentReference,
    supplierId: draft.supplierId
  };
}

export function createEmptyPurchaseLineEntryDraftLine(): PurchaseLineEntryDraftLine {
  return {
    rawItemDescription: "",
    quantityText: "",
    unitOfMeasure: "",
    packSize: "",
    unitPriceText: "",
    extendedPriceText: "",
    creditsLineId: ""
  };
}

export function presentPurchaseLineIngestionSummary(result: PurchaseLineIngestionResult): {
  recorded: number;
  duplicates: number;
  couldNotVerify: number;
  estimated: number;
  confirmed: number;
} {
  return {
    recorded: result.recordedLineCount,
    duplicates: result.duplicateLineCount,
    couldNotVerify: result.couldNotVerifyCount,
    estimated: result.estimatedCount,
    confirmed: result.confirmedCount
  };
}
