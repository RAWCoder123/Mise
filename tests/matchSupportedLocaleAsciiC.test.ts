import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  matchSupportedLocale,
  resolveSupportedLocale,
  DEFAULT_LOCALE
} from "../i18n/catalog";

const source = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

test("MISE-005KR pins matchSupportedLocale identity to ASCII C", () => {
  assert.match(source, /MISE-005KR/);
  assert.match(
    source,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(
    source,
    /function asciiTrim\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const matchBody = source.slice(source.indexOf("export function matchSupportedLocale"));

  assert.match(matchBody, /asciiTrim\(value\)/);
  assert.match(matchBody, /asciiCLower\(/);
  assert.doesNotMatch(matchBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(matchBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(matchBody, /\.trim\(\)/);
});

test("ASCII C fold keeps ordinary BCP 47 locale matching stable", () => {
  assert.equal(matchSupportedLocale("EN"), "en");
  assert.equal(matchSupportedLocale("en-GB"), "en");
  assert.equal(matchSupportedLocale("ES_MX"), "es");
  assert.equal(matchSupportedLocale("zh-CN"), "zh-Hans");
  assert.equal(matchSupportedLocale("ZH-Hans-SG"), "zh-Hans");
  assert.equal(matchSupportedLocale("zh-Hant-TW"), null);
  assert.equal(matchSupportedLocale("fr-FR"), null);
  assert.equal(resolveSupportedLocale("fr-FR"), DEFAULT_LOCALE);
});

test("ASCII locale trim ignores NBSP; Unicode trim would invent supported locale", () => {
  const nbspPadded = "\u00a0en\u00a0";
  // Unicode trim invents an exact match against the unpadded language tag.
  assert.equal(nbspPadded.trim().toLowerCase(), "en");
  assert.equal(matchSupportedLocale(nbspPadded), null);

  const emSpacePadded = "\u2003es\u2003";
  assert.equal(emSpacePadded.trim().toLowerCase(), "es");
  assert.equal(matchSupportedLocale(emSpacePadded), null);

  const zhPadded = "\u00a0zh-Hans\u00a0";
  assert.equal(zhPadded.trim().toLowerCase(), "zh-hans");
  assert.equal(matchSupportedLocale(zhPadded), null);
});

test("ordinary ASCII whitespace still trims for supported locale matching", () => {
  assert.equal(matchSupportedLocale("  en-US  "), "en");
  assert.equal(matchSupportedLocale("\tes_MX\n"), "es");
  assert.equal(matchSupportedLocale(" zh-CN "), "zh-Hans");
});
