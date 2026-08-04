import { resolveRestaurantScopedHubLoadState } from "./hubLoadState";

export type OrdersHubLoadState = "loading" | "ready" | "error";

export type OrdersHubMutationNoticeReason =
  | "viewOnly"
  | "approved"
  | "approveFailed"
  | "dismissed"
  | "dismissFailed"
  | "undoRestored"
  | "undoFailed"
  | "copied"
  | "copyFailed"
  | "placed"
  | "placeFailed"
  | "sendDemoAlready"
  | "sendDemoZero"
  | "sendDemoOne"
  | "sendDemoOther"
  | "sendGmailAlready"
  | "sendGmailZero"
  | "sendGmailOne"
  | "sendGmailOther"
  | "loadFailed";

export type OrdersHubNoticeRecovery = "gmail" | "supplier";

export function resolveOrdersHubLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): OrdersHubLoadState {
  return resolveRestaurantScopedHubLoadState(input);
}

export function presentOrdersHubMutationBusy(busy: boolean): boolean {
  return busy;
}

export function presentOrdersHubMutationActionsEditable(
  canManage: boolean,
  busy: boolean,
  hubReady: boolean
): boolean {
  return canManage && !busy && hubReady;
}

export function resolveOrdersHubSendSuccessReason(input: {
  usingLocalDemo: boolean;
  alreadySent: boolean;
  movedCount: number;
}): OrdersHubMutationNoticeReason {
  if (input.usingLocalDemo) {
    if (input.alreadySent) return "sendDemoAlready";
    if (input.movedCount === 0) return "sendDemoZero";
    if (input.movedCount === 1) return "sendDemoOne";
    return "sendDemoOther";
  }
  if (input.alreadySent) return "sendGmailAlready";
  if (input.movedCount === 0) return "sendGmailZero";
  if (input.movedCount === 1) return "sendGmailOne";
  return "sendGmailOther";
}

export function presentOrdersHubMutationNoticeCopy(
  reason: OrdersHubMutationNoticeReason,
  copy: Record<OrdersHubMutationNoticeReason, { title: string; message: string }>
): {
  tone: "danger" | "success" | "warning" | "neutral" | "caution";
  title: string;
  message: string;
} {
  const selected = copy[reason] ?? copy.loadFailed;
  if (
    reason === "approved"
    || reason === "dismissed"
    || reason === "undoRestored"
    || reason === "copied"
    || reason === "placed"
    || reason === "sendDemoAlready"
    || reason === "sendDemoZero"
    || reason === "sendDemoOne"
    || reason === "sendDemoOther"
    || reason === "sendGmailAlready"
    || reason === "sendGmailZero"
    || reason === "sendGmailOne"
    || reason === "sendGmailOther"
  ) {
    return { tone: "success", title: selected.title, message: selected.message };
  }
  if (reason === "viewOnly") {
    return { tone: "neutral", title: selected.title, message: selected.message };
  }
  return { tone: "danger", title: selected.title, message: selected.message };
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
