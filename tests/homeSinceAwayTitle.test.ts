import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { translate } from "../i18n/catalog";

test("home since-away title catalog exists in EN, ES, and zh-Hans", () => {
  assert.equal(translate("en", "home.sinceAway.title"), "Since you were away");
  assert.equal(translate("es", "home.sinceAway.title"), "Desde tu última visita");
  assert.equal(translate("zh-Hans", "home.sinceAway.title"), "离开期间");
});

test("home activity section wires since-away title above the window sentence", () => {
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  assert.match(home, /t\("home\.sinceAway\.title"\)/);
  assert.match(home, /styles\.sinceAwayTitle/);
  assert.match(home, /styles\.sinceAwayBlock/);
  assert.match(home, /presentActivityWindowSentence/);
  assert.match(home, /styles\.windowSentence/);

  const titleIndex = home.indexOf('t("home.sinceAway.title")');
  const sentenceIndex = home.indexOf("styles.windowSentence");
  assert.ok(titleIndex > 0, "expected since-away title binding");
  assert.ok(sentenceIndex > titleIndex, "title chrome must render above the window sentence");
});
