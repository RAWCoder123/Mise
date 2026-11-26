/**
 * Structural audit evidence for document-stated purchase-line credit links.
 *
 * `purchase_lines.credits_line_id` is set only when a source document names the
 * original invoice line. Hosted `append_purchase_line` already requires the
 * caller to be a credit and that the named id exists inside the same tenant
 * and supplier_scope. It does not require the named row to be a purchase.
 *
 * On current main, every insert path (including direct service_role inserts
 * that satisfy the existing self/credit-type CHECKs and restaurant FK) can
 * therefore stamp `credits_line_id` onto another credit, or onto a purchase
 * that belongs to a different supplier inside the same restaurant. Netting
 * and unmatched-credit findings then treat that forged link as durable
 * document evidence.
 *
 * Post-hoc manager attachments (#1257) live on a separate table and already
 * require `line_type = 'purchase'` plus matching supplier_scope. This tip
 * brings the immutable document-stated column up to the same target rules
 * without rewriting ingest/append or the attachment workflow.
 *
 * Callers that already know the named target's line type and supplier scope
 * pass them here. Missing target evidence stays a database-boundary concern.
 */

export type PurchaseLineCreditLinkTargetEvidence = {
  creditsLineId: string | null | undefined;
  lineType: "purchase" | "credit" | string;
  /** Known target `line_type`, when the caller has already loaded the row. */
  targetLineType?: "purchase" | "credit" | string | null;
  /**
   * Known target `supplier_scope` (coalesce of supplier_id, else nil UUID),
   * when the caller has already loaded the row.
   */
  targetSupplierScope?: string | null;
  /** Credit row's own supplier_scope for same-supplier comparison. */
  creditSupplierScope?: string | null;
};

/**
 * Domain rejection reason when a stated credit link names an invalid target.
 * Returns null when the link is absent or the known target evidence matches.
 */
export function validatePurchaseLineCreditLinkTargetEvidence(
  input: PurchaseLineCreditLinkTargetEvidence
): string | null {
  const creditsLineId =
    typeof input.creditsLineId === "string" ? input.creditsLineId.trim() : "";
  if (!creditsLineId) {
    return null;
  }
  if (input.lineType !== "credit") {
    return "invalid_credit_link_target";
  }
  if (input.targetLineType !== undefined && input.targetLineType !== null) {
    if (input.targetLineType !== "purchase") {
      return "invalid_credit_link_target";
    }
  }
  if (
    input.targetSupplierScope !== undefined &&
    input.creditSupplierScope !== undefined
  ) {
    const targetScope =
      typeof input.targetSupplierScope === "string"
        ? input.targetSupplierScope.trim()
        : "";
    const creditScope =
      typeof input.creditSupplierScope === "string"
        ? input.creditSupplierScope.trim()
        : "";
    if (!targetScope || !creditScope || targetScope !== creditScope) {
      return "invalid_credit_link_target";
    }
  }
  return null;
}
