/**
 * Structural audit evidence for credit-memo purchase-line direction.
 *
 * `purchase_lines.source = 'credit_memo'` names a credit-memo document.
 * Hosted `ingest_purchase_lines` allowlists that source and
 * `append_purchase_line` independently requires a stated purchase/credit
 * direction. Neither couples the two.
 *
 * On current main, every insert path (including direct service_role inserts
 * that satisfy the existing source and line_type CHECKs) can therefore stamp
 * `source = 'credit_memo'` with `line_type = 'purchase'`. That forges a
 * purchase into a credit-memo document's idempotency space and makes signed
 * quantity/price positive while claiming durable document evidence came from
 * a credit memo.
 *
 * Invoice, order_confirmation, and manual_entry documents may still carry
 * credit lines. This tip only requires the one-way coupling:
 * credit_memo => credit.
 */

export type PurchaseLineCreditMemoLineTypeEvidence = {
  source: "invoice" | "order_confirmation" | "manual_entry" | "credit_memo" | string;
  lineType: "purchase" | "credit" | string;
};

/**
 * Domain rejection reason when a credit-memo document carries a non-credit
 * line. Returns null when the source is not a credit memo, or when the line
 * is a credit.
 */
export function validatePurchaseLineCreditMemoLineTypeEvidence(
  input: PurchaseLineCreditMemoLineTypeEvidence
): string | null {
  const source = typeof input.source === "string" ? input.source.trim() : "";
  if (source !== "credit_memo") {
    return null;
  }
  if (input.lineType !== "credit") {
    return "invalid_credit_memo_line_type";
  }
  return null;
}
