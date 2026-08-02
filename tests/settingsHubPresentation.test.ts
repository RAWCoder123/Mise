import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentSettingsHubGmailCopy,
  presentSettingsHubRecipesCopy,
  presentSettingsHubSupplierCopy,
  resolveSettingsHubLoadState
} from "../services/presentation/settingsHubPresentation";
import type { RestaurantEmailConnection } from "../types/mise";

const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");

const gmailCopy = {
  loading: "Checking Gmail connection…",
  unavailable: "Gmail status unavailable. Retry to refresh.",
  connectedWithSender: (sender: string) => `${sender} · ready`,
  connected: "Connected and ready",
  reconnect: "Reconnect Gmail",
  restricted: "Workspace approval required",
  notConnected: "Connect Gmail",
  statusLoading: "Loading",
  statusUnavailable: "Unavailable",
  statusConnected: "Connected",
  statusNeedsReauth: "Reconnect",
  statusRestricted: "Admin approval",
  statusNotConnected: "Not connected"
};

test("settings hub load state stays loading until the active restaurant finishes loading", () => {
  assert.equal(
    resolveSettingsHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolveSettingsHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolveSettingsHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolveSettingsHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("gmail and supplier hub copy never claim empty or disconnected while loading or failed", () => {
  const loadingGmail = presentSettingsHubGmailCopy("loading", null, gmailCopy);
  assert.equal(loadingGmail.subtitle, gmailCopy.loading);
  assert.equal(loadingGmail.badgeLabel, gmailCopy.statusLoading);
  assert.equal(loadingGmail.tone, "neutral");

  const errorGmail = presentSettingsHubGmailCopy("error", null, gmailCopy);
  assert.equal(errorGmail.subtitle, gmailCopy.unavailable);
  assert.equal(errorGmail.badgeLabel, gmailCopy.statusUnavailable);
  assert.doesNotMatch(errorGmail.subtitle, /not connected|no suppliers/i);

  const connected: RestaurantEmailConnection = {
    id: "email-1",
    restaurant_id: "r1",
    provider: "gmail",
    status: "connected",
    sender_email: "orders@mise.test",
    last_verified_at: "2026-08-02T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-02T00:00:00.000Z"
  };
  const readyGmail = presentSettingsHubGmailCopy("ready", connected, gmailCopy);
  assert.equal(readyGmail.subtitle, "orders@mise.test · ready");
  assert.equal(readyGmail.badgeLabel, "Connected");
  assert.equal(readyGmail.tone, "leaf");

  const loadingSuppliers = presentSettingsHubSupplierCopy(
    "loading",
    [],
    {
      loading: "Loading suppliers…",
      unavailable: "Suppliers unavailable",
      empty: "No suppliers added yet.",
      list: (values) => values.join(", "),
      more: (listed, remaining) => `${listed} +${remaining}`
    },
    (value) => String(value)
  );
  assert.equal(loadingSuppliers.subtitle, "Loading suppliers…");
  assert.equal(loadingSuppliers.value, undefined);
  assert.doesNotMatch(loadingSuppliers.subtitle, /No suppliers added yet/i);

  const errorSuppliers = presentSettingsHubSupplierCopy(
    "error",
    [],
    {
      loading: "Loading suppliers…",
      unavailable: "Suppliers unavailable",
      empty: "No suppliers added yet.",
      list: (values) => values.join(", "),
      more: (listed, remaining) => `${listed} +${remaining}`
    },
    (value) => String(value)
  );
  assert.equal(errorSuppliers.subtitle, "Suppliers unavailable");
  assert.equal(errorSuppliers.value, undefined);
});

test("recipe hub copy surfaces coverage only when the hub is ready", () => {
  const loading = presentSettingsHubRecipesCopy(
    "loading",
    { unmapped: 4, incompatible: 2 },
    {
      loading: "Checking recipe coverage…",
      unavailable: "Recipe coverage unavailable",
      body: "Map dishes",
      unmappedOne: "1 unmapped",
      unmapped: (count) => `${count} unmapped`,
      incompatibleOne: "1 incompatible",
      incompatible: (count) => `${count} incompatible`
    },
    (value) => String(value)
  );
  assert.equal(loading.subtitle, "Checking recipe coverage…");
  assert.equal(loading.badgeLabel, undefined);
  assert.equal(loading.caution, false);

  const ready = presentSettingsHubRecipesCopy(
    "ready",
    { unmapped: 4, incompatible: 2 },
    {
      loading: "Checking recipe coverage…",
      unavailable: "Recipe coverage unavailable",
      body: "Map dishes",
      unmappedOne: "1 unmapped",
      unmapped: (count) => `${count} unmapped`,
      incompatibleOne: "1 incompatible",
      incompatible: (count) => `${count} incompatible`
    },
    (value) => String(value)
  );
  assert.equal(ready.subtitle, "2 incompatible");
  assert.equal(ready.badgeLabel, "2");
  assert.equal(ready.caution, true);
});

test("settings hub wires Screen loading and RetryNotice instead of false empty flashes", () => {
  assert.match(settingsHub, /resolveSettingsHubLoadState/);
  assert.match(settingsHub, /presentSettingsHubGmailCopy/);
  assert.match(settingsHub, /presentSettingsHubSupplierCopy/);
  assert.match(settingsHub, /presentSettingsHubRecipesCopy/);
  assert.match(settingsHub, /loading=\{hubLoading\}/);
  assert.match(settingsHub, /RetryNotice/);
  assert.match(settingsHub, /settings\.retry\.title/);
  assert.match(settingsHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(settingsHub, /loadedRestaurantRef/);
  assert.match(settingsHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.doesNotMatch(settingsHub, /Try reopening this screen/);
});
