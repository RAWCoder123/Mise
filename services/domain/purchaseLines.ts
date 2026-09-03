/**
 * MISE-004C purchase line ledger.
 *
 * This module is the deterministic, pure half of the append-only purchase
 * history. It normalizes item descriptions and validates line evidence. It
 * predicts nothing, matches nothing across suppliers, and clusters nothing.
 * The identical normalization is implemented in SQL so the server stays
 * authoritative; `tests/purchaseLineLedgerMigration.test.ts` proves the two
 * vocabularies and rules stay in step.
 */

export const PURCHASE_LINE_EVIDENCE_VERSION = "mise.purchase_line.v1" as const;
export const PURCHASE_LINE_NORMALIZATION_VERSION =
  "mise.purchase_line_normalization.v1" as const;

export type PurchaseLineSource =
  | "invoice"
  | "order_confirmation"
  | "manual_entry"
  | "credit_memo";

/**
 * Direction of a line. A credit is never a negative quantity: magnitudes stay
 * non-negative so a flipped sign remains a parse error, and so the arithmetic
 * consistency rule needs no sign convention to reason about.
 */
export type PurchaseLineType = "purchase" | "credit";
export type PurchaseLineConfidence = "confirmed" | "estimated" | "could_not_verify";

/**
 * Internal-consistency properties a line can violate while still being stored
 * exactly as the document stated it. Violating one caps the line's confidence;
 * it never rejects, rewrites, or silently corrects the line.
 */
export type PurchaseLineConsistencyFlag =
  | "extended_price_mismatch"
  | "pack_unit_dimension_conflict"
  | "received_before_transaction"
  | "pack_size_conflicts_description";

/**
 * Only mass and volume can genuinely contradict each other. Counting words
 * ("each", "ct", "dozen") and container words ("case", "box") count packages
 * and assert nothing about what is inside them, so they are absent here and
 * can never produce a conflict.
 */
const MEASURE_DIMENSIONS: Record<string, "mass" | "volume"> = {
  g: "mass", gram: "mass", grams: "mass", kg: "mass", kgs: "mass",
  mg: "mass", mgs: "mass", lb: "mass", lbs: "mass", oz: "mass", ozs: "mass",
  ml: "volume", l: "volume", lt: "volume", ltr: "volume",
  liter: "volume", liters: "volume", litre: "volume", litres: "volume",
  gal: "volume", gals: "volume", gallon: "volume", gallons: "volume",
  qt: "volume", qts: "volume", quart: "volume", quarts: "volume",
  pt: "volume", pts: "volume", pint: "volume", pints: "volume"
};

export function purchaseLineUnitDimension(unit: string | null) {
  if (unit === null) return null;
  return MEASURE_DIMENSIONS[unit.trim().toLowerCase()] ?? null;
}

function packUnit(packSize: string | null) {
  if (packSize === null) return null;
  return /([a-z]+)$/u.exec(packSize.toLowerCase())?.[1] ?? null;
}

/**
 * Tolerance is derived from rounding, not chosen: a unit price printed to the
 * cent is only known to within half a cent, so the extended price may drift by
 * quantity * 0.005, plus a cent for its own rounding.
 */
export function purchaseLineExtendedPriceTolerance(quantity: number) {
  return 0.01 + quantity * 0.005;
}

export function computePurchaseLineConsistencyFlags(input: {
  quantity: number | null;
  unitOfMeasure: string | null;
  packSize: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  transactionDate: string;
  receivedDate: string | null;
  statedPackSize: string | null;
  describedPackSize: string | null;
}): PurchaseLineConsistencyFlag[] {
  const flags: PurchaseLineConsistencyFlag[] = [];
  if (input.quantity !== null && input.unitPrice !== null && input.extendedPrice !== null) {
    const drift = Math.abs(input.quantity * input.unitPrice - input.extendedPrice);
    if (drift > purchaseLineExtendedPriceTolerance(input.quantity)) {
      flags.push("extended_price_mismatch");
    }
  }
  const measureDimension = purchaseLineUnitDimension(input.unitOfMeasure);
  const packDimension = purchaseLineUnitDimension(packUnit(input.packSize));
  if (measureDimension !== null && packDimension !== null && measureDimension !== packDimension) {
    flags.push("pack_unit_dimension_conflict");
  }
  if (input.receivedDate !== null && input.receivedDate < input.transactionDate) {
    flags.push("received_before_transaction");
  }
  if (input.statedPackSize !== null && input.describedPackSize !== null) {
    const statedCanonical = normalizePurchaseLineDescription(input.statedPackSize).packSize;
    if (statedCanonical !== null && statedCanonical !== input.describedPackSize) {
      flags.push("pack_size_conflicts_description");
    }
  }
  return flags;
}

