import type {
  PurchaseLine,
  PurchaseLineConfidence,
  PurchaseLineInput,
  PurchaseLineType
} from "../domain/purchaseLines";

export type PurchaseLineCorrectionDraft = {
  rawItemDescription: string;
  quantityText: string;
  unitOfMeasure: string;
  packSize: string;
  unitPriceText: string;
  extendedPriceText: string;
  currency: string;
  transactionDate: string;
  receivedDate: string;
  parseConfidence: PurchaseLineConfidence;
  creditsLineId: string;
};

export type PurchaseLineCorrectionBuildResult =
  | { ok: true; lineId: string; correction: PurchaseLineInput }
  | { ok: false; error: PurchaseLineCorrectionBuildError };

export type PurchaseLineCorrectionBuildError =
  | "missing_line"
  | "missing_description"
  | "missing_transaction_date"
  | "invalid_transaction_date"
  | "invalid_received_date"
  | "received_before_transaction"
  | "invalid_currency"
  | "invalid_quantity"
  | "invalid_unit_price"
  | "invalid_extended_price"
  | "priced_without_currency"
  | "credits_line_on_purchase"
  | "unchanged";

export type CurrentPurchaseLine = PurchaseLine & { current: boolean };

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

function amountText(value: number | null) {
  return value === null ? "" : String(value);
}

/**
 * Only current (not-yet-superseded) lines may be corrected. Credits and
 * purchases both qualify; the server still refuses a second correction.
 */
export function listCorrectablePurchaseLines(lines: CurrentPurchaseLine[]) {
  return lines
    .filter((line) => line.current)
    .slice()
    .sort(
      (left, right) =>
        right.transactionDate.localeCompare(left.transactionDate) ||
        left.sourceDocumentReference.localeCompare(right.sourceDocumentReference) ||
        left.lineIndex - right.lineIndex
    );
}

/** Prefills the correction form from the exact stored line. */
export function createPurchaseLineCorrectionDraft(
  line: PurchaseLine
): PurchaseLineCorrectionDraft {
  return {
    rawItemDescription: line.rawItemDescription,
    quantityText: amountText(line.quantity),
    unitOfMeasure: line.unitOfMeasure ?? "",
    packSize: line.packSize ?? "",
    unitPriceText: amountText(line.unitPrice),
    extendedPriceText: amountText(line.extendedPrice),
    currency: line.currency ?? "",
    transactionDate: line.transactionDate,
    receivedDate: line.receivedDate ?? "",
    parseConfidence:
      line.parseConfidence === "could_not_verify" ? "estimated" : line.parseConfidence,
    creditsLineId: line.creditsLineId ?? ""
  };
}

function sameOptionalAmount(text: string, original: number | null) {
  const next = optionalNumber(text);
  if (next === undefined) return false;
  return next === original;
}

function sameOptionalText(text: string, original: string | null) {
  return optionalText(text) === original;
}

/**
 * Builds the superseding input. Document identity, supplier, line index, and
 * line type stay locked to the original; only operator-editable fields change.
 * An identical draft fails closed so we do not append a no-op revision.
 */
export function buildPurchaseLineCorrectionFromDraft(input: {
  line: PurchaseLine | null;
  draft: PurchaseLineCorrectionDraft;
}): PurchaseLineCorrectionBuildResult {
  const { line, draft } = input;
  if (!line) {
    return { ok: false, error: "missing_line" };
  }

  const rawItemDescription = draft.rawItemDescription.trim();
  if (!rawItemDescription) {
    return { ok: false, error: "missing_description" };
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

  const quantity = optionalNumber(draft.quantityText);
  if (quantity === undefined) return { ok: false, error: "invalid_quantity" };
  const unitPrice = optionalNumber(draft.unitPriceText);
  if (unitPrice === undefined) return { ok: false, error: "invalid_unit_price" };
  const extendedPrice = optionalNumber(draft.extendedPriceText);
  if (extendedPrice === undefined) return { ok: false, error: "invalid_extended_price" };
  if (currency === null && (unitPrice !== null || extendedPrice !== null)) {
    return { ok: false, error: "priced_without_currency" };
  }

  const creditsLineId = optionalText(draft.creditsLineId);
  if (creditsLineId !== null && line.lineType !== "credit") {
    return { ok: false, error: "credits_line_on_purchase" };
  }

  const unchanged =
    rawItemDescription === line.rawItemDescription &&
    sameOptionalAmount(draft.quantityText, line.quantity) &&
    sameOptionalText(draft.unitOfMeasure, line.unitOfMeasure) &&
    sameOptionalText(draft.packSize, line.packSize) &&
    sameOptionalAmount(draft.unitPriceText, line.unitPrice) &&
    sameOptionalAmount(draft.extendedPriceText, line.extendedPrice) &&
    currency === line.currency &&
    transactionDate === line.transactionDate &&
    receivedDate === line.receivedDate &&
    draft.parseConfidence === line.parseConfidence &&
    creditsLineId === line.creditsLineId;

  if (unchanged) {
    return { ok: false, error: "unchanged" };
  }

  return {
    ok: true,
    lineId: line.id,
    correction: {
      lineIndex: line.lineIndex,
      lineType: line.lineType as PurchaseLineType,
      rawItemDescription,
      creditsLineId,
      quantity,
      unitOfMeasure: optionalText(draft.unitOfMeasure),
      packSize: optionalText(draft.packSize),
      unitPrice,
      extendedPrice,
      currency,
      transactionDate,
      receivedDate,
      parseConfidence: draft.parseConfidence
    }
  };
}
