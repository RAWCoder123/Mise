import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  catalogs,
  resolveSupportedLocale,
  translate
} from "../i18n/catalog.ts";
import {
  formatLocalizedCurrency,
  formatLocalizedCompactCurrency,
  formatLocalizedDate,
  formatLocalizedDueTime,
  formatLocalizedList,
  formatLocalizedNumber,
  formatLocalizedRelativeTime,
  parseLocalizedNumber
} from "../i18n/formatters.ts";

test("all supported locales expose the same typed message catalog", () => {
  const englishKeys = Object.keys(catalogs.en).sort();
  assert.deepEqual(SUPPORTED_LOCALES, ["en", "es", "zh-Hans"]);

  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(catalogs[locale]).sort(), englishKeys);
    assert.ok(Object.values(catalogs[locale]).every((message) => message.length > 0));
  }
});

test("locale resolution supports regional English, Spanish, and Simplified Chinese tags", () => {
  assert.equal(resolveSupportedLocale("en-GB"), "en");
  assert.equal(resolveSupportedLocale("es_MX"), "es");
  assert.equal(resolveSupportedLocale("zh-CN"), "zh-Hans");
  assert.equal(resolveSupportedLocale("zh-Hans-SG"), "zh-Hans");
  assert.equal(resolveSupportedLocale("zh-Hant-TW"), DEFAULT_LOCALE);
  assert.equal(resolveSupportedLocale("fr-FR"), DEFAULT_LOCALE);
});

test("translations interpolate values without changing restaurant-entered content", () => {
  assert.equal(translate("en", "settings.language.savedAnnouncement", { language: "Español" }), "Language updated to Español.");
  assert.equal(translate("es", "relative.dueIn", { duration: "2 horas" }), "Vence en 2 horas");
  assert.equal(translate("zh-Hans", "relative.dueIn", { duration: "2小时" }), "2小时后到期");
});

test("Today command-center copy lives in the shared catalog with locale parity", async () => {
  const { readFileSync } = await import("node:fs");
  const todayScreen = readFileSync("app/(tabs)/today.tsx", "utf8");
  assert.match(todayScreen, /function buildTodayCopy\(/);
  assert.doesNotMatch(todayScreen, /const todayCopy:\s*Readonly<Record<AppLocale/);
  assert.match(todayScreen, /t\("today\.commandSubtitle"\)/);
  assert.match(todayScreen, /t\("today\.service\.stockItemsNeedAttention"/);
  assert.match(todayScreen, /t\("inventory\.health\.title"\)/);

  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(
      translate(locale, "today.service.stockItemsNeedAttention", { count: "3" }).includes("3"),
      true
    );
    assert.equal(
      translate(locale, "today.salesMovement.itemsRecorded", { count: "12" }).includes("12"),
      true
    );
    assert.ok(catalogs[locale]["today.tasks.title"].length > 0);
    assert.ok(catalogs[locale]["today.salesMovement.empty"].length > 0);
  }
});

test("number, currency, and date helpers honor locale and restaurant settings", () => {
  assert.equal(formatLocalizedNumber("en", 1234.5), "1,234.5");
  assert.equal(formatLocalizedNumber("es", 1234.5), "1234,5");
  assert.equal(parseLocalizedNumber("es", "1.234,5"), 1234.5);
  assert.equal(parseLocalizedNumber("en", "1,234.5"), 1234.5);
  assert.equal(parseLocalizedNumber("zh-Hans", "12.5"), 12.5);
  assert.equal(parseLocalizedNumber("es", "12,3,4"), null);
  assert.equal(formatLocalizedList("en", ["Monday", "Thursday"]), "Monday and Thursday");
  assert.equal(formatLocalizedList("es", ["lunes", "jueves"]), "lunes y jueves");
  assert.match(formatLocalizedCurrency("en", 12.5, "USD"), /\$12\.50/);
  assert.match(formatLocalizedCurrency("es", 12.5, "EUR"), /12,50\s ?€/);
  assert.equal(formatLocalizedCompactCurrency("en", 7898, "USD"), "$7.9K");
  assert.equal(formatLocalizedCompactCurrency("zh-Hans", 7898, "USD"), "$7.9千");
  assert.equal(
    formatLocalizedDate("en", "2026-07-20T01:00:00.000Z", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York"
    }),
    "Jul 19"
  );
  assert.equal(formatLocalizedDate("en", "not-a-date"), "—");
});

test("relative and operational due-time helpers are deterministic and localized", () => {
  const now = "2026-07-19T12:00:00.000Z";
  assert.equal(formatLocalizedRelativeTime("en", now, { now }), "now");
  assert.equal(formatLocalizedRelativeTime("en", "2026-07-19T14:00:00.000Z", { now }), "in 2 hours");
  assert.equal(formatLocalizedDueTime("en", "2026-07-19T14:00:00.000Z", { now }), "Due in 2 hours");
  assert.equal(formatLocalizedDueTime("es", "2026-07-19T14:00:00.000Z", { now }), "Vence en 2 horas");
  assert.equal(formatLocalizedDueTime("zh-Hans", "2026-07-19T14:00:00.000Z", { now }), "2小时后到期");
  assert.equal(formatLocalizedDueTime("en", "2026-07-19T10:00:00.000Z", { now }), "Overdue by 2 hours");
  assert.equal(
    formatLocalizedDueTime("en", "2026-07-20T13:00:00.000Z", {
      now,
      timeZone: "America/New_York"
    }),
    "Tomorrow"
  );
});
