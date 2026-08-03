import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentPosHubHeroCopy,
  presentPosMutationActionsEditable,
  presentPosMutationBusy,
  presentPosMutationNoticeCopy,
  presentSettingsHubPosCopy,
  resolvePosCsvImportNoticeReason,
  resolvePosHubLoadState
} from "../services/presentation/posHubPresentation";

const posHub = readFileSync("app/settings/pos.tsx", "utf8");
const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

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

test("POS mutation busy and editable helpers gate connect and import while busy", () => {
  assert.equal(presentPosMutationBusy(null), false);
  assert.equal(presentPosMutationBusy("connect"), true);
  assert.equal(presentPosMutationBusy("import"), true);
  assert.equal(presentPosMutationActionsEditable(false, true), true);
  assert.equal(presentPosMutationActionsEditable(true, true), false);
  assert.equal(presentPosMutationActionsEditable(false, false), false);
});

test("POS mutation notice copy uses success for clean imports and caution for repair outcomes", () => {
  assert.equal(
    presentPosMutationNoticeCopy("demoLoaded", {
      title: "Demo POS loaded",
      message: "Toast demo data loaded."
    }).tone,
    "success"
  );
  assert.equal(
    presentPosMutationNoticeCopy("csvImportedMapped", {
      title: "CSV sales imported",
      message: "Imported 12 POS sales rows."
    }).tone,
    "success"
  );
  assert.equal(
    presentPosMutationNoticeCopy("csvImportedWithUnmapped", {
      title: "CSV imported — mapping needed",
      message: "3 sales still need recipe mapping."
    }).tone,
    "caution"
  );
  assert.equal(
    presentPosMutationNoticeCopy("csvValidationFailed", {
      title: "CSV needs fixes",
      message: "Fix CSV validation issues before importing."
    }).tone,
    "caution"
  );
  assert.equal(
    presentPosMutationNoticeCopy("liveProvidersRestricted", {
      title: "Live POS providers restricted",
      message: "CSV import is available below."
    }).tone,
    "caution"
  );
  assert.equal(
    presentPosMutationNoticeCopy("csvImportFailed", {
      title: "CSV import failed",
      message: "Could not import the POS CSV."
    }).tone,
    "danger"
  );
  assert.equal(
    presentPosMutationNoticeCopy("demoLoadFailed", {
      title: "Demo POS failed",
      message: "Could not load demo POS data."
    }).tone,
    "danger"
  );
});

test("POS CSV import notice reason resolves mapped, unmapped, and incompatible outcomes", () => {
  assert.equal(
    resolvePosCsvImportNoticeReason({ unmappedCount: 0, incompatibleCount: 0 }),
    "csvImportedMapped"
  );
  assert.equal(
    resolvePosCsvImportNoticeReason({ unmappedCount: 2, incompatibleCount: 0 }),
    "csvImportedWithUnmapped"
  );
  assert.equal(
    resolvePosCsvImportNoticeReason({ unmappedCount: 0, incompatibleCount: 1 }),
    "csvImportedWithIncompatible"
  );
  assert.equal(
    resolvePosCsvImportNoticeReason({ unmappedCount: 2, incompatibleCount: 1 }),
    "csvImportedWithUnmappedAndIncompatible"
  );
});

test("POS hub uses localized StatusNotice for mutation outcomes and captureMiseError", () => {
  assert.match(posHub, /presentPosMutationNoticeCopy/);
  assert.match(posHub, /resolvePosCsvImportNoticeReason/);
  assert.match(posHub, /presentPosMutationBusy/);
  assert.match(posHub, /presentPosMutationActionsEditable/);
  assert.match(posHub, /StatusNotice/);
  assert.match(posHub, /tone=\{notice\.tone\}/);
  assert.match(posHub, /captureMiseError/);
  assert.match(posHub, /flow:\s*"settings_pos"/);
  assert.match(posHub, /operation:\s*"load"/);
  assert.match(posHub, /operation:\s*"connect"/);
  assert.match(posHub, /operation:\s*"import"/);
  assert.doesNotMatch(posHub, /styles\.message/);
  assert.doesNotMatch(posHub, /setMessage\(/);
  assert.match(catalog, /pos\.notice\.demoLoaded\.title/);
  assert.match(catalog, /pos\.notice\.csvImportFailed\.title/);
  assert.match(catalog, /"pos\.notice\.demoLoaded\.title":\s*"POS de demostración cargado"/);
  assert.match(catalog, /"pos\.notice\.csvImportFailed\.title":\s*"CSV 导入失败"/);
});
