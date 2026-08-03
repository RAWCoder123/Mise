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

export type PosMutationAction = "connect" | "import";

export type PosMutationNoticeReason =
  | "demoLoaded"
  | "csvImported"
  | "csvImportedMapped"
  | "csvImportedWithUnmapped"
  | "csvImportedWithIncompatible"
  | "csvImportedWithUnmappedAndIncompatible"
  | "liveProvidersRestricted"
  | "demoLoadFailed"
  | "csvImportFailed"
  | "csvValidationFailed";

export function presentPosMutationBusy(busyAction: PosMutationAction | null): boolean {
  return busyAction !== null;
}

export function presentPosMutationActionsEditable(
  busy: boolean,
  hubReady: boolean
): boolean {
  return !busy && hubReady;
}

export function presentPosMutationNoticeCopy(
  reason: PosMutationNoticeReason,
  copy: { title: string; message: string }
): {
  tone: "danger" | "success" | "warning" | "neutral" | "caution";
  title: string;
  message: string;
} {
  if (
    reason === "demoLoaded" ||
    reason === "csvImported" ||
    reason === "csvImportedMapped"
  ) {
    return { tone: "success", title: copy.title, message: copy.message };
  }
  if (
    reason === "csvImportedWithUnmapped" ||
    reason === "csvImportedWithIncompatible" ||
    reason === "csvImportedWithUnmappedAndIncompatible" ||
    reason === "csvValidationFailed" ||
    reason === "liveProvidersRestricted"
  ) {
    return { tone: "caution", title: copy.title, message: copy.message };
  }
  return { tone: "danger", title: copy.title, message: copy.message };
}

export function resolvePosCsvImportNoticeReason(input: {
  unmappedCount: number;
  incompatibleCount: number;
}): Extract<
  PosMutationNoticeReason,
  | "csvImportedMapped"
  | "csvImportedWithUnmapped"
  | "csvImportedWithIncompatible"
  | "csvImportedWithUnmappedAndIncompatible"
> {
  const unmapped = Math.max(0, Math.trunc(input.unmappedCount));
  const incompatible = Math.max(0, Math.trunc(input.incompatibleCount));
  if (unmapped > 0 && incompatible > 0) return "csvImportedWithUnmappedAndIncompatible";
  if (unmapped > 0) return "csvImportedWithUnmapped";
  if (incompatible > 0) return "csvImportedWithIncompatible";
  return "csvImportedMapped";
}
