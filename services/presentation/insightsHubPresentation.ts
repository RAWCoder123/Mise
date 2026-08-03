export type InsightsHubLoadState = "loading" | "ready" | "error";

export function resolveInsightsHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): InsightsHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentInsightsHubSummaryCopy(
  state: InsightsHubLoadState,
  ready: {
    title: string;
    body: string;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
  }
): { ready: boolean; title: string; body: string } {
  if (state === "loading") {
    return { ready: false, title: copy.loadingTitle, body: copy.loadingBody };
  }
  if (state === "error") {
    return { ready: false, title: copy.unavailableTitle, body: copy.unavailableBody };
  }
  return { ready: true, title: ready.title, body: ready.body };
}

export function presentInsightsHubBriefEmptyCopy(
  state: InsightsHubLoadState,
  input: {
    hasInsights: boolean;
    filterLabel: string;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    emptyLearningTitle: string;
    emptyLearningBody: string;
    emptyFilterTitle: (filter: string) => string;
    emptyFilterBody: string;
  }
): { title: string; body: string } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, body: copy.unavailableBody };
  }
  if (!input.hasInsights) {
    return { title: copy.emptyLearningTitle, body: copy.emptyLearningBody };
  }
  return {
    title: copy.emptyFilterTitle(input.filterLabel),
    body: copy.emptyFilterBody
  };
}

export function presentInsightsHubTrendEmptyCopy(
  state: InsightsHubLoadState,
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

export function presentInsightsHubBriefAction(
  state: InsightsHubLoadState,
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
