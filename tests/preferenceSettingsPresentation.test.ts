import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  presentLanguageSettingsNoticeCopy,
  presentLanguageSettingsSelection,
  presentPreferenceSettingsInteractive,
  presentPreferenceSettingsNote,
  presentPreferenceSettingsValuesVisible,
  resolvePreferenceSettingsLoadState
} from "../services/presentation/preferenceSettingsPresentation";

const languageScreen = readFileSync("app/settings/language.tsx", "utf8");
const localeContext = readFileSync("contexts/LocaleContext.tsx", "utf8");
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

test("preference notes never claim saved persistence while loading or failed", () => {
  assert.doesNotMatch(
    presentPreferenceSettingsNote("loading", {
      loading: "Loading language…",
      unavailable: "Language unavailable",
      ready: "Saved on device"
    }),
    /saved/i
  );
  assert.equal(
    presentPreferenceSettingsNote("error", {
      loading: "Loading language…",
      unavailable: "Language unavailable",
      ready: "Saved on device"
    }),
    "Language unavailable"
  );
  assert.equal(presentPreferenceSettingsValuesVisible("error"), true);
  assert.equal(presentPreferenceSettingsValuesVisible("loading"), false);
  assert.equal(presentPreferenceSettingsInteractive("error"), false);
  assert.equal(presentPreferenceSettingsInteractive("ready"), true);
});

test("language save notices use success only for saved", () => {
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
});

test("language hub wires soft-refresh, RetryNotice, and localized StatusNotice", () => {
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

  assert.match(catalog, /settings\.language\.notice\.saveFailedTitle/);
  assert.match(catalog, /settings\.language\.notice\.savedTitle/);
  assert.match(catalog, /settings\.language\.status\.loading/);
  assert.match(catalog, /settings\.language\.retry\.title/);
  assert.match(catalog, /"settings\.language\.notice\.saveFailedTitle":\s*"No se pudo guardar el idioma"/);
  assert.match(catalog, /"settings\.language\.notice\.saveFailedTitle":\s*"无法保存语言设置"/);
});

test("locale preference context soft-refreshes without wiping prior values", () => {
  assert.match(localeContext, /loadError/);
  assert.match(localeContext, /reload/);
  assert.match(localeContext, /loadedScopeRef/);
  assert.match(
    localeContext,
    /const soft = !forceHardReloadRef\.current && loadedScopeRef\.current === expectedScope/
  );
  assert.match(localeContext, /isTenantAuthorizationError/);
  assert.match(
    localeContext,
    /if \(!soft\) \{\s*setError\(null\);\s*setLoadError\(false\);\s*setLocaleState\(deviceLocale\)/
  );
  assert.match(localeContext, /Soft-refresh keeps loadError sticky until success/);
  assert.match(
    localeContext,
    /if \(isTenantAuthorizationError\(saveError\)\) \{\s*setLoadError\(true\);\s*\}/
  );
});
