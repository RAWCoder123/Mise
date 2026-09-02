import {
  assertRecalculationRunsTenantScoped,
  sortRecalculationHistory
} from "../domain/recalculationHistory";
import type { PersistedRecalculationRun } from "../repositories/repositoryContracts";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/**
 * Read-only recalculation run ledger for operators. Does not dispatch cycles or
 * record attempts — those stay on the schedule / executor path.
 *
 * Filtering stays in the domain helper so the screen can switch Attention / All
 * without another round trip.
 */
export async function fetchRecalculationRuns(
  restaurantId: string,
  options: {
    limit?: number;
    sinceOperatingDate?: string;
  } = {}
): Promise<PersistedRecalculationRun[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const runs = await repository.listRecalculationRuns(normalizedRestaurantId, {
    sinceOperatingDate: options.sinceOperatingDate,
    limit
  });
  assertRecalculationRunsTenantScoped(runs, normalizedRestaurantId);
  return sortRecalculationHistory(runs).slice(0, limit);
}
