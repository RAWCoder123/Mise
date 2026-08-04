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
  resolvePosHubLoadState,
  type PosMutationNoticeReason
} from "../services/presentation/posHubPresentation";

const posHub = readFileSync("app/settings/pos.tsx", "utf8");
const settingsHub = readFileSync("app/(tabs)/settings.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

const NOTICE_COPY = (
  [
    "csvImported",
    "csvImportedMapped",
    "csvImportedWithUnmapped",
    "csvImportedWithIncompatible",
    "csvImportedWithUnmappedAndIncompatible",
    "demoLoaded",
    "demoLoadFailed",
    "csvImportFailed",
    "csvValidationFailed",
    "liveProviderRestricted",
    "loadFailed"
  ] as const satisfies readonly PosMutationNoticeReason[]
).reduce(
  (acc, reason) => {
    acc[reason] = { title: `${reason} title`, message: `${reason} message` };
    return acc;
  },
  {} as Record<PosMutationNoticeReason, { title: string; message: string }>
);

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

test("POS CSV import notice reasons prefer mapped success unless repair is needed", () => {
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
    resolvePosCsvImportNoticeReason({ unmappedCount: 3, incompatibleCount: 2 }),
    "csvImportedWithUnmappedAndIncompatible"
  );
});

test("POS mutation busy and editable helpers gate connect and import actions", () => {
  assert.equal(presentPosMutationBusy(null, false), false);
  assert.equal(presentPosMutationBusy("Toast", false), true);
  assert.equal(presentPosMutationBusy(null, true), true);
  assert.equal(presentPosMutationActionsEditable(true, false), true);
  assert.equal(presentPosMutationActionsEditable(false, false), false);
  assert.equal(presentPosMutationActionsEditable(true, true), false);
});

test("POS mutation notice copy uses success, caution, and danger tones", () => {
  assert.equal(presentPosMutationNoticeCopy("csvImportedMapped", NOTICE_COPY).tone, "success");
  assert.equal(presentPosMutationNoticeCopy("csvImportedWithUnmapped", NOTICE_COPY).tone, "success");
  assert.equal(presentPosMutationNoticeCopy("demoLoaded", NOTICE_COPY).tone, "success");
  assert.equal(presentPosMutationNoticeCopy("csvValidationFailed", NOTICE_COPY).tone, "caution");
  assert.equal(presentPosMutationNoticeCopy("liveProviderRestricted", NOTICE_COPY).tone, "caution");
  assert.equal(presentPosMutationNoticeCopy("demoLoadFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentPosMutationNoticeCopy("csvImportFailed", NOTICE_COPY).tone, "danger");
  assert.equal(presentPosMutationNoticeCopy("loadFailed", NOTICE_COPY).tone, "danger");
  assert.equal(
    presentPosMutationNoticeCopy("demoLoaded", NOTICE_COPY).title,
    "demoLoaded title"
  );
});

test("POS hub uses localized StatusNotice for mutation outcomes and captureMiseError", () => {
  assert.match(posHub, /presentPosMutationNoticeCopy/);
  assert.match(posHub, /resolvePosCsvImportNoticeReason/);
  assert.match(posHub, /presentPosMutationBusy/);
  assert.match(posHub, /presentPosMutationActionsEditable/);
  assert.match(posHub, /StatusNotice/);
  assert.match(posHub, /title=\{visibleNotice\.title\}/);
  assert.match(posHub, /message=\{visibleNotice\.message\}/);
  assert.match(posHub, /tone=\{visibleNotice\.tone\}/);
  assert.match(posHub, /captureMiseError/);
  assert.match(posHub, /flow:\s*"settings_pos"/);
  assert.match(posHub, /operation:\s*"load"/);
  assert.match(posHub, /operation:\s*"connect"/);
  assert.match(posHub, /operation:\s*"import"/);
  assert.match(posHub, /liveProviderRestricted/);
  assert.doesNotMatch(posHub, /styles\.message/);
  assert.doesNotMatch(posHub, /setMessage\(/);
  assert.match(catalog, /"pos\.notice\.demoLoadedTitle"/);
  assert.match(catalog, /"pos\.notice\.liveProviderRestrictedTitle"/);
  assert.match(catalog, /"pos\.error\.liveProviderRestricted"/);
  assert.match(catalog, /"pos\.notice\.demoLoadedTitle":\s*"POS de demostración conectado"/);
  assert.match(catalog, /"pos\.notice\.liveProviderRestrictedTitle":\s*"实时 POS 受限"/);
});
