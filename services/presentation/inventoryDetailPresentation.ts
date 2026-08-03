export type InventoryDetailLoadState = "loading" | "ready" | "error";

export function resolveInventoryDetailLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InventoryDetailLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentInventoryDetailMissingCopy(
  state: InventoryDetailLoadState,
  copy: {
    loading: string;
    unavailable: string;
    notFound: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.notFound;
}
