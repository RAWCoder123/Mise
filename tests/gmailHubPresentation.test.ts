import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentGmailHubSenderCopy,
  presentGmailHubStatusCopy,
  resolveGmailHubLoadState
} from "../services/presentation/gmailHubPresentation";

const gmailHub = readFileSync("app/settings/gmail.tsx", "utf8");

test("gmail hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveGmailHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveGmailHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveGmailHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
});

test("gmail status and sender copy never claim disconnected while loading or failed", () => {
  const loading = presentGmailHubStatusCopy("loading", null, {
    loading: "Checking Gmail…",
    unavailable: "Gmail unavailable",
    connected: "Connected",
    needsReauth: "Needs reconnect",
    restricted: "Restricted",
    notConnected: "Not connected"
  });
  assert.equal(loading.label, "Checking Gmail…");
  assert.equal(loading.metaReady, false);
  assert.doesNotMatch(loading.label, /not connected/i);

  const error = presentGmailHubStatusCopy("error", null, {
    loading: "Checking Gmail…",
    unavailable: "Gmail unavailable",
    connected: "Connected",
    needsReauth: "Needs reconnect",
    restricted: "Restricted",
    notConnected: "Not connected"
  });
  assert.equal(error.label, "Gmail unavailable");

  assert.equal(
    presentGmailHubSenderCopy("loading", null, {
      loading: "Refreshing sender…",
      unavailable: "Sender unavailable",
      notConnected: "Not connected"
    }),
    "Refreshing sender…"
  );
  assert.equal(
    presentGmailHubSenderCopy("ready", "ops@example.com", {
      loading: "Refreshing sender…",
      unavailable: "Sender unavailable",
      notConnected: "Not connected"
    }),
    "ops@example.com"
  );
  assert.equal(
    presentGmailHubStatusCopy("ready", "connected", {
      loading: "Checking Gmail…",
      unavailable: "Gmail unavailable",
      connected: "Connected",
      needsReauth: "Needs reconnect",
      restricted: "Restricted",
      notConnected: "Not connected"
    }).label,
    "Connected"
  );
});

test("gmail hub wires soft-refresh and RetryNotice instead of false disconnected state", () => {
  assert.match(gmailHub, /resolveGmailHubLoadState/);
  assert.match(gmailHub, /presentGmailHubStatusCopy/);
  assert.match(gmailHub, /RetryNotice/);
  assert.match(gmailHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(gmailHub, /loadedRestaurantRef/);
  assert.match(gmailHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(gmailHub, /hubReady\s*\?\s*connection\s*:\s*null/);
  assert.match(gmailHub, /settings\.gmail\.status\.loading/);
  assert.match(gmailHub, /settings\.gmail\.retry\.accessibility/);
});
