import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "./hubLoadState";

export type InventoryHubLoadState = "loading" | "ready" | "error";

export function resolveInventoryHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InventoryHubLoadState {
  return resolveRestaurantScopedHubLoadState(input);
}

export function presentInventoryHubActionsEditable(
  allowed: boolean,
  hubReady: boolean
): boolean {
  return presentRestaurantScopedHubActionsEditable({ allowed, hubReady });
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

export type InventoryHubStationHealthLoadState = "ready" | "unavailable" | "empty";

export function resolveInventoryHubStationHealthLoadState(input: {
  loadError: boolean;
  breakdown: { stationCount: number } | null | undefined;
}): InventoryHubStationHealthLoadState {
  if (input.loadError) return "unavailable";
  if (!input.breakdown || input.breakdown.stationCount <= 0) return "empty";
  return "ready";
}

export function presentInventoryHubStationHealthCopy(
  state: InventoryHubStationHealthLoadState,
  copy: {
    unavailableTitle: string;
    unavailableBody: string;
  }
): { title: string; message: string } | null {
  if (state !== "unavailable") return null;
  return {
    title: copy.unavailableTitle,
    message: copy.unavailableBody
  };
}
