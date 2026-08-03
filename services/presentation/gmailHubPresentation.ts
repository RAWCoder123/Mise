import type { RestaurantEmailConnection } from "../../types/mise";

export type GmailHubLoadState = "loading" | "ready" | "error";

export function resolveGmailHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): GmailHubLoadState {
  if (!input.restaurantId) return "ready";
  if (input.loadedRestaurantId === input.restaurantId) return "ready";
  if (input.loadError) return "error";
  return "loading";
}

export function presentGmailHubStatusCopy(
  state: GmailHubLoadState,
  status: RestaurantEmailConnection["status"] | null,
  copy: {
    loading: string;
    unavailable: string;
    connected: string;
    needsReauth: string;
    restricted: string;
    notConnected: string;
  }
): {
  label: string;
  badgeTone: "neutral" | "success" | "warning" | "danger";
  iconTone: "brand" | "leaf" | "warning" | "danger";
  metaReady: boolean;
} {
  if (state === "loading") {
    return { label: copy.loading, badgeTone: "neutral", iconTone: "brand", metaReady: false };
  }
  if (state === "error") {
    return { label: copy.unavailable, badgeTone: "neutral", iconTone: "brand", metaReady: false };
  }
  if (status === "connected") {
    return { label: copy.connected, badgeTone: "success", iconTone: "leaf", metaReady: true };
  }
  if (status === "needs_reauth") {
    return { label: copy.needsReauth, badgeTone: "warning", iconTone: "warning", metaReady: true };
  }
  if (status === "restricted") {
    return { label: copy.restricted, badgeTone: "danger", iconTone: "danger", metaReady: true };
  }
  return { label: copy.notConnected, badgeTone: "neutral", iconTone: "brand", metaReady: true };
}

export function presentGmailHubSenderCopy(
  state: GmailHubLoadState,
  senderEmail: string | null | undefined,
  copy: {
    loading: string;
    unavailable: string;
    notConnected: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return senderEmail ?? copy.notConnected;
}
