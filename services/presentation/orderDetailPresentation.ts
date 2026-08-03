export type OrderDetailLoadState = "loading" | "ready" | "error";

export function resolveOrderDetailLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): OrderDetailLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentOrderDetailMissingCopy(
  state: OrderDetailLoadState,
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
