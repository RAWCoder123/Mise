import type {
  PurchaseLineInput,
  PurchaseLineSource
} from "../domain/purchaseLines";
import { markCurrentPurchaseLines, normalizePurchaseLineInput } from "../domain/purchaseLines";
import { validatePurchaseLineSourceDocumentReferenceEvidence } from "../domain/purchaseLineSourceDocumentReferenceEvidence";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

function requireRestaurantId(restaurantId: string) {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Missing restaurant workspace.");
  return normalized;
}

/**
 * Records what a restaurant bought. Ingestion is idempotent on the document
 * position, so re-submitting the same invoice records nothing new and reports
 * what it already had. Nothing here reorders, predicts, or infers depletion.
 */
export async function ingestPurchaseLines(input: {
  restaurantId: string;
  source: PurchaseLineSource;
  sourceDocumentReference: string;
  lines: PurchaseLineInput[];
  supplierId?: string | null;
  correlationId?: string | null;
}) {
  // Fail closed on blank/padded document refs so application ingest matches the
  // append-only ledger tip. Hosted ingest_purchase_lines still nullif-trims.
  const documentReferenceShape = validatePurchaseLineSourceDocumentReferenceEvidence({
    sourceDocumentReference: input.sourceDocumentReference
  });
  if (documentReferenceShape) {
    throw new Error("A source document reference is required.");
  }
  const sourceDocumentReference = input.sourceDocumentReference.trim();
  if (!sourceDocumentReference) {
    throw new Error("A source document reference is required.");
  }
  if (input.lines.length === 0) {
    throw new Error("At least one purchase line is required.");
  }
  const lines = input.lines.map(normalizePurchaseLineInput);
  const positions = new Set(lines.map((line) => line.lineIndex));
  if (positions.size !== lines.length) {
    throw new Error("Each purchase line must hold a distinct document position.");
  }
  return repository.ingestPurchaseLines({
    restaurantId: requireRestaurantId(input.restaurantId),
    source: input.source,
    sourceDocumentReference,
    lines,
    supplierId: input.supplierId ?? null,
    correlationId: input.correlationId ?? null
  });
}

/** Newest-first purchase history, each line flagged with whether it is current. */
export async function fetchPurchaseLineHistory(restaurantId: string, limit?: number) {
  const lines = await repository.fetchPurchaseLines(requireRestaurantId(restaurantId), limit);
  return markCurrentPurchaseLines(lines);
}

/** Appends a correcting line. The corrected line stays on file untouched. */
export async function correctPurchaseLine(
  restaurantId: string,
  lineId: string,
  correction: PurchaseLineInput
) {
  const normalizedLineId = lineId.trim();
  if (!normalizedLineId) throw new Error("Missing purchase line.");
  return repository.supersedePurchaseLine(
    requireRestaurantId(restaurantId),
    normalizedLineId,
    normalizePurchaseLineInput(correction)
  );
}

/**
 * Net quantity and spend per item from recorded lines. Nets never cross
 * supplier, unit of measure or currency, and a credit whose item wording
 * matches no purchase is returned flagged rather than netted into silence.
 */
export async function fetchPurchaseLineNetByItem(restaurantId: string) {
  return repository.fetchPurchaseLineNetByItem(requireRestaurantId(restaurantId));
}
