import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  askMiseIntentHaystack,
  classifyAskMiseIntent,
  normalizeAskMiseIntentToken
} from "../services/ai/askMise";

const askMiseSource = readFileSync(new URL("../services/ai/askMise.ts", import.meta.url), "utf8");

test("MISE-005KE pins Ask Mise intent classify to ASCII C case fold", () => {
  assert.match(askMiseSource, /MISE-005KE/);
  assert.match(
    askMiseSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = askMiseSource.slice(
    askMiseSource.indexOf("export function normalizeAskMiseIntentToken("),
    askMiseSource.indexOf("export function askMiseIntentHaystack(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(askMiseSource, /const normalized = askMiseIntentHaystack\(question\);/);
  assert.doesNotMatch(askMiseSource, /question\.trim\(\)\.toLowerCase\(\)/);
  // Spanish ALL-CAPS PREPARACIÓN must still match after ASCII C leaves Ó alone.
  assert.match(askMiseSource, /preparaci\[oóÓ\]n/);
});

test("ASCII C fold keeps ordinary Ask Mise intent classification stable", () => {
  assert.equal(normalizeAskMiseIntentToken("  Stock  "), "stock");
  assert.equal(normalizeAskMiseIntentToken("WASTE"), "waste");
  assert.equal(askMiseIntentHaystack("Which STOCK is low?"), "which stock is low?");

  assert.equal(classifyAskMiseIntent("Which stock is low?"), "stock");
  assert.equal(classifyAskMiseIntent("What orders need review?"), "orders");
  assert.equal(classifyAskMiseIntent("How are sales today?"), "sales");
  assert.equal(classifyAskMiseIntent("What are my top priorities today?"), "priorities");
  assert.equal(classifyAskMiseIntent("Give me a quick briefing"), "briefing");
  assert.equal(classifyAskMiseIntent("What should we prep around?"), "prep");
  assert.equal(classifyAskMiseIntent("Anything overstocked or at waste risk?"), "waste");
  assert.equal(classifyAskMiseIntent("hello there"), "general");

  // Multilingual stems that already ship in the keyword set.
  assert.equal(classifyAskMiseIntent("¿Qué hay en inventario bajo?"), "stock");
  assert.equal(classifyAskMiseIntent("¿Qué preparación necesitamos?"), "prep");
  assert.equal(classifyAskMiseIntent("PREPARACIÓN de línea"), "prep");
  assert.equal(classifyAskMiseIntent("今天库存短缺吗？"), "stock");
  assert.equal(classifyAskMiseIntent("备餐建议"), "prep");
  assert.equal(classifyAskMiseIntent("损耗风险"), "waste");
});

test("ASCII C fold does not invent Kelvin-sign Ask Mise intent identity", () => {
  // Unicode toLowerCase would fold K → k and invent "stock".
  assert.equal(normalizeAskMiseIntentToken("stocK"), "stocK");
  assert.notEqual(normalizeAskMiseIntentToken("stocK"), normalizeAskMiseIntentToken("stock"));
  assert.equal("stocK".toLowerCase(), "stock");

  // NBSP-only padding is outside ASCII whitespace; do not treat it as a trim break.
  assert.equal(normalizeAskMiseIntentToken("\u00a0stock\u00a0"), "\u00a0stock\u00a0");
  assert.notEqual(
    normalizeAskMiseIntentToken("\u00a0stock\u00a0"),
    normalizeAskMiseIntentToken("stock")
  );

  // Avoid ASCII stock/waste/prep/order/priority/briefing keyword stems in
  // fixture copy so only Kelvin fold could invent an operational intent.
  assert.equal(classifyAskMiseIntent("Is stocK healthy?"), "general");
  assert.equal(classifyAskMiseIntent("Any bacKlog here?"), "general");
  assert.equal(classifyAskMiseIntent("Kelvin demand question"), "general");
});
