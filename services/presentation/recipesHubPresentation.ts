export type RecipesHubLoadState = "loading" | "ready" | "error";

export function resolveRecipesHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): RecipesHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentRecipesHubEmptyCopy(
  state: RecipesHubLoadState,
  input: {
    searchNoMatches: boolean;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    emptyTitle: string;
    emptyBody: string;
    searchEmptyTitle: string;
    searchEmptyBody: string;
  }
): { title: string; body: string; compact: boolean } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody, compact: false };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, body: copy.unavailableBody, compact: false };
  }
  if (input.searchNoMatches) {
    return { title: copy.searchEmptyTitle, body: copy.searchEmptyBody, compact: true };
  }
  return { title: copy.emptyTitle, body: copy.emptyBody, compact: false };
}

export function presentRecipesHubSectionAction(
  state: RecipesHubLoadState,
  readyAction: string,
  copy: {
    loading: string;
    unavailable: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return readyAction;
}
