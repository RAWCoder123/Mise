import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentOrdersHubGmailCopy,
  presentOrdersHubLaneEmptyCopy,
  presentOrdersHubMutationActionsEditable,
  presentOrdersHubMutationBusy,
  presentOrdersHubMutationNoticeCopy,
  resolveOrdersHubLoadState,
  resolveOrdersHubSendSuccessReason,
  type OrdersHubMutationNoticeReason
} from "../services/presentation/ordersHubPresentation";

const ordersHub = readFileSync("app/(tabs)/orders.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

const NOTICE_COPY: Record<OrdersHubMutationNoticeReason, { title: string; message: string }> = {
  viewOnly: { title: "View-only", message: "Managers send" },
  approved: { title: "Approved", message: "Tomatoes drafted" },
  approveFailed: { title: "Could not approve", message: "Retry approve" },
  dismissed: { title: "Dismissed", message: "Tomatoes dismissed" },
  dismissFailed: { title: "Could not dismiss", message: "Retry dismiss" },
  undoRestored: { title: "Restored", message: "Tomatoes restored" },
  undoFailed: { title: "Could not undo", message: "Retry undo" },
  copied: { title: "Copied", message: "Sysco copied" },
  copyFailed: { title: "Could not copy", message: "Retry copy" },
  placed: { title: "Placed", message: "Sysco placed" },
  placeFailed: { title: "Could not place", message: "Retry place" },
  sendDemoAlready: { title: "Already simulated", message: "Already in history" },
  sendDemoZero: { title: "Demo sent", message: "Simulated zero" },
  sendDemoOne: { title: "Demo sent", message: "Simulated one" },
  sendDemoOther: { title: "Demo sent", message: "Simulated other" },
  sendGmailAlready: { title: "Already sent", message: "No duplicate" },
  sendGmailZero: { title: "Gmail sent", message: "Sent zero" },
  sendGmailOne: { title: "Gmail sent", message: "Sent one" },
  sendGmailOther: { title: "Gmail sent", message: "Sent other" },
  loadFailed: { title: "Load failed", message: "Retry load" }
};

test("orders hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveOrdersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveOrdersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveOrdersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveOrdersHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveOrdersHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: true
    }),
    "ready"
  );
});

