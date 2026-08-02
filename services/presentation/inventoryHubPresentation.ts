export type InventoryHubLoadState = "loading" | "ready" | "error";

export function resolveInventoryHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InventoryHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentInventoryHubHealthCopy(
  state: InventoryHubLoadState,
  copy: {
    loading: string;
    unavailable: string;
  }
): { ready: boolean; message: string | null } {
  if (state === "loading") {
    return { ready: false, message: copy.loading };
  }
  if (state === "error") {
    return { ready: false, message: copy.unavailable };
  }
  return { ready: true, message: null };
}

export function presentInventoryHubListEmptyCopy(
  state: InventoryHubLoadState,
  input: {
    hasStationFilter: boolean;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    emptyTitle: string;
    emptyBody: string;
    stationEmptyBody: string;
  }
): { title: string; body: string } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, body: copy.unavailableBody };
  }
  return {
    title: copy.emptyTitle,
    body: input.hasStationFilter ? copy.stationEmptyBody : copy.emptyBody
  };
}
