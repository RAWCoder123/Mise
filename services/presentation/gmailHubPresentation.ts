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

export type GmailMutationAction = "connect" | "disconnect" | "refresh";

export type GmailMutationNoticeReason =
  | "ownerRequired"
  | "oauthStarted"
  | "callbackConnected"
  | "callbackFailed"
  | "demoConnected"
  | "disconnectedDemo"
  | "disconnectedLive";

export type GmailMutationErrorReason =
  | "notEnabled"
  | "reviewRequired"
  | "reconnectRequired"
  | "actionFailed";

export function presentGmailMutationBusy(
  busyAction: GmailMutationAction | null
): boolean {
  return busyAction !== null;
}

export function presentGmailMutationActionsEditable(
  canManage: boolean,
  busy: boolean,
  hubReady: boolean
): boolean {
  return canManage && !busy && hubReady;
}

export function presentGmailMutationNoticeCopy(
  reason: GmailMutationNoticeReason,
  copy: Record<GmailMutationNoticeReason, { title: string; message: string }>
): { tone: "danger" | "success" | "warning" | "neutral" | "caution"; title: string; message: string } {
  const selected = copy[reason] ?? copy.callbackFailed;
  if (
    reason === "demoConnected"
    || reason === "callbackConnected"
    || reason === "disconnectedDemo"
    || reason === "disconnectedLive"
  ) {
    return { tone: "success", title: selected.title, message: selected.message };
  }
  if (reason === "oauthStarted") {
    return { tone: "neutral", title: selected.title, message: selected.message };
  }
  return { tone: "warning", title: selected.title, message: selected.message };
}

export function resolveGmailMutationErrorReason(
  status: string | null | undefined
): GmailMutationErrorReason {
  if (status === "server_configuration_missing" || status === "live_sending_disabled") {
    return "notEnabled";
  }
  if (status === "delivery_requires_review" || status === "in_progress") {
    return "reviewRequired";
  }
  if (status === "needs_reauth" || status === "gmail_not_connected") {
    return "reconnectRequired";
  }
  return "actionFailed";
}

export function presentGmailMutationErrorNotice(
  reason: GmailMutationErrorReason,
  copy: Record<GmailMutationErrorReason, { title: string; message: string }>
): { tone: "danger" | "warning"; title: string; message: string } {
  const selected = copy[reason] ?? copy.actionFailed;
  return {
    tone: reason === "actionFailed" ? "danger" : "warning",
    title: selected.title,
    message: selected.message
  };
}