test("orders Gmail and lane copy never claim empty or disconnected while loading or failed", () => {
  const loadingGmail = presentOrdersHubGmailCopy(
    "loading",
    {
      title: "Send from restaurant Gmail",
      body: "Connect Gmail so approved orders can be sent",
      actionTitle: "Link Gmail"
    },
    {
      loadingTitle: "Loading Gmail status…",
      loadingBody: "Refreshing restaurant email connection",
      unavailableTitle: "Gmail status unavailable",
      unavailableBody: "Retry to refresh the restaurant Gmail connection",
      loadingAction: "Loading",
      unavailableAction: "Unavailable"
    }
  );
  assert.equal(loadingGmail.ready, false);
  assert.equal(loadingGmail.title, "Loading Gmail status…");
  assert.doesNotMatch(loadingGmail.title, /send from restaurant gmail|connect gmail/i);
  assert.doesNotMatch(loadingGmail.body, /connect gmail|approved orders/i);
  assert.equal(loadingGmail.actionTitle, "Loading");

  const errorGmail = presentOrdersHubGmailCopy(
    "error",
    {
      title: "Send from restaurant Gmail",
      body: "Connect Gmail so approved orders can be sent",
      actionTitle: "Link Gmail"
    },
    {
      loadingTitle: "Loading Gmail status…",
      loadingBody: "Refreshing restaurant email connection",
      unavailableTitle: "Gmail status unavailable",
      unavailableBody: "Retry to refresh the restaurant Gmail connection",
      loadingAction: "Loading",
      unavailableAction: "Unavailable"
    }
  );
  assert.equal(errorGmail.ready, false);
  assert.equal(errorGmail.title, "Gmail status unavailable");
  assert.equal(errorGmail.actionTitle, "Unavailable");

  const readyGmail = presentOrdersHubGmailCopy(
    "ready",
    {
      title: "Restaurant Gmail connected",
      body: "Approved orders are sent from kitchen@example.com",
      actionTitle: "Manage"
    },
    {
      loadingTitle: "Loading Gmail status…",
      loadingBody: "Refreshing restaurant email connection",
      unavailableTitle: "Gmail status unavailable",
      unavailableBody: "Retry to refresh the restaurant Gmail connection",
      loadingAction: "Loading",
      unavailableAction: "Unavailable"
    }
  );
  assert.equal(readyGmail.ready, true);
  assert.equal(readyGmail.title, "Restaurant Gmail connected");
  assert.equal(readyGmail.actionTitle, "Manage");

  const loadingLane = presentOrdersHubLaneEmptyCopy(
    "loading",
    {
      title: "No supplier drafts",
      body: "Approve a recommendation and Mise will create a draft"
    },
    {
      loadingTitle: "Loading supplier drafts…",
      loadingBody: "Refreshing approved order drafts",
      unavailableTitle: "Supplier drafts unavailable",
      unavailableBody: "Retry to refresh supplier drafts"
    }
  );
  assert.equal(loadingLane.title, "Loading supplier drafts…");
  assert.doesNotMatch(loadingLane.title, /no supplier drafts/i);
  assert.doesNotMatch(loadingLane.body, /approve a recommendation/i);

  const errorLane = presentOrdersHubLaneEmptyCopy(
    "error",
    {
      title: "No order history yet",
      body: "Supplier drafts appear here after they are sent"
    },
    {
      loadingTitle: "Loading sent orders…",
      loadingBody: "Refreshing sent supplier orders",
      unavailableTitle: "Sent orders unavailable",
      unavailableBody: "Retry to refresh sent orders"
    }
  );
  assert.equal(errorLane.title, "Sent orders unavailable");
  assert.doesNotMatch(errorLane.title, /no order history/i);

  const readyLane = presentOrdersHubLaneEmptyCopy(
    "ready",
    {
      title: "No completed orders yet",
      body: "Completed supplier orders appear here"
    },
    {
      loadingTitle: "Loading order history…",
      loadingBody: "Refreshing completed orders",
      unavailableTitle: "Order history unavailable",
      unavailableBody: "Retry to refresh order history"
    }
  );
  assert.equal(readyLane.title, "No completed orders yet");
  assert.equal(readyLane.body, "Completed supplier orders appear here");
});

test("orders hub wires soft-refresh and RetryNotice instead of false empty lanes", () => {
  assert.match(ordersHub, /resolveOrdersHubLoadState/);
  assert.match(ordersHub, /presentOrdersHubGmailCopy/);
  assert.match(ordersHub, /presentOrdersHubLaneEmptyCopy/);
  assert.match(ordersHub, /RetryNotice/);
  assert.match(ordersHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(ordersHub, /retryLabel=\{t\("common\.retry"\)\}/);
  assert.match(ordersHub, /loadedRestaurantRef/);
  assert.match(ordersHub, /setLoadedRestaurantId/);
  assert.match(ordersHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(ordersHub, /hubReady\s*\?\s*recommendations\s*:\s*\[\]/);
  assert.match(ordersHub, /hubReady\s*\?\s*orders\s*:\s*\[\]/);
  assert.match(ordersHub, /orders\.gmail\.loading\.title/);
  assert.match(ordersHub, /orders\.empty\.drafts\.unavailableTitle/);
  assert.match(ordersHub, /orders\.empty\.sent\.unavailableTitle/);
  assert.match(ordersHub, /orders\.empty\.history\.unavailableTitle/);
});

test("orders hub mutation busy and editable helpers gate actions while busy", () => {
  assert.equal(presentOrdersHubMutationBusy(false), false);
  assert.equal(presentOrdersHubMutationBusy(true), true);
  assert.equal(presentOrdersHubMutationActionsEditable(true, false, true), true);
  assert.equal(presentOrdersHubMutationActionsEditable(true, true, true), false);
  assert.equal(presentOrdersHubMutationActionsEditable(false, false, true), false);
  assert.equal(presentOrdersHubMutationActionsEditable(true, false, false), false);
});

test("orders hub send success reason covers demo and Gmail plural outcomes", () => {
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: true,
      alreadySent: true,
      movedCount: 2
    }),
    "sendDemoAlready"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: true,
      alreadySent: false,
      movedCount: 0
    }),
    "sendDemoZero"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: true,
      alreadySent: false,
      movedCount: 1
    }),
    "sendDemoOne"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: true,
      alreadySent: false,
      movedCount: 3
    }),
    "sendDemoOther"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: false,
      alreadySent: true,
      movedCount: 0
    }),
    "sendGmailAlready"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: false,
      alreadySent: false,
      movedCount: 0
    }),
    "sendGmailZero"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: false,
      alreadySent: false,
      movedCount: 1
    }),
    "sendGmailOne"
  );
  assert.equal(
    resolveOrdersHubSendSuccessReason({
      usingLocalDemo: false,
      alreadySent: false,
      movedCount: 4
    }),
    "sendGmailOther"
  );
});

