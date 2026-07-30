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
  await regenerateOperationalSignals(normalizedRestaurantId);

  return {
    posSalesRowsSaved: summary.posSalesRowsSaved,
    salesImportId: summary.salesImportId,
    provider: "manual_csv",
    preview: {
      acceptedRowCount: payload.acceptedRowCount,
      rejectedRowCount: payload.rejectedRowCount,
      issues: payload.issues
    }
  };
}
