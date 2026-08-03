export type OrdersHubLoadState = "loading" | "ready" | "error";

export function resolveOrdersHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): OrdersHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentOrdersHubGmailCopy(
  state: OrdersHubLoadState,
  ready: {
    title: string;
    body: string;
    actionTitle: string;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    loadingAction: string;
    unavailableAction: string;
  }
): { ready: boolean; title: string; body: string; actionTitle: string } {
  if (state === "loading") {
    return {
      ready: false,
      title: copy.loadingTitle,
      body: copy.loadingBody,
      actionTitle: copy.loadingAction
    };
  }
  if (state === "error") {
    return {
      ready: false,
      title: copy.unavailableTitle,
      body: copy.unavailableBody,
      actionTitle: copy.unavailableAction
    };
  }
  return {
    ready: true,
    title: ready.title,
    body: ready.body,
    actionTitle: ready.actionTitle
  };
}

export function presentOrdersHubLaneEmptyCopy(
  state: OrdersHubLoadState,
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
): { title: string; body: string } {
  if (state === "loading") {
    return { title: copy.loadingTitle, body: copy.loadingBody };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, body: copy.unavailableBody };
  }
  return { title: ready.title, body: ready.body };
}
