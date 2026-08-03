import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentOrderDetailMissingCopy,
  presentOrderDetailMutationActionsEditable,
  presentOrderDetailMutationBusy,
  presentOrderDetailMutationNoticeCopy,
  presentOrderDetailSendErrorNotice,
  resolveOrderDetailLoadState,
  resolveOrderDetailSendErrorReason
} from "../services/presentation/orderDetailPresentation";

const orderDetail = readFileSync("app/orders/[id].tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("order detail load state stays ready after soft-refresh failure with prior restaurant data", () => {
  assert.equal(
    resolveOrderDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: "rest_a",
      loadError: true
    }),
    "ready"
  );
  assert.equal(
    resolveOrderDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveOrderDetailLoadState({
      restaurantId: "rest_a",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
});

test("order detail missing copy distinguishes loading, error, and not found", () => {
  const copy = {
    loading: "Loading order",
    unavailable: "Unavailable order",
    notFound: "Missing order"
  };
  assert.equal(presentOrderDetailMissingCopy("loading", copy), "Loading order");
  assert.equal(presentOrderDetailMissingCopy("error", copy), "Unavailable order");
  assert.equal(presentOrderDetailMissingCopy("ready", copy), "Missing order");
});

test("order detail mutation busy and editable helpers gate manager actions", () => {
  assert.equal(presentOrderDetailMutationBusy(true), true);
  assert.equal(presentOrderDetailMutationBusy(false), false);
  assert.equal(presentOrderDetailMutationActionsEditable(true, false, true), true);
  assert.equal(presentOrderDetailMutationActionsEditable(true, true, true), false);
  assert.equal(presentOrderDetailMutationActionsEditable(false, false, true), false);
  assert.equal(presentOrderDetailMutationActionsEditable(true, false, false), false);
});

test("order detail mutation notice copy maps success, caution, warning, and danger tones", () => {
  const copy = {
    viewOnly: { title: "View only", message: "Managers edit drafts" },
    noteSaved: { title: "Note saved", message: "Draft updated" },
    noteSaveFailed: { title: "Note failed", message: "Try again" },
    copied: { title: "Copied", message: "Ready to paste" },
    copyFailed: { title: "Copy failed", message: "Try again" },
    placed: { title: "Placed", message: "Await delivery" },
    placeFailed: { title: "Place failed", message: "Reload" },
    demoSent: { title: "Demo sent", message: "No email" },
    alreadySent: { title: "Already sent", message: "Accepted body" },
    accepted: { title: "Accepted", message: "Moved to sent" },
    receiveInvalidStorage: { title: "Check receive", message: "Choose station" },
    receiveInvalidNote: { title: "Check receive", message: "Note too long" },
    receiveInvalidQuantity: { title: "Check receive", message: "Bad quantity" },
    received: { title: "Received", message: "Inventory updated" },
    receivedWithDiscrepancy: { title: "Received", message: "2 differed" },
    receiveFailed: { title: "Receive failed", message: "Try again" },
    gmailConnectRequired: { title: "Connect Gmail", message: "Authorize sender" },
    gmailReconnectRequired: { title: "Reconnect Gmail", message: "Authorize sender" },
    noRestaurant: { title: "Restaurant required", message: "Open workspace" },
    loadFailed: { title: "Load failed", message: "Could not load" }
  };

  assert.equal(presentOrderDetailMutationNoticeCopy("noteSaved", copy).tone, "success");
  assert.equal(presentOrderDetailMutationNoticeCopy("receivedWithDiscrepancy", copy).tone, "success");
  assert.equal(presentOrderDetailMutationNoticeCopy("viewOnly", copy).tone, "neutral");
  assert.equal(presentOrderDetailMutationNoticeCopy("noRestaurant", copy).tone, "warning");
  assert.equal(presentOrderDetailMutationNoticeCopy("receiveInvalidStorage", copy).tone, "warning");
  assert.equal(presentOrderDetailMutationNoticeCopy("gmailConnectRequired", copy).recovery, "gmail");
  assert.equal(presentOrderDetailMutationNoticeCopy("placeFailed", copy).tone, "danger");
  assert.equal(presentOrderDetailMutationNoticeCopy("accepted", copy).title, "Accepted");
});

test("order detail send error reasons preserve Gmail recovery paths", () => {
  assert.equal(resolveOrderDetailSendErrorReason(null), "sendFailed");
  assert.equal(resolveOrderDetailSendErrorReason("needs_reauth"), "gmailReconnectRequired");
  assert.equal(resolveOrderDetailSendErrorReason("gmail_not_connected"), "gmailConnectRequired");
  assert.equal(resolveOrderDetailSendErrorReason("supplier_email_missing"), "supplierEmailMissing");
  assert.equal(resolveOrderDetailSendErrorReason("delivery_requires_review"), "deliveryReview");
  assert.equal(resolveOrderDetailSendErrorReason("live_sending_disabled"), "sendingDisabled");
  assert.equal(resolveOrderDetailSendErrorReason("provider_rejected"), "sendFailedGmail");

  const copy = {
    gmailConnectRequired: { title: "Connect", message: "Link Gmail" },
    gmailReconnectRequired: { title: "Reconnect", message: "Link Gmail" },
    supplierEmailMissing: { title: "Supplier email", message: "Add recipient" },
    deliveryReview: { title: "Review", message: "Check delivery" },
    sendingDisabled: { title: "Disabled", message: "Not enabled" },
    sendFailed: { title: "Send failed", message: "Try again" },
    sendFailedGmail: { title: "Send failed", message: "Gmail failed" }
  };

  assert.equal(presentOrderDetailSendErrorNotice("gmailReconnectRequired", copy).recovery, "gmail");
  assert.equal(presentOrderDetailSendErrorNotice("supplierEmailMissing", copy).recovery, "supplier");
  assert.equal(presentOrderDetailSendErrorNotice("deliveryReview", copy).tone, "warning");
  assert.equal(presentOrderDetailSendErrorNotice("sendFailed", copy).tone, "danger");
  assert.equal(presentOrderDetailSendErrorNotice("sendFailedGmail", copy).message, "Gmail failed");
});

test("order detail wires soft-refresh and RetryNotice instead of false empty draft", () => {
  assert.match(orderDetail, /resolveOrderDetailLoadState/);
  assert.match(orderDetail, /presentOrderDetailMissingCopy/);
  assert.match(orderDetail, /RetryNotice/);
  assert.match(orderDetail, /orders\.detail\.retry\.title/);
  assert.match(orderDetail, /orders\.detail\.retry\.accessibility/);
  assert.match(orderDetail, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(orderDetail, /loadedRestaurantRef/);
  assert.match(orderDetail, /loadedOrderIdRef/);
  assert.match(orderDetail, /hubReady\s*\?\s*order\s*:\s*null/);
  assert.match(orderDetail, /keepPrior/);
  assert.match(orderDetail, /orders\.detail\.loading/);
  assert.match(orderDetail, /orders\.detail\.unavailable/);
});

test("order detail uses localized StatusNotice for mutation outcomes and captureMiseError", () => {
  assert.match(orderDetail, /presentOrderDetailMutationNoticeCopy/);
  assert.match(orderDetail, /presentOrderDetailSendErrorNotice/);
  assert.match(orderDetail, /presentOrderDetailMutationBusy/);
  assert.match(orderDetail, /presentOrderDetailMutationActionsEditable/);
  assert.match(orderDetail, /resolveOrderDetailSendErrorReason/);
  assert.match(orderDetail, /StatusNotice/);
  assert.match(orderDetail, /tone=\{notice\.tone\}/);
  assert.match(orderDetail, /captureMiseError/);
  assert.match(orderDetail, /flow:\s*"order_detail"/);
  assert.doesNotMatch(orderDetail, /function viewOnlyNotice/);
  assert.doesNotMatch(orderDetail, /function orderSendErrorNotice/);
  assert.doesNotMatch(orderDetail, /function gmailConnectionRequiredNotice/);
  assert.match(catalog, /orders\.detail\.notice\.noteSavedTitle/);
  assert.match(catalog, /orders\.detail\.notice\.receiveFailedTitle/);
  assert.match(catalog, /"orders\.detail\.notice\.placedTitle":\s*"Pedido marcado como realizado"/);
  assert.match(catalog, /"orders\.detail\.notice\.receivedTitle":\s*"已收货"/);
});
