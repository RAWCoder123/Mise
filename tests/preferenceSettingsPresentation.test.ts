import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentLanguageSettingsSelection,
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

test("language and notifications hubs wire soft-refresh and RetryNotice instead of false preference flashes", () => {
  assert.match(languageScreen, /resolvePreferenceSettingsLoadState/);
  assert.match(languageScreen, /presentLanguageSettingsSelection/);
  assert.match(languageScreen, /RetryNotice/);
  assert.match(languageScreen, /onRetry=\{\(\) => reload\(true\)\}/);
  assert.match(languageScreen, /settings\.language\.retry\.accessibility/);
  assert.match(languageScreen, /loading=\{hubLoadState === "loading"\}/);
  assert.match(languageScreen, /selection\.interactive/);

  assert.match(notificationsScreen, /resolvePreferenceSettingsLoadState/);
  assert.match(notificationsScreen, /presentNotificationSettingsSummary/);
  assert.match(notificationsScreen, /RetryNotice/);
  assert.match(notificationsScreen, /onRetry=\{\(\) => reload\(true\)\}/);
  assert.match(notificationsScreen, /settings\.notifications\.retry\.accessibility/);
  assert.match(notificationsScreen, /loading=\{hubLoadState === "loading"\}/);
  assert.match(notificationsScreen, /presentPreferenceSettingsValuesVisible/);
  assert.match(notificationsScreen, /valuesVisible \? preferences\[category\] : false/);
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
