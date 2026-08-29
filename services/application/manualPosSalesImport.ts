import type { SetupPosSaleDraft } from "../domain/setupDrafts";
import {
  planManualPosSalesImport,
  type ManualPosSalesImportSummary
} from "../domain/manualPosSalesImport";
import { regenerateOperationalSignals } from "./recalculations";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { ManualPosSalesImportSummary };

/**
 * Append or upsert Manual CSV Upload sales after day-0 setup without reopening
 * `save_restaurant_setup`. Hosted path refreshes signals inside the workflow;
 * demo regenerates locally after the durable rows land.
 */
export async function importManualPosSales(
  restaurantId: string,
  rows: readonly SetupPosSaleDraft[]
): Promise<ManualPosSalesImportSummary> {
  const planned = planManualPosSalesImport(restaurantId, rows);
  const summary = await repository.importManualPosSalesSnapshot(restaurantId, planned);
  await regenerateOperationalSignals(restaurantId);
  return summary;
}
