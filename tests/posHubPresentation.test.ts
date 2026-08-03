import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentPosHubHeroCopy,
  presentSettingsHubPosCopy,
  resolvePosHubLoadState
} from "../services/presentation/posHubPresentation";

const posHub = readFileSync("app/settings/pos.tsx", "utf8");
const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");

test("POS hub load state stays loading until the active restaurant status finishes", () => {
  assert.equal(
    resolvePosHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolvePosHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: "r1",
      loadError: false
    }),
    "ready"
  );
  assert.equal(
    resolvePosHubLoadState({
      restaurantId: "r1",
      loadedRestaurantId: null,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolvePosHubLoadState({
      restaurantId: null,
      loadedRestaurantId: null,
      loadError: false
    }),
    "ready"
  );
});

test("POS hub hero and settings row never claim disconnected while loading or failed", () => {
  const loadingHero = presentPosHubHeroCopy(
    "loading",
    { providerLabel: null, isDemoMode: true },
    {
      loadingTitle: "Checking POS connection…",
      loadingBody: "Refreshing sales source status",
      unavailableTitle: "POS status unavailable",
      unavailableBody: "Retry to refresh the sales source",
      connectedTitle: (provider) => `${provider} is connected`,
      connectSourceTitle: "Connect a sales source",
      csvReadyTitle: "Import CSV sales",
      connectedDemoBody: (provider) => `${provider} demo feed connected`,
      connectedCsvBody: "Manual CSV sales connected",
      demoModeBody: "Demo mode",
      liveCsvBody: "CSV import is available for private beta"
    }
  );
  assert.equal(loadingHero.title, "Checking POS connection…");
  assert.doesNotMatch(loadingHero.title, /connect a sales source|not connected|import csv/i);
  assert.equal(loadingHero.tone, "neutral");

  const errorHero = presentPosHubHeroCopy(
    "error",
    { providerLabel: "Toast", isDemoMode: true },
    {
      loadingTitle: "Checking POS connection…",
      loadingBody: "Refreshing sales source status",
      unavailableTitle: "POS status unavailable",
      unavailableBody: "Retry to refresh the sales source",
      connectedTitle: (provider) => `${provider} is connected`,
      connectSourceTitle: "Connect a sales source",
      csvReadyTitle: "Import CSV sales",
      connectedDemoBody: (provider) => `${provider} demo feed connected`,
      connectedCsvBody: "Manual CSV sales connected",
      demoModeBody: "Demo mode",
      liveCsvBody: "CSV import is available for private beta"
    }
  );
  assert.equal(errorHero.title, "POS status unavailable");
  assert.doesNotMatch(errorHero.title, /Toast is connected/i);

  const readyConnected = presentPosHubHeroCopy(
    "ready",
    { providerLabel: "Toast", isDemoMode: true, csvConnected: false },
    {
      loadingTitle: "Checking POS connection…",
      loadingBody: "Refreshing sales source status",
      unavailableTitle: "POS status unavailable",
      unavailableBody: "Retry to refresh the sales source",
      connectedTitle: (provider) => `${provider} is connected`,
      connectSourceTitle: "Connect a sales source",
      csvReadyTitle: "Import CSV sales",
      connectedDemoBody: (provider) => `${provider} demo feed connected`,
      connectedCsvBody: "Manual CSV sales connected",
      demoModeBody: "Demo mode",
      liveCsvBody: "CSV import is available for private beta"
    }
  );
  assert.equal(readyConnected.title, "Toast is connected");
  assert.equal(readyConnected.tone, "leaf");

  const loadingSettings = presentSettingsHubPosCopy(
    "loading",
    { providerLabel: null, isDemoMode: true },
    {
      loading: "Checking POS connection…",
      unavailable: "POS status unavailable. Retry to refresh.",
      connectedSubtitle: (provider) => `${provider} · sales source selected`,
      notConnectedSubtitle: "Select a source for recorded sales.",
      csvSubtitle: "Import sales CSV and repair unmapped menu items.",
      statusLoading: "Loading",
      statusUnavailable: "Unavailable",
      statusConnected: "Connected",
      statusNotConnected: "Not connected",
      statusCsvReady: "CSV ready"
    }
  );
  assert.equal(loadingSettings.subtitle, "Checking POS connection…");
  assert.equal(loadingSettings.badgeLabel, "Loading");
  assert.equal(loadingSettings.tone, "neutral");
  assert.doesNotMatch(loadingSettings.subtitle, /not connected|select a source/i);

  const errorSettings = presentSettingsHubPosCopy(
    "error",
    { providerLabel: null, isDemoMode: true },
    {
      loading: "Checking POS connection…",
      unavailable: "POS status unavailable. Retry to refresh.",
      connectedSubtitle: (provider) => `${provider} · sales source selected`,
      notConnectedSubtitle: "Select a source for recorded sales.",
      csvSubtitle: "Import sales CSV and repair unmapped menu items.",
      statusLoading: "Loading",
      statusUnavailable: "Unavailable",
      statusConnected: "Connected",
      statusNotConnected: "Not connected",
      statusCsvReady: "CSV ready"
    }
  );
  assert.equal(errorSettings.subtitle, "POS status unavailable. Retry to refresh.");
  assert.equal(errorSettings.badgeLabel, "Unavailable");
});

test("POS settings hub wires soft-refresh and RetryNotice instead of false disconnected flashes", () => {
  assert.match(posHub, /resolvePosHubLoadState/);
  assert.match(posHub, /presentPosHubHeroCopy/);
  assert.match(posHub, /RetryNotice/);
  assert.match(posHub, /onRetry=\{\(\) => void load\(true\)\}/);
  assert.match(posHub, /loadedRestaurantRef/);
  assert.match(posHub, /if \(showLoading \|\| loadedRestaurantRef\.current !== restaurantId\)/);
  assert.match(posHub, /pos\.retry\.accessibility/);
  assert.match(posHub, /pos\.empty\.unavailableTitle/);

  assert.match(settingsHub, /presentSettingsHubPosCopy/);
  assert.match(settingsHub, /settings\.integration\.pos\.loading/);
  assert.match(settingsHub, /settings\.integration\.pos\.unavailable/);
});
