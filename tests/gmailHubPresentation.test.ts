import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentGmailHubSenderCopy,
  presentGmailHubStatusCopy,
  presentGmailMutationActionsEditable,
  presentGmailMutationBusy,
  presentGmailMutationErrorNotice,
  presentGmailMutationNoticeCopy,
  resolveGmailHubLoadState,
  resolveGmailMutationErrorReason
} from "../services/presentation/gmailHubPresentation";

const gmailHub = readFileSync("app/settings/gmail.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

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

test("gmail mutation busy and editable helpers gate connect actions while busy", () => {
  assert.equal(presentGmailMutationBusy(null), false);
  assert.equal(presentGmailMutationBusy("connect"), true);
  assert.equal(presentGmailMutationBusy("disconnect"), true);
  assert.equal(presentGmailMutationActionsEditable(true, false, true), true);
  assert.equal(presentGmailMutationActionsEditable(true, true, true), false);
  assert.equal(presentGmailMutationActionsEditable(false, false, true), false);
  assert.equal(presentGmailMutationActionsEditable(true, false, false), false);
});

test("gmail mutation notice copy uses success for connect outcomes and warning for owner or callback failure", () => {
  const copy = {
    ownerRequired: { title: "Owner required", message: "Only owners connect Gmail" },
    oauthStarted: { title: "Finish with Google", message: "Return after approving" },
    callbackConnected: { title: "Gmail connected", message: "Verifying sender" },
    callbackFailed: { title: "Not connected", message: "Try again" },
    demoConnected: { title: "Demo connected", message: "Local simulation only" },
    disconnectedDemo: { title: "Disconnected", message: "Demo off" },
    disconnectedLive: { title: "Disconnected", message: "Access revoked" }
  };
  assert.equal(presentGmailMutationNoticeCopy("demoConnected", copy).tone, "success");
  assert.equal(presentGmailMutationNoticeCopy("callbackConnected", copy).tone, "success");
  assert.equal(presentGmailMutationNoticeCopy("disconnectedLive", copy).tone, "success");
  assert.equal(presentGmailMutationNoticeCopy("oauthStarted", copy).tone, "neutral");
  assert.equal(presentGmailMutationNoticeCopy("ownerRequired", copy).tone, "warning");
  assert.equal(presentGmailMutationNoticeCopy("callbackFailed", copy).tone, "warning");
});

test("gmail mutation error reason maps provider statuses without inventing success", () => {
  assert.equal(resolveGmailMutationErrorReason("server_configuration_missing"), "notEnabled");
  assert.equal(resolveGmailMutationErrorReason("live_sending_disabled"), "notEnabled");
  assert.equal(resolveGmailMutationErrorReason("delivery_requires_review"), "reviewRequired");
  assert.equal(resolveGmailMutationErrorReason("in_progress"), "reviewRequired");
  assert.equal(resolveGmailMutationErrorReason("needs_reauth"), "reconnectRequired");
  assert.equal(resolveGmailMutationErrorReason("gmail_not_connected"), "reconnectRequired");
  assert.equal(resolveGmailMutationErrorReason("unknown"), "actionFailed");
  assert.equal(resolveGmailMutationErrorReason(null), "actionFailed");

  const copy = {
    notEnabled: { title: "Not enabled", message: "Authorization failed" },
    reviewRequired: { title: "Review delivery", message: "Check the last send" },
    reconnectRequired: { title: "Reconnect", message: "Authorize again" },
    actionFailed: { title: "Action failed", message: "Try again" }
  };
  assert.equal(presentGmailMutationErrorNotice("notEnabled", copy).tone, "warning");
  assert.equal(presentGmailMutationErrorNotice("actionFailed", copy).tone, "danger");
  assert.equal(presentGmailMutationErrorNotice("reviewRequired", copy).title, "Review delivery");
});

test("gmail hub uses localized StatusNotice for mutation outcomes and captureMiseError", () => {
  assert.match(gmailHub, /presentGmailMutationNoticeCopy/);
  assert.match(gmailHub, /presentGmailMutationErrorNotice/);
  assert.match(gmailHub, /resolveGmailMutationErrorReason/);
  assert.match(gmailHub, /presentGmailMutationBusy/);
  assert.match(gmailHub, /presentGmailMutationActionsEditable/);
  assert.match(gmailHub, /StatusNotice/);
  assert.match(gmailHub, /tone=\{notice\.tone\}/);
  assert.match(gmailHub, /captureMiseError/);
  assert.match(gmailHub, /flow:\s*"settings_gmail"/);
  assert.doesNotMatch(gmailHub, /function gmailErrorNotice/);
  assert.doesNotMatch(gmailHub, /styles\.error/);
  assert.match(catalog, /settings\.gmail\.demoConnected\.title/);
  assert.match(catalog, /settings\.gmail\.error\.notEnabledTitle/);
  assert.match(catalog, /"settings\.gmail\.demoConnected\.title":\s*"Gmail de demostración conectado"/);
  assert.match(catalog, /"settings\.gmail\.error\.actionTitle":\s*"Gmail 操作失败"/);
});
