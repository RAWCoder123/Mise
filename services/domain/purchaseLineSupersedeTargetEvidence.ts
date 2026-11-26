/**
 * Structural audit evidence for purchase-line supersession identity.
 *
 * `purchase_lines.supersedes_line_id` names the line a correction replaces.
 * Hosted `supersede_purchase_line` inherits supplier, document reference, line
 * index, line type, and `revision = target.revision + 1` from the target.
 * Soft CHECKs only require same-restaurant FK, non-self, and revision > 0
 * when a supersedes id is present.
 *
 * On current main, every other insert path (including direct service_role
 * inserts that satisfy those soft CHECKs) can stamp `supersedes_line_id` onto
 * a line from a different supplier, document, line index, or line type inside
 * the same restaurant, or with a non-contiguous revision. Netting then treats
 * the forged successor as having corrected the target and excludes the real
 * purchase history from current nets.
 *
 * This tip couples supersession to the same identity the RPC already inherits.
 * It does not rewrite ingest, append, or supersede RPCs.
 */

export type PurchaseLineSupersedeTargetSnapshot = {
  supplierId: string | null;
  sourceDocumentReference: string;
  lineIndex: number;
  lineType: "purchase" | "credit" | string;
  revision: number;
};

export type PurchaseLineSupersedeTargetEvidence = {
  supersedesLineId: string | null | undefined;
  supplierId: string | null;
  sourceDocumentReference: string;
  lineIndex: number;
  lineType: "purchase" | "credit" | string;
  revision: number;
  /** Null when the named target cannot be loaded in-tenant. */
  target: PurchaseLineSupersedeTargetSnapshot | null;
};

function supplierScope(supplierId: string | null) {
  return supplierId ?? "00000000-0000-0000-0000-000000000000";
}

/**
 * Domain rejection reason when a superseding line forges identity relative to
 * its target. Returns null when `supersedesLineId` is absent (revision 0) or
 * when identity and revision follow the corrected line.
 */
export function validatePurchaseLineSupersedeTargetEvidence(
  input: PurchaseLineSupersedeTargetEvidence
): string | null {
  if (input.supersedesLineId == null || input.supersedesLineId === "") {
    return null;
  }

  if (input.target == null) {
    return "supersede_target_missing";
  }

  if (supplierScope(input.supplierId) !== supplierScope(input.target.supplierId)) {
    return "supersede_target_supplier_mismatch";
  }

  if (
    input.sourceDocumentReference !== input.target.sourceDocumentReference
  ) {
    return "supersede_target_document_mismatch";
  }

  if (input.lineIndex !== input.target.lineIndex) {
    return "supersede_target_line_index_mismatch";
  }

  if (input.lineType !== input.target.lineType) {
    return "supersede_target_line_type_mismatch";
  }

  if (input.revision !== input.target.revision + 1) {
    return "supersede_target_revision_mismatch";
  }

  return null;
}
