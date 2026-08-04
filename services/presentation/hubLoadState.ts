export type RestaurantScopedHubLoadState = "loading" | "ready" | "error";

/**
 * Shared restaurant-scoped hub readiness.
 *
 * Soft-refresh may keep last-known values in component state, but a loadError
 * must never keep the hub "ready". Otherwise revoked-tenant or stale operational
 * data stays visible/actionable while RetryNotice is already showing.
 */
export function resolveRestaurantScopedHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): RestaurantScopedHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadError) return "error";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  return "loading";
}