test("orders hub mutation notice copy uses success, neutral, and danger tones", () => {
  assert.equal(presentOrdersHubMutationNoticeCopy("approved", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("dismissed", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("undoRestored", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("copied", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("placed", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("sendDemoOne", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("sendGmailOther", NOTICE_COPY).tone, "success");
  assert.equal(presentOrdersHubMutationNoticeCopy("viewOnly", NOTICE_COPY).tone, "neutral");
  assert.equal(presentOrdersHubMutationNoticeCopy("approveFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentOrdersHubMutationNoticeCopy("dismissFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentOrdersHubMutationNoticeCopy("undoFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentOrdersHubMutationNoticeCopy("copyFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentOrdersHubMutationNoticeCopy("placeFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentOrdersHubMutationNoticeCopy("loadFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentOrdersHubMutationNoticeCopy("approved", NOTICE_COPY).title, "Approved");
  assert.equal(
    presentOrdersHubMutationNoticeCopy("approveFailed", NOTICE_COPY).message,
    "Retry approve"
  );
});

test("orders hub uses localized StatusNotice for mutation outcomes and captureMiseError", () => {
  assert.match(ordersHub, /presentOrdersHubMutationNoticeCopy/);
  assert.match(ordersHub, /resolveOrdersHubSendSuccessReason/);
  assert.match(ordersHub, /presentOrderDetailSendErrorNotice/);
  assert.match(ordersHub, /resolveOrderDetailSendErrorReason/);
  assert.match(ordersHub, /StatusNotice/);
  assert.match(ordersHub, /title=\{visibleNotice\.title\}/);
  assert.match(ordersHub, /message=\{visibleNotice\.message\}/);
  assert.match(ordersHub, /tone=\{visibleNotice\.tone\}/);
  assert.match(ordersHub, /captureMiseError/);
  assert.match(ordersHub, /flow:\s*"orders_hub"/);
  assert.match(ordersHub, /operation:\s*"approve"/);
  assert.match(ordersHub, /operation:\s*"dismiss"/);
  assert.match(ordersHub, /operation:\s*"undo"/);
  assert.match(ordersHub, /operation:\s*"place"/);
  assert.match(ordersHub, /operation:\s*"send"/);
  assert.match(ordersHub, /orders\.detail\.recovery\.gmail/);
  assert.match(ordersHub, /orders\.detail\.recovery\.supplier/);
  assert.doesNotMatch(ordersHub, /orders\.status\.attention/);
  assert.doesNotMatch(ordersHub, /showMessage\(/);
  assert.match(catalog, /"orders\.notice\.approvedTitle"/);
  assert.match(catalog, /"orders\.notice\.approveFailedTitle"/);
  assert.match(catalog, /"orders\.notice\.send\.gmailTitle"/);
  assert.match(catalog, /"orders\.notice\.approvedTitle":\s*"Recomendación aprobada"/);
  assert.match(catalog, /"orders\.notice\.send\.gmailTitle":\s*"已通过 Gmail 发送订单"/);
});