const CONFIDENCE_RANK: Record<PurchaseLineConfidence, number> = {
  confirmed: 2,
  estimated: 1,
  could_not_verify: 0
};

/**
 * An arithmetic or unit contradiction means we cannot say what was bought or
 * for how much. A date or pack-wording disagreement leaves the money readable,
 * so the line drops to an estimate rather than all the way down.
 */
export function purchaseLineConsistencyCeiling(
  flags: PurchaseLineConsistencyFlag[]
): PurchaseLineConfidence {
  if (
    flags.includes("extended_price_mismatch") ||
    flags.includes("pack_unit_dimension_conflict")
  ) {
    return "could_not_verify";
  }
  return flags.length > 0 ? "estimated" : "confirmed";
}

/**
 * Fixed measure vocabulary for pack/size extraction. Longest-first ordering is
 * required: JavaScript alternation is first-match-wins, so `lbs` must be tried
 * before `lb`. Postgres uses longest-overall-match, which agrees with this
 * ordering. Nothing outside this list is treated as a unit.
 */
export const PURCHASE_LINE_PACK_UNITS = [
  "bottles", "gallons", "gallon", "liters", "litres", "quarts", "boxes", "cases",
  "count", "dozen", "grams", "liter", "litre", "packs", "pints", "quart", "trays",
  "bags", "cans", "case", "each", "gals", "gram", "jars", "pack", "pint", "tray",
  "bag", "box", "btl", "can", "cnt", "doz", "gal", "jar", "kgs", "lbs", "ltr", "mgs",
  "ozs", "pts", "qts", "cs", "ct", "dz", "ea", "kg", "lb", "lt", "mg", "ml", "oz",
  "pk", "pt", "qt", "g", "l"
] as const;

const UNIT_ALTERNATION = PURCHASE_LINE_PACK_UNITS.join("|");
const NUMBER = "[0-9]+(?:\\.[0-9]+)?";
/** Postgres word characters are alphanumerics plus `_`; mirror that exactly. */
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}_])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}_])";

/** `6/1gal` and `12 x 32 oz` (count/size unit), then bare `5 lb` (size unit). */
export const PURCHASE_LINE_PACK_PATTERN =
  `${NOT_WORD_BEFORE}(${NUMBER})[ ]*[/x][ ]*(${NUMBER})[ ]*(${UNIT_ALTERNATION})${NOT_WORD_AFTER}` +
  `|${NOT_WORD_BEFORE}(${NUMBER})[ ]*(${UNIT_ALTERNATION})${NOT_WORD_AFTER}`;

function packMatcher() {
  return new RegExp(PURCHASE_LINE_PACK_PATTERN, "gu");
}

