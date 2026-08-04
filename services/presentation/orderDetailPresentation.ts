import { resolveRestaurantScopedHubLoadState } from "./hubLoadState";

export type OrderDetailLoadState = "loading" | "ready" | "error";

export function resolveOrderDetailLoadState(input: {
  restaurantId: string | null | undefined;
  loadedRestaurantId: string | null;
  loadError: boolean;
}): OrderDetailLoadState {
  return resolveRestaurantScopedHubLoadState(input);
}

export function presentOrderDetailMissingCopy(
  state: OrderDetailLoadState,
  copy: {
    loading: string;
    unavailable: string;
    notFound: string;
  }
): string {
  if (state === "loading") return copy.loading;
  if (state === "error") return copy.unavailable;
  return copy.notFound;
}

export type OrderDetailMutationNoticeReason =
  | "viewOnly"
  | "noteSaved"
  | "noteSaveFailed"
  | "copied"
  | "copyFailed"
  | "placed"
  | "placeFailed"
  | "demoSent"
  | "alreadySent"
  | "accepted"
  | "receiveInvalidStorage"
  | "receiveLocationsUnavailable"
  | "receiveInvalidNote"
  | "receiveInvalidQuantity"
  | "received"
  | "receivedWithDiscrepancy"
  | "receiveFailed"
  | "gmailConnectRequired"
  | "gmailReconnectRequired"
  | "noRestaurant"
  | "loadFailed";

export type OrderDetailReceivePutAwayLoadState = "ready" | "unavailable" | "empty";

export function resolveOrderDetailReceivePutAwayLoadState(input: {
  loadError: boolean;
  locationCount: number;
}): OrderDetailReceivePutAwayLoadState {
  if (input.loadError) return "unavailable";
  if (input.locationCount <= 0) return "empty";
  return "ready";
}

export function isOrderDetailReceiveBlockedByPutAwayLoad(
  state: OrderDetailReceivePutAwayLoadState
): boolean {
  return state === "unavailable";
}

export function isOrderDetailReceiveLocationReady(input: {
  putAwayLoadState: OrderDetailReceivePutAwayLoadState;
  locationId: string;
  locationIds: readonly string[];
}): boolean {
  if (input.putAwayLoadState === "unavailable") return false;
  if (input.putAwayLoadState === "empty") return true;
  return Boolean(input.locationId) && input.locationIds.includes(input.locationId);
}

export function presentOrderDetailReceivePutAwayCopy(
  state: OrderDetailReceivePutAwayLoadState,
  copy: {
    unavailableTitle: string;
    unavailableBody: string;
  }
): { title: string; message: string } | null {
  if (state !== "unavailable") return null;
  return {
    title: copy.unavailableTitle,
    message: copy.unavailableBody
  };
}

export type OrderDetailReceiveSummaryLoadState = "ready" | "unavailable" | "empty";

export function resolveOrderDetailReceiveSummaryLoadState(input: {
  loadError: boolean;
  lineCount: number;
}): OrderDetailReceiveSummaryLoadState {
  if (input.loadError) return "unavailable";
  if (input.lineCount <= 0) return "empty";
  return "ready";
}

export function presentOrderDetailReceiveSummaryCopy(
  state: OrderDetailReceiveSummaryLoadState,
  copy: {
    unavailableTitle: string;
    unavailableBody: string;
  }
): { title: string; message: string } | null {
  if (state !== "unavailable") return null;
  return {
    title: copy.unavailableTitle,
    message: copy.unavailableBody
  };
}

export type OrderDetailSendErrorReason =
  | "gmailConnectRequired"
  | "gmailReconnectRequired"
  | "supplierEmailMissing"
  | "deliveryReview"
  | "sendingDisabled"
  | "sendFailed"
  | "sendFailedGmail";

export type OrderDetailNoticeRecovery = "gmail" | "supplier";

export function presentOrderDetailMutationBusy(busy: boolean): boolean {
  return busy;
}

export function presentOrderDetailMutationActionsEditable(
  canManage: boolean,
  busy: boolean,
  hubReady: boolean
): boolean {
  return canManage && !busy && hubReady;
}

export function presentOrderDetailMutationNoticeCopy(
  reason: OrderDetailMutationNoticeReason,
  copy: Record<OrderDetailMutationNoticeReason, { title: string; message: string }>
): {
  tone: "danger" | "success" | "warning" | "neutral" | "caution";
  title: string;
  message: string;
  recovery?: OrderDetailNoticeRecovery;
} {
  const selected = copy[reason] ?? copy.loadFailed;
  if (
    reason === "noteSaved"
    || reason === "copied"
    || reason === "placed"
    || reason === "demoSent"
    || reason === "alreadySent"
    || reason === "accepted"
    || reason === "received"
    || reason === "receivedWithDiscrepancy"
  ) {
    return { tone: "success", title: selected.title, message: selected.message };
  }
  if (
    reason === "receiveInvalidStorage"
    || reason === "receiveLocationsUnavailable"
    || reason === "receiveInvalidNote"
    || reason === "receiveInvalidQuantity"
  ) {
    return { tone: "warning", title: selected.title, message: selected.message };
  }
  if (reason === "gmailConnectRequired") {
    return {
      tone: "warning",
      title: selected.title,
      message: selected.message,
      recovery: "gmail"
    };
  }
  if (reason === "gmailReconnectRequired") {
    return {
      tone: "warning",
      title: selected.title,
      message: selected.message,
      recovery: "gmail"
    };
  }
  if (reason === "viewOnly") {
    return { tone: "neutral", title: selected.title, message: selected.message };
  }
  if (reason === "noRestaurant") {
    return { tone: "warning", title: selected.title, message: selected.message };
  }
  return { tone: "danger", title: selected.title, message: selected.message };
}

export function resolveOrderDetailSendErrorReason(
  status: string | null | undefined
): OrderDetailSendErrorReason {
  if (status === "needs_reauth") return "gmailReconnectRequired";
  if (status === "gmail_not_connected") return "gmailConnectRequired";
  if (status === "supplier_email_missing" || status === "supplier_email_invalid") {
    return "supplierEmailMissing";
  }
  if (status === "delivery_requires_review" || status === "in_progress") {
    return "deliveryReview";
  }
  if (status === "live_sending_disabled" || status === "server_configuration_missing") {
    return "sendingDisabled";
  }
  if (status) return "sendFailedGmail";
  return "sendFailed";
}

export function presentOrderDetailSendErrorNotice(
  reason: OrderDetailSendErrorReason,
  copy: Record<OrderDetailSendErrorReason, { title: string; message: string }>
): {
  tone: "danger" | "warning";
  title: string;
  message: string;
  recovery?: OrderDetailNoticeRecovery;
} {
  const selected = copy[reason] ?? copy.sendFailed;
  if (reason === "gmailConnectRequired" || reason === "gmailReconnectRequired") {
    return {
      tone: "warning",
      title: selected.title,
      message: selected.message,
      recovery: "gmail"
    };
  }
  if (reason === "supplierEmailMissing") {
    return {
      tone: "warning",
      title: selected.title,
      message: selected.message,
      recovery: "supplier"
    };
  }
  if (reason === "deliveryReview" || reason === "sendingDisabled") {
    return { tone: "warning", title: selected.title, message: selected.message };
  }
  return { tone: "danger", title: selected.title, message: selected.message };
}
