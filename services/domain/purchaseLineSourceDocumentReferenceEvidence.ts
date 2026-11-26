/**
 * Structural audit evidence for purchase-line source document references.
 *
 * Hosted `public.ingest_purchase_lines` already nullif-trims
 * `p_source_document_reference` before append. On current main, every other
 * insert path (direct service_role inserts, `private.append_purchase_line`
 * callers that skip the ingest preflight, future writers) can still stamp
 * whitespace-only or padded document references onto the append-only ledger.
 *
 * `source_document_reference` is part of the durable idempotency key
 * `(restaurant, supplier_scope, source_document_reference, line_index,
 * revision)`. Blank padding invents a parallel document identity beside the
 * trimmed label, so re-ingest of the same invoice can record duplicate lines
 * instead of settling as already-on-file.
 *
 * Product ingest already trims soft-empty references in application code.
 * This tip fails closed when a source document reference is blank after trim,
 * or when it retains leading/trailing whitespace. Length-only bounds and
 * control-character pins stay with their own tips.
 */

/**
 * Domain rejection reason for blank or padded source document references.
 * Returns null when the reference is already trimmed and non-empty.
 */
export function validatePurchaseLineSourceDocumentReferenceEvidence(input: {
  sourceDocumentReference: string | null | undefined;
}): string | null {
  if (input.sourceDocumentReference == null) {
    return "invalid_source_document_reference_shape";
  }
  const trimmed = input.sourceDocumentReference.trim();
  if (trimmed === "" || input.sourceDocumentReference !== trimmed) {
    return "invalid_source_document_reference_shape";
  }
  return null;
}
