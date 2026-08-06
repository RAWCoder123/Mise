import { addDaysToDateKey, toDateKeyInTimeZone } from "../../utils/format";
import {
  buildWasteAnalysis,
  type WasteAnalysisSummary
} from "../domain/wasteAnalysis";
import { getMiseRepository } from "./repository";

export type { WasteAnalysisSummary } from "../domain/wasteAnalysis";

const WASTE_ANALYSIS_WINDOW_DAYS = 7;
const WASTE_HISTORY_LIMIT = 500;

/**
 * Screen-safe waste intelligence boundary. Hosted and demo evidence both come
 * from the append-only inventory ledger; only verified item conversions are
 * permitted to produce a dollar estimate.
 */
export async function fetchWasteAnalysis(
  restaurantId: string,
  options: { operatingDate?: string; now?: Date } = {}
): Promise<WasteAnalysisSummary> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const repository = getMiseRepository();
  const [restaurant, inventoryItems] = await Promise.all([
    repository.fetchRestaurant(normalizedRestaurantId),
    repository.fetchInventoryItems(normalizedRestaurantId)
  ]);
  if (restaurant.id !== normalizedRestaurantId) {
    throw new Error("Waste analysis restaurant identity did not match.");
  }

  const operatingDate =
    options.operatingDate ??
    toDateKeyInTimeZone(options.now ?? new Date(), restaurant.timezone);
  const historyStart = addDaysToDateKey(
    operatingDate,
    -(WASTE_ANALYSIS_WINDOW_DAYS * 2)
  );
  const events = await repository.listInventoryEvents(normalizedRestaurantId, {
    eventTypes: ["waste", "correction"],
    // Include a UTC guard day so restaurants east of UTC do not lose evidence
    // from the first local hours of the bounded analysis window.
    since: `${addDaysToDateKey(historyStart, -1)}T00:00:00.000Z`,
    limit: WASTE_HISTORY_LIMIT
  });

  return buildWasteAnalysis({
    restaurantId: normalizedRestaurantId,
    operatingDate,
    restaurantTimeZone: restaurant.timezone,
    inventoryItems,
    events,
    windowDays: WASTE_ANALYSIS_WINDOW_DAYS,
    historyTruncated: events.length === WASTE_HISTORY_LIMIT
  });
}
