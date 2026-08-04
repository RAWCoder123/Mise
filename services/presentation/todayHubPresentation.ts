import { resolveRestaurantScopedHubLoadState } from "./hubLoadState";

export type TodayHubLoadState = "loading" | "ready" | "error";

export type TodayHubNoticeTone = "neutral" | "success" | "caution" | "warning" | "danger";

export function resolveTodayHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): TodayHubLoadState {
  return resolveRestaurantScopedHubLoadState(input);
}

export function presentTodayServicePulseCopy(
  state: TodayHubLoadState,
  ready: {
    title: string;
    message: string;
    tone: TodayHubNoticeTone;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    loadingTone: TodayHubNoticeTone;
    unavailableTone: TodayHubNoticeTone;
  }
): { ready: boolean; title: string; message: string; tone: TodayHubNoticeTone } {
  if (state === "loading") {
    return {
      ready: false,
      title: copy.loadingTitle,
      message: copy.loadingBody,
      tone: copy.loadingTone
    };
  }
  if (state === "error") {
    return {
      ready: false,
      title: copy.unavailableTitle,
      message: copy.unavailableBody,
      tone: copy.unavailableTone
    };
  }
  return {
    ready: true,
    title: ready.title,
    message: ready.message,
    tone: ready.tone
  };
}

export function presentTodayInventoryHealthCopy(
  state: TodayHubLoadState,
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

export function presentTodayTasksEmptyCopy(
  state: TodayHubLoadState,
  input: {
    muted: boolean;
    hiddenCount: number;
  },
  copy: {
    loadingTitle: string;
    loadingBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    clearTitle: string;
    clearDetail: string;
    mutedTitle: string;
    mutedDetail: (count: string) => string;
  }
): { title: string; detail: string } {
  if (state === "loading") {
    return { title: copy.loadingTitle, detail: copy.loadingBody };
  }
  if (state === "error") {
    return { title: copy.unavailableTitle, detail: copy.unavailableBody };
  }
  if (input.muted) {
    return {
      title: copy.mutedTitle,
      detail: copy.mutedDetail(String(input.hiddenCount))
    };
  }
  return { title: copy.clearTitle, detail: copy.clearDetail };
}

export function presentTodaySalesEmptyCopy(
  state: TodayHubLoadState,
  ready: {
    empty: string;
  },
  copy: {
    loading: string;
    unavailable: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return ready.empty;
}
