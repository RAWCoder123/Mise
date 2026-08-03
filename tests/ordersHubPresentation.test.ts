import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentOrdersHubGmailCopy,
  presentOrdersHubLaneEmptyCopy,
  resolveOrdersHubLoadState
} from "../services/presentation/ordersHubPresentation";

const ordersHub = readFileSync("app/(tabs)/orders.tsx", "utf8");

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
