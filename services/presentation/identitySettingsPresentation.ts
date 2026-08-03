export type IdentitySettingsLoadState = "loading" | "ready" | "error" | "missing";

export function resolveProfileIdentityLoadState(input: {
  sessionReady: boolean;
  loaded: boolean;
  loadError: boolean;
}): IdentitySettingsLoadState {
  if (!input.sessionReady || (!input.loaded && !input.loadError)) return "loading";
  if (input.loadError) return "error";
  return "ready";
}

export function resolveRestaurantIdentityLoadState(input: {
  sessionReady: boolean;
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): IdentitySettingsLoadState {
  if (!input.sessionReady) return "loading";
  if (!input.restaurantId) return "missing";
  if (input.loadError) return "error";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  return "loading";
}

export function presentIdentitySettingsInteractive(state: IdentitySettingsLoadState): boolean {
  return state === "ready";
}

export function presentIdentitySettingsValuesVisible(state: IdentitySettingsLoadState): boolean {
  return state === "ready" || state === "error";
}

export function presentIdentitySettingsNote(
  state: IdentitySettingsLoadState,
  copy: {
    loading: string;
    unavailable: string;
    missing: string;
    ready: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  if (state === "missing") return copy.missing;
  return copy.ready;
}
