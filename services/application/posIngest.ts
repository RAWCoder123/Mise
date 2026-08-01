import {
  assertManualPosSalesIngestReady,
  buildManualPosSalesIngestPayload,
  type ManualPosSalesIngestPayload
} from "../domain/posCsvIngest";
import { regenerateOperationalSignals } from "./recalculations";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export interface ImportManualPosSalesCsvResult {
  posSalesRowsSaved: number;
  salesImportId?: string;
  consumptionMovementsWritten?: number;
  unmappedSaleCount?: number;
  skippedIncompatibleCount?: number;
  provider: "manual_csv";
  preview: Pick<ManualPosSalesIngestPayload, "acceptedRowCount" | "rejectedRowCount" | "issues">;
}

export function previewManualPosSalesCsv(csvText: string): ManualPosSalesIngestPayload {
  return buildManualPosSalesIngestPayload(csvText);
}

export async function importManualPosSalesCsv(
  restaurantId: string,
  csvText: string,
  sourceFileName?: string | null
): Promise<ImportManualPosSalesCsvResult> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const payload = buildManualPosSalesIngestPayload(csvText);
  const rows = assertManualPosSalesIngestReady(payload);
  const summary = await repository.importManualPosSalesCsv(
    normalizedRestaurantId,
    rows,
    sourceFileName?.trim() || null
  );
  // Hosted ingest_pos_csv already refreshes signals in Edge; avoid a second refresh_signals
  // that can fail after a successful import and look like an ingest error.
  if (!repository.workflowsRefreshOperationalSignals) {
    await regenerateOperationalSignals(normalizedRestaurantId);
  }

  return {
    posSalesRowsSaved: summary.posSalesRowsSaved,
    salesImportId: summary.salesImportId,
    consumptionMovementsWritten: summary.consumptionMovementsWritten ?? 0,
    unmappedSaleCount: summary.unmappedSaleCount ?? 0,
    skippedIncompatibleCount: summary.skippedIncompatibleCount ?? 0,
    provider: "manual_csv",
    preview: {
      acceptedRowCount: payload.acceptedRowCount,
      rejectedRowCount: payload.rejectedRowCount,
      issues: payload.issues
    }
  };
}