/** `1.50` -> `1.5`, `1.00` -> `1`. Rendering must not vary by input spelling. */
function trimNumericText(value: string) {
  return value.replace(/(\.[0-9]*[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

/** Step 1: lowercase, collapse whitespace runs, trim. Punctuation survives. */
export function foldPurchaseLineDescription(raw: string) {
  return raw.toLowerCase().replace(/\s+/gu, " ").trim();
}

export interface PurchaseLineNormalization {
  normalizationVersion: typeof PURCHASE_LINE_NORMALIZATION_VERSION;
  /** Deterministic grouping key, or null when nothing alphanumeric survives. */
  normalizedItemKey: string | null;
  /** First pack/size token found, canonically rendered, or null. */
  packSize: string | null;
}

/**
 * Deterministic normalization. Lowercase, trim, collapse whitespace, lift
 * pack/size into its own field, then strip punctuation from what remains.
 * No stemming, no synonyms, no fuzzy matching: two spellings that a human
 * would call the same item stay distinct, and that ambiguity is preserved.
 */
export function normalizePurchaseLineDescription(raw: string): PurchaseLineNormalization {
  const folded = foldPurchaseLineDescription(raw);
  const firstMatch = packMatcher().exec(folded);
  const packSize = firstMatch ? renderPackSize(firstMatch) : null;
  const withoutPack = folded.replace(packMatcher(), " ");
  const normalizedItemKey = withoutPack
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return {
    normalizationVersion: PURCHASE_LINE_NORMALIZATION_VERSION,
    normalizedItemKey: normalizedItemKey === "" ? null : normalizedItemKey,
    packSize
  };
}

function renderPackSize(match: RegExpExecArray) {
  const [, count, size, unit, singleSize, singleUnit] = match;
  if (count !== undefined && size !== undefined && unit !== undefined) {
    return `${trimNumericText(count)}x${trimNumericText(size)}${unit}`;
  }
  return `${trimNumericText(singleSize!)}${singleUnit!}`;
}

export interface PurchaseLineInput {
  lineIndex: number;
  /** Stated by every writer; never defaulted. */
  lineType: PurchaseLineType;
  rawItemDescription: string;
  /** Only when the source document names the original line. Never inferred. */
  creditsLineId?: string | null;
  quantity?: number | null;
  unitOfMeasure?: string | null;
  packSize?: string | null;
  unitPrice?: number | null;
  extendedPrice?: number | null;
  currency?: string | null;
  transactionDate: string;
  receivedDate?: string | null;
  parseConfidence: PurchaseLineConfidence;
}

export interface PurchaseLine {
  id: string;
  restaurantId: string;
  supplierId: string | null;
  lineIndex: number;
  revision: number;
  lineType: PurchaseLineType;
  rawItemDescription: string;
  normalizedItemKey: string | null;
  normalizationVersion: typeof PURCHASE_LINE_NORMALIZATION_VERSION;
  quantity: number | null;
  unitOfMeasure: string | null;
  packSize: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  currency: string | null;
  transactionDate: string;
  receivedDate: string | null;
  source: PurchaseLineSource;
  sourceDocumentReference: string;
  correlationId: string;
  parseConfidence: PurchaseLineConfidence;
  consistencyFlags: PurchaseLineConsistencyFlag[];
  /** Signed projections, so netting is a plain aggregate rather than app logic. */
  signedQuantity: number | null;
  signedExtendedPrice: number | null;
  creditsLineId: string | null;
  supersedesLineId: string | null;
  evidenceVersion: typeof PURCHASE_LINE_EVIDENCE_VERSION;
  recordedBy: string | null;
  recordedAt: string;
}

export interface PurchaseLineIngestionResult {
  correlationId: string;
  sourceDocumentReference: string;
  supplierId: string | null;
  submittedLineCount: number;
  recordedLineCount: number;
  duplicateLineCount: number;
  confirmedCount: number;
  estimatedCount: number;
  couldNotVerifyCount: number;
  consistencyDowngradeCount: number;
  activityEventId: string | null;
}

const MAX_QUANTITY = 1_000_000_000;
const MAX_EXTENDED_PRICE = 1_000_000_000_000;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function boundedText(value: string, label: string, maximum: number) {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > maximum || CONTROL_CHARACTERS.test(trimmed)) {
    throw new Error(`${label} must be bounded printable text.`);
  }
  return trimmed;
}

function optionalBoundedText(value: string | null | undefined, label: string, maximum: number) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : boundedText(trimmed, label, maximum);
}

function optionalAmount(
  value: number | null | undefined,
  label: string,
  maximum: number
) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a bounded non-negative amount.`);
  }
  return value;
}

/** ISO date (YYYY-MM-DD) only; a source document date is never invented. */
function isoDate(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    throw new Error(`${label} must be an ISO calendar date.`);
  }
  return trimmed;
}

/**
 * A parsed field that is absent stays absent. Confidence is only ever lowered,
 * never raised: a line missing quantity, unit, unit price, or extended price
 * cannot claim to be verified, and nothing is defaulted to zero to hide it.
 */
export function resolvePurchaseLineConfidence(input: {
  requested: PurchaseLineConfidence;
  quantity: number | null;
  unitOfMeasure: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  normalizedItemKey: string | null;
  consistencyFlags?: PurchaseLineConsistencyFlag[];
}): PurchaseLineConfidence {
  const complete =
    input.quantity !== null &&
    input.unitOfMeasure !== null &&
    input.unitPrice !== null &&
    input.extendedPrice !== null &&
    input.normalizedItemKey !== null;
  // Three separate ceilings — what was claimed, what the document carried, and
  // what the line's own numbers support. The lowest of them wins.
  const ceilings: PurchaseLineConfidence[] = [
    input.requested,
    complete ? "confirmed" : "could_not_verify",
    purchaseLineConsistencyCeiling(input.consistencyFlags ?? [])
  ];
  return ceilings.reduce((lowest, candidate) =>
    CONFIDENCE_RANK[candidate] < CONFIDENCE_RANK[lowest] ? candidate : lowest
  );
}

export interface NormalizedPurchaseLineInput extends PurchaseLineInput {
  rawItemDescription: string;
  normalizedItemKey: string | null;
  normalizationVersion: typeof PURCHASE_LINE_NORMALIZATION_VERSION;
  quantity: number | null;
  unitOfMeasure: string | null;
  packSize: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  currency: string | null;
  receivedDate: string | null;
  parseConfidence: PurchaseLineConfidence;
  consistencyFlags: PurchaseLineConsistencyFlag[];
  lineType: PurchaseLineType;
  creditsLineId: string | null;
  /** What the caller claimed, before the server's ceilings were applied. */
  statedConfidence: PurchaseLineConfidence;
}

/** Client-side mirror of the server's checks so bad input fails before the RPC. */
export function normalizePurchaseLineInput(input: PurchaseLineInput): NormalizedPurchaseLineInput {
  if (!Number.isInteger(input.lineIndex) || input.lineIndex < 0 || input.lineIndex > 9999) {
    throw new Error("Purchase line index must be a bounded document position.");
  }
  if (input.lineType !== "purchase" && input.lineType !== "credit") {
    throw new Error("Every purchase line must state whether it is a purchase or a credit.");
  }
  const creditsLineId = input.creditsLineId?.trim() || null;
  if (creditsLineId !== null && input.lineType !== "credit") {
    throw new Error("Only a credit line may reference the line it offsets.");
  }
  const rawItemDescription = boundedText(input.rawItemDescription, "Raw item description", 500);
  const {
    normalizedItemKey,
    normalizationVersion,
    packSize: extractedPackSize
  } = normalizePurchaseLineDescription(rawItemDescription);
  const quantity = optionalAmount(input.quantity, "Quantity", MAX_QUANTITY);
  const unitOfMeasure = optionalBoundedText(input.unitOfMeasure, "Unit of measure", 80);
  const unitPrice = optionalAmount(input.unitPrice, "Unit price", MAX_QUANTITY);
  const extendedPrice = optionalAmount(input.extendedPrice, "Extended price", MAX_EXTENDED_PRICE);
  const currency = optionalBoundedText(input.currency, "Currency", 3);
  if (currency !== null && !CURRENCY_PATTERN.test(currency)) {
    throw new Error("Currency must be a three-letter ISO 4217 code.");
  }
  if (currency === null && (unitPrice !== null || extendedPrice !== null)) {
    throw new Error("Priced purchase lines must carry a currency.");
  }
  const statedPackSize = optionalBoundedText(input.packSize, "Pack size", 80);
  const packSize = statedPackSize ?? extractedPackSize;
  const consistencyFlags = computePurchaseLineConsistencyFlags({
    quantity,
    unitOfMeasure,
    packSize,
    unitPrice,
    extendedPrice,
    transactionDate: isoDate(input.transactionDate, "Transaction date"),
    receivedDate: input.receivedDate ? isoDate(input.receivedDate, "Received date") : null,
    statedPackSize,
    describedPackSize: extractedPackSize
  });
  return {
    lineIndex: input.lineIndex,
    lineType: input.lineType,
    creditsLineId,
    rawItemDescription,
    normalizedItemKey,
    normalizationVersion,
    quantity,
    unitOfMeasure,
    packSize,
    unitPrice,
    extendedPrice,
    currency,
    transactionDate: isoDate(input.transactionDate, "Transaction date"),
    receivedDate: input.receivedDate ? isoDate(input.receivedDate, "Received date") : null,
    consistencyFlags,
    statedConfidence: input.parseConfidence,
    parseConfidence: resolvePurchaseLineConfidence({
      requested: input.parseConfidence,
      quantity,
      unitOfMeasure,
      unitPrice,
      extendedPrice,
      normalizedItemKey,
      consistencyFlags
    })
  };
}

/**
 * A line is current when nothing supersedes it. Supersession is derived from
 * committed rows rather than stored, because marking the old row would mean
 * mutating history.
 */
export function markCurrentPurchaseLines(lines: PurchaseLine[]) {
  const superseded = new Set(
    lines.map((line) => line.supersedesLineId).filter((id): id is string => id !== null)
  );
  return lines.map((line) => ({ ...line, current: !superseded.has(line.id) }));
}

export function normalizePurchaseLineRow(row: Record<string, unknown>): PurchaseLine {
  const nullableNumber = (name: string) => (row[name] === null ? null : Number(row[name]));
  const nullableText = (name: string) => (row[name] === null ? null : String(row[name]));
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    supplierId: nullableText("supplier_id"),
    lineIndex: Number(row.line_index),
    revision: Number(row.revision),
    lineType: row.line_type as PurchaseLineType,
    rawItemDescription: String(row.raw_item_description),
    normalizedItemKey: nullableText("normalized_item_key"),
    normalizationVersion: PURCHASE_LINE_NORMALIZATION_VERSION,
    quantity: nullableNumber("quantity"),
    unitOfMeasure: nullableText("unit_of_measure"),
    packSize: nullableText("pack_size"),
    unitPrice: nullableNumber("unit_price"),
    extendedPrice: nullableNumber("extended_price"),
    currency: nullableText("currency"),
    transactionDate: String(row.transaction_date),
    receivedDate: nullableText("received_date"),
    source: row.source as PurchaseLineSource,
    sourceDocumentReference: String(row.source_document_reference),
    correlationId: String(row.correlation_id),
    parseConfidence: row.parse_confidence as PurchaseLineConfidence,
    consistencyFlags: Array.isArray(row.consistency_flags)
      ? (row.consistency_flags as PurchaseLineConsistencyFlag[])
      : [],
    signedQuantity: nullableNumber("signed_quantity"),
    signedExtendedPrice: nullableNumber("signed_extended_price"),
    creditsLineId: nullableText("credits_line_id"),
    supersedesLineId: nullableText("supersedes_line_id"),
    evidenceVersion: PURCHASE_LINE_EVIDENCE_VERSION,
    recordedBy: nullableText("recorded_by"),
    recordedAt: String(row.recorded_at)
  };
}

export function normalizePurchaseLineIngestionResult(
  row: Record<string, unknown>
): PurchaseLineIngestionResult {
  const count = (name: string) => Number(row[name] ?? 0);
  return {
    correlationId: String(row.correlationId),
    sourceDocumentReference: String(row.sourceDocumentReference),
    supplierId: row.supplierId ? String(row.supplierId) : null,
    submittedLineCount: count("submittedLineCount"),
    recordedLineCount: count("recordedLineCount"),
    duplicateLineCount: count("duplicateLineCount"),
    confirmedCount: count("confirmedCount"),
    estimatedCount: count("estimatedCount"),
    couldNotVerifyCount: count("couldNotVerifyCount"),
    consistencyDowngradeCount: count("consistencyDowngradeCount"),
    activityEventId: row.activityEventId ? String(row.activityEventId) : null
  };
}

/** The exact JSON shape `public.ingest_purchase_lines` parses. */
export function toPurchaseLinePayload(line: NormalizedPurchaseLineInput) {
  return {
    lineIndex: line.lineIndex,
    lineType: line.lineType,
    creditsLineId: line.creditsLineId,
    rawItemDescription: line.rawItemDescription,
    quantity: line.quantity,
    unitOfMeasure: line.unitOfMeasure,
    packSize: line.packSize,
    unitPrice: line.unitPrice,
    extendedPrice: line.extendedPrice,
    currency: line.currency,
    transactionDate: line.transactionDate,
    receivedDate: line.receivedDate,
    parseConfidence: line.parseConfidence
  };
}

export interface PurchaseLineNetByItem {
  supplierId: string | null;
  normalizedItemKey: string | null;
  unitOfMeasure: string | null;
  currency: string | null;
  purchaseLineCount: number;
  creditLineCount: number;
  netQuantity: number | null;
  netExtendedPrice: number | null;
  /**
   * A credit whose item key matches no purchase in the same supplier, unit and
   * currency. Netting depends on wording agreement across documents, which
   * MISE-004C cannot guarantee and may not resolve by fuzzy matching, so such a
   * credit is surfaced rather than folded into a silently wrong net.
   */
  unmatchedCredit: boolean;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
}

export function normalizePurchaseLineNetRow(
  row: Record<string, unknown>
): PurchaseLineNetByItem {
  const nullableNumber = (name: string) => (row[name] === null ? null : Number(row[name]));
  const nullableText = (name: string) => (row[name] === null ? null : String(row[name]));
  return {
    supplierId: nullableText("supplier_id"),
    normalizedItemKey: nullableText("normalized_item_key"),
    unitOfMeasure: nullableText("unit_of_measure"),
    currency: nullableText("currency"),
    purchaseLineCount: Number(row.purchase_line_count ?? 0),
    creditLineCount: Number(row.credit_line_count ?? 0),
    netQuantity: nullableNumber("net_quantity"),
    netExtendedPrice: nullableNumber("net_extended_price"),
    unmatchedCredit: row.unmatched_credit === true,
    firstTransactionDate: nullableText("first_transaction_date"),
    lastTransactionDate: nullableText("last_transaction_date")
  };
}
