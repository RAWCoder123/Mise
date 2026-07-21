import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { syncDocumentLanguage } from "../i18n/documentLanguage";

test("web document language follows every supported operator locale", () => {
  const runtime = { document: { documentElement: { lang: "en" } } };

  assert.equal(syncDocumentLanguage("es", "web", runtime), true);
  assert.equal(runtime.document.documentElement.lang, "es");

  assert.equal(syncDocumentLanguage("zh-Hans", "web", runtime), true);
  assert.equal(runtime.document.documentElement.lang, "zh-Hans");

  assert.equal(syncDocumentLanguage("en", "web", runtime), true);
  assert.equal(runtime.document.documentElement.lang, "en");
});

test("document language synchronization is inert on native and safe without a DOM", () => {
  const nativeRuntime = { document: { documentElement: { lang: "en" } } };

  assert.equal(syncDocumentLanguage("es", "ios", nativeRuntime), false);
  assert.equal(nativeRuntime.document.documentElement.lang, "en");
  assert.equal(syncDocumentLanguage("zh-Hans", "android", nativeRuntime), false);
  assert.equal(syncDocumentLanguage("es", "web", {}), false);
  assert.equal(syncDocumentLanguage("es", "web", null), false);
});

test("LocaleProvider synchronizes the active locale through the platform-gated bridge", () => {
  const provider = readFileSync("contexts/LocaleContext.tsx", "utf8");

  assert.match(provider, /syncDocumentLanguage\(locale, Platform\.OS\)/);
  assert.match(provider, /useEffect\(\(\) => \{\s*syncDocumentLanguage\(locale, Platform\.OS\);\s*\}, \[locale\]\)/);
});
