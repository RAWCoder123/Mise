import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentLanguageSettingsNoticeCopy,
  presentLanguageSettingsSelection,
  presentNotificationSettingsNoticeCopy,
  presentNotificationSettingsSummary,
  presentPreferenceSettingsInteractive,
  presentPreferenceSettingsNote,
  presentPreferenceSettingsValuesVisible,
  resolvePreferenceSettingsLoadState
} from "../services/presentation/preferenceSettingsPresentation";

const languageScreen = readFileSync("app/settings/language.tsx", "utf8");
const notificationsScreen = readFileSync("app/settings/notifications.tsx", "utf8");
const localeContext = readFileSync("contexts/LocaleContext.tsx", "utf8");
const notificationContext = readFileSync("contexts/NotificationPreferencesContext.tsx", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");

test("preference settings load state stays loading until ready and surfaces load errors", () => {
  assert.equal(
    resolvePreferenceSettingsLoadState({
      sessionReady: false,
      ready: false,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolvePreferenceSettingsLoadState({
      sessionReady: true,
      ready: false,
      loadError: false
    }),
    "loading"
  );
  assert.equal(
    resolvePreferenceSettingsLoadState({
      sessionReady: true,
      ready: true,
      loadError: true
    }),
    "error"
  );
  assert.equal(
    resolvePreferenceSettingsLoadState({
      sessionReady: true,
      ready: true,
      loadError: false
    }),
    "ready"
  );
});

test("language selection never claims a definitive choice while loading", () => {
  const loading = presentLanguageSettingsSelection("loading", "es");
  assert.equal(loading.selectedLocale, null);
  assert.equal(loading.interactive, false);

  const error = presentLanguageSettingsSelection("error", "es");
  assert.equal(error.selectedLocale, "es");
  assert.equal(error.interactive, false);

  const ready = presentLanguageSettingsSelection("ready", "zh-Hans");
  assert.equal(ready.selectedLocale, "zh-Hans");
  assert.equal(ready.interactive, true);
});

test("notification summary never claims muted defaults while loading or failed", () => {
  assert.equal(
    presentNotificationSettingsSummary("loading", 3, {
      loading: "Loading alerts…",
      unavailable: "Alerts unavailable",
      muted: "3 muted",
      persistence: "Saved"
    }),
    "Loading alerts…"
  );
  assert.equal(
    presentNotificationSettingsSummary("error", 3, {
      loading: "Loading alerts…",
      unavailable: "Alerts unavailable",
      muted: "3 muted",
      persistence: "Saved"
    }),
    "Alerts unavailable"
  );
  assert.doesNotMatch(
    presentPreferenceSettingsNote("loading", {
      loading: "Loading language…",
      unavailable: "Language unavailable",
      ready: "Saved on device"
    }),
    /saved/i
  );
  assert.equal(presentPreferenceSettingsValuesVisible("error"), true);
  assert.equal(presentPreferenceSettingsValuesVisible("loading"), false);
  assert.equal(presentPreferenceSettingsInteractive("error"), false);
  assert.equal(presentPreferenceSettingsInteractive("ready"), true);
});

test("language and notification save notices use success only for saved", () => {
  const languageCopy = {
    saved: { title: "Language saved", message: "Updated to Español" },
    saveFailed: { title: "Could not save", message: "Try again" }
  };
  const languageSaved = presentLanguageSettingsNoticeCopy("saved", languageCopy);
  assert.equal(languageSaved.tone, "success");
  assert.equal(languageSaved.title, "Language saved");
  assert.equal(languageSaved.message, "Updated to Español");
  const languageFailed = presentLanguageSettingsNoticeCopy("saveFailed", languageCopy);
  assert.equal(languageFailed.tone, "danger");
  assert.equal(languageFailed.title, "Could not save");

  const notificationCopy = {
    saved: { title: "Alert saved", message: "Inventory set to Off" },
    saveFailed: { title: "Could not save alerts", message: "Try again" }
  };
  const notificationSaved = presentNotificationSettingsNoticeCopy("saved", notificationCopy);
  assert.equal(notificationSaved.tone, "success");
  assert.equal(notificationSaved.message, "Inventory set to Off");
  const notificationFailed = presentNotificationSettingsNoticeCopy("saveFailed", notificationCopy);
  assert.equal(notificationFailed.tone, "danger");
  assert.equal(notificationFailed.title, "Could not save alerts");
});

test("language and notifications hubs wire soft-refresh, RetryNotice, and localized StatusNotice", () => {
  assert.match(languageScreen, /resolvePreferenceSettingsLoadState/);
  assert.match(languageScreen, /presentLanguageSettingsSelection/);
  assert.match(languageScreen, /presentLanguageSettingsNoticeCopy/);
  assert.match(languageScreen, /StatusNotice/);
  assert.match(languageScreen, /captureMiseError/);
  assert.match(languageScreen, /RetryNotice/);
  assert.match(languageScreen, /onRetry=\{\(\) => reload\(true\)\}/);
  assert.match(languageScreen, /settings\.language\.retry\.accessibility/);
  assert.match(languageScreen, /loading=\{hubLoadState === "loading"\}/);
  assert.match(languageScreen, /selection\.interactive/);
  assert.doesNotMatch(languageScreen, /setStatus\(|styles\.statusError|styles\.statusSuccess/);

  assert.match(notificationsScreen, /resolvePreferenceSettingsLoadState/);
  assert.match(notificationsScreen, /presentNotificationSettingsSummary/);
  assert.match(notificationsScreen, /presentNotificationSettingsNoticeCopy/);
  assert.match(notificationsScreen, /StatusNotice/);
  assert.match(notificationsScreen, /captureMiseError/);
  assert.match(notificationsScreen, /RetryNotice/);
  assert.match(notificationsScreen, /onRetry=\{\(\) => reload\(true\)\}/);
  assert.match(notificationsScreen, /settings\.notifications\.retry\.accessibility/);
  assert.match(notificationsScreen, /loading=\{hubLoadState === "loading"\}/);
  assert.match(notificationsScreen, /presentPreferenceSettingsValuesVisible/);
  assert.match(notificationsScreen, /valuesVisible \? preferences\[category\] : false/);
  assert.doesNotMatch(notificationsScreen, /setStatus\(|styles\.statusError|styles\.statusSuccess/);

  assert.match(catalog, /settings\.language\.notice\.saveFailedTitle/);
  assert.match(catalog, /settings\.language\.notice\.savedTitle/);
  assert.match(catalog, /settings\.notifications\.notice\.saveFailedTitle/);
  assert.match(catalog, /settings\.notifications\.notice\.savedTitle/);
  assert.match(catalog, /"settings\.language\.notice\.saveFailedTitle":\s*"No se pudo guardar el idioma"/);
  assert.match(catalog, /"settings\.language\.notice\.saveFailedTitle":\s*"无法保存语言设置"/);
  assert.match(catalog, /"settings\.notifications\.notice\.savedTitle":\s*"Preferencia de alerta guardada"/);
  assert.match(catalog, /"settings\.notifications\.notice\.savedTitle":\s*"提醒偏好已保存"/);
});

test("locale and notification preference contexts soft-refresh without wiping prior values", () => {
  assert.match(localeContext, /loadError/);
  assert.match(localeContext, /reload/);
  assert.match(localeContext, /loadedScopeRef/);
  assert.match(
    localeContext,
    /const soft = !forceHardReloadRef\.current && loadedScopeRef\.current === expectedScope/
  );
  assert.match(localeContext, /if \(!soft\) \{\s*setLocaleState\(deviceLocale\)/);

  assert.match(notificationContext, /loadError/);
  assert.match(notificationContext, /reload/);
  assert.match(notificationContext, /loadedScopeRef/);
  assert.match(
    notificationContext,
    /const soft = !forceHardReloadRef\.current && loadedScopeRef\.current === expectedScope/
  );
  assert.match(
    notificationContext,
    /if \(!soft\) \{\s*setPreferences\(DEFAULT_NOTIFICATION_PREFERENCES\)/
  );
});
