import type { DemandFallback } from "../domain/miseDomain";
import { DEMO_RESTAURANT_ID, salesBaselines } from "./replaceableDemoData";

/** Seeded demand pattern for the demo tenant, used when no sales history exists yet. */
export const demoDemandFallback: DemandFallback = (menuItemName) => salesBaselines[menuItemName];

/**
 * Returns the seeded demand fallback for the demo tenant only.
 * Real tenants rely exclusively on learned restaurant history.
 */
export function demandFallbackForRestaurant(restaurantId: string): DemandFallback | undefined {
  return restaurantId === DEMO_RESTAURANT_ID ? demoDemandFallback : undefined;
}
