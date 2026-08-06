import {
  buildDailyPhaseBriefs,
  type DailyPhaseBriefs
} from "../domain/dailyPhaseBrief";
import { fetchDailyOpsReport } from "./dailyReport";
import { fetchOperatingBrief } from "./operatingBrief";
import { fetchDailyOperatingPlan } from "./operatingPlan";

export type { DailyPhaseBriefs } from "../domain/dailyPhaseBrief";

/** Screen-safe Section 11 brief composition over the existing verified seams. */
export async function fetchDailyPhaseBriefs(
  restaurantId: string,
  options: { now?: Date } = {}
): Promise<DailyPhaseBriefs> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [operatingPlan, operatingBrief, dailyReport] = await Promise.all([
    fetchDailyOperatingPlan(normalizedRestaurantId, { includeCompletedTasks: true }),
    fetchOperatingBrief(normalizedRestaurantId),
    fetchDailyOpsReport(normalizedRestaurantId)
  ]);

  return buildDailyPhaseBriefs({
    restaurantId: normalizedRestaurantId,
    operatingPlan,
    operatingBrief,
    dailyReport,
    now: options.now
  });
}
