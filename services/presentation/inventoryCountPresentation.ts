export type InventoryCountLoadState = "loading" | "ready" | "error";

export function resolveInventoryCountLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InventoryCountLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentInventoryCountStartCopy(
  state: InventoryCountLoadState,
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    startTitle: string;
    startBody: string;
  }
): { title: string; body: string; canStart: boolean } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody, canStart: false };
  }
  if (state === "error") {
    return {
      title: copy.unavailableTitle,
      body: copy.unavailableBody,
      canStart: false
    };
  }
  return { title: copy.startTitle, body: copy.startBody, canStart: true };
}
