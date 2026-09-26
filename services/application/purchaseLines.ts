import type {
  PurchaseLineInput,
  PurchaseLineSource
} from "../domain/purchaseLines";
import {
  markCurrentPurchaseLines,
  normalizePurchaseLineInput,
  toPurchaseLinePayload
} from "../domain/purchaseLines";
import {
  PURCHASE_LINE_INGEST_MAX_BYTES,
  PURCHASE_LINE_INGEST_MAX_LINES,
  utf8ByteLength
} from "../domain/securityLimits";
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
  const sourceDocumentReference = input.sourceDocumentReference.trim();
  if (!sourceDocumentReference) {
    throw new Error("A source document reference is required.");
  }
  if (input.lines.length === 0) {
    throw new Error("At least one purchase line is required.");
  }
  if (input.lines.length > PURCHASE_LINE_INGEST_MAX_LINES) {
    throw new Error("Between 1 and 500 purchase lines are required.");
  }
  const lines = input.lines.map(normalizePurchaseLineInput);
  const positions = new Set(lines.map((line) => line.lineIndex));
  if (positions.size !== lines.length) {
    throw new Error("Each purchase line must hold a distinct document position.");
  }
  // Client preflight mirrors MISE-005G. Server still measures
  // octet_length(p_lines::text); JSON.stringify is a fail-closed approx.
  const payloadBytes = utf8ByteLength(JSON.stringify(lines.map(toPurchaseLinePayload)));
  if (payloadBytes > PURCHASE_LINE_INGEST_MAX_BYTES) {
    throw new Error("Purchase line payload exceeds the allowed size.");
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
