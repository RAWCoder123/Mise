import { setupImportLimits, parseSetupPosSalesCsv, type SetupImportValidationIssue, type SetupPosSaleDraft } from "./setupDrafts";

export interface ManualPosSaleIngestRow {
  source_record_id: string;
  sale_date: string;
  item_name: string;
  category: string;
  quantity_sold: number;
  gross_sales: number;
  net_sales: number;
  source_pos: "Manual CSV Upload";
}

export interface ManualPosSalesIngestPayload {
  status: "empty" | "ready" | "needs_review";
  rows: ManualPosSaleIngestRow[];
  drafts: SetupPosSaleDraft[];
  issues: SetupImportValidationIssue[];
  acceptedRowCount: number;
  rejectedRowCount: number;
  characterCount: number;
}

export function buildManualPosSalesIngestPayload(csvText: string): ManualPosSalesIngestPayload {
  const characterCount = csvText.length;
  const parsed = parseSetupPosSalesCsv(csvText);
  const rows = parsed.rows.map((draft) => ({
    source_record_id: draft.id,
    sale_date: draft.saleDate,
    item_name: draft.itemName,
    category: draft.category,
    quantity_sold: draft.quantitySold,
    gross_sales: draft.grossSales,
    net_sales: Math.round(draft.grossSales * 0.93 * 100) / 100,
    source_pos: "Manual CSV Upload" as const
  }));

  return {
    status: parsed.status,
    rows,
    drafts: parsed.rows,
    issues: parsed.issues,
    acceptedRowCount: parsed.acceptedRowCount,
    rejectedRowCount: parsed.rejectedRowCount,
    characterCount
  };
}

export function assertManualPosSalesIngestReady(payload: ManualPosSalesIngestPayload): ManualPosSaleIngestRow[] {
  if (payload.characterCount > setupImportLimits.characters) {
    throw new Error(`POS CSV is limited to ${setupImportLimits.characters.toLocaleString()} characters.`);
  }
  if (payload.status === "needs_review" || payload.issues.length > 0) {
    throw new Error("Fix CSV validation issues before importing.");
  }
  if (payload.status === "empty" || payload.rows.length === 0) {
    throw new Error("Paste at least one valid POS sales row before importing.");
  }
  if (payload.rows.length > setupImportLimits.rows) {
    throw new Error(`POS CSV is limited to ${setupImportLimits.rows.toLocaleString()} sales rows.`);
  }
  return payload.rows;
}
