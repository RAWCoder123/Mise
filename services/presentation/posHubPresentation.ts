export type PosHubLoadState = "loading" | "ready" | "error";

export function resolvePosHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): PosHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentPosHubHeroCopy(
  state: PosHubLoadState,
  input: {
    providerLabel: string | null;
    isDemoMode: boolean;
    csvConnected?: boolean;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    connectedTitle: (provider: string) => string;
    connectSourceTitle: string;
    csvReadyTitle: string;
    connectedDemoBody: (provider: string) => string;
    connectedCsvBody: string;
    demoModeBody: string;
    liveCsvBody: string;
  }
): { title: string; body: string; tone: "leaf" | "caution" | "neutral"; metaReady: boolean } {
  if (state === "loading") {
    return {
      title: copy.loadingTitle,
      body: copy.loadingBody,
      tone: "neutral",
      metaReady: false
    };
  }
  if (state === "error") {
    return {
      title: copy.unavailableTitle,
      body: copy.unavailableBody,
      tone: "neutral",
      metaReady: false
    };
  }
  if (input.providerLabel) {
    return {
      title: copy.connectedTitle(input.providerLabel),
      body: input.csvConnected
        ? copy.connectedCsvBody
        : copy.connectedDemoBody(input.providerLabel),
      tone: "leaf",
      metaReady: true
    };
  }
  return {
    title: input.isDemoMode ? copy.connectSourceTitle : copy.csvReadyTitle,
    body: input.isDemoMode ? copy.demoModeBody : copy.liveCsvBody,
    tone: "caution",
    metaReady: true
  };
}

export function presentSettingsHubPosCopy(
  state: PosHubLoadState,
  input: {
    providerLabel: string | null;
    isDemoMode: boolean;
  },
  copy: {
    loading: string;
    unavailable: string;
    connectedSubtitle: (provider: string) => string;
    notConnectedSubtitle: string;
    csvSubtitle: string;
    statusLoading: string;
    statusUnavailable: string;
    statusConnected: string;
    statusNotConnected: string;
    statusCsvReady: string;
  }
): { subtitle: string; badgeLabel: string; tone: "leaf" | "caution" | "neutral" } {
  if (state === "loading") {
    return { subtitle: copy.loading, badgeLabel: copy.statusLoading, tone: "neutral" };
  }
  if (state === "error") {
    return { subtitle: copy.unavailable, badgeLabel: copy.statusUnavailable, tone: "neutral" };
  }
  if (input.providerLabel) {
    return {
      subtitle: copy.connectedSubtitle(input.providerLabel),
      badgeLabel: copy.statusConnected,
      tone: "leaf"
    };
  }
  if (input.isDemoMode) {
    return {
      subtitle: copy.notConnectedSubtitle,
      badgeLabel: copy.statusNotConnected,
      tone: "neutral"
    };
  }
  return {
    subtitle: copy.csvSubtitle,
    badgeLabel: copy.statusCsvReady,
    tone: "neutral"
  };
}
