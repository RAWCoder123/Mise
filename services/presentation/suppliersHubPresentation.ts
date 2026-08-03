export type SuppliersHubLoadState = "loading" | "ready" | "error";

export function resolveSuppliersHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): SuppliersHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentSuppliersHubConfiguredCount(
  state: SuppliersHubLoadState,
  configuredCount: number,
  totalCount: number,
  copy: {
    loading: string;
    unavailable: string;
    configuredCount: (configured: string, total: string) => string;
  },
  formatNumber: (value: number) => string
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.configuredCount(formatNumber(configuredCount), formatNumber(totalCount));
}

export function presentSuppliersHubEmptyCopy(
  state: SuppliersHubLoadState,
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    emptyTitle: string;
    emptyBody: string;
  }
): { title: string; body: string } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, body: copy.unavailableBody };
  }
  return { title: copy.emptyTitle, body: copy.emptyBody };
}
