import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeReplaceableDemoLookup,
  normalizeReplaceableDemoSetupKey
} from "../services/demo/replaceableDemoData";

const replaceableSource = readFileSync(
  new URL("../services/demo/replaceableDemoData.ts", import.meta.url),
  "utf8"
);

test("MISE-005JQ pins replaceableDemoData setup-list and lookup normalize to ASCII C case fold", () => {
  assert.match(replaceableSource, /MISE-005JQ/);
  assert.match(
    replaceableSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const setupNormalizeBody = replaceableSource.slice(
    replaceableSource.indexOf("export function normalizeReplaceableDemoSetupKey("),
    replaceableSource.indexOf("export function normalizeReplaceableDemoLookup(")
  );
  assert.match(setupNormalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(setupNormalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(setupNormalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(setupNormalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(setupNormalizeBody, /\\s/);

  const lookupNormalizeBody = replaceableSource.slice(
    replaceableSource.indexOf("export function normalizeReplaceableDemoLookup("),
    replaceableSource.indexOf("function normalizeSetupList(")
  );
  assert.match(lookupNormalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(lookupNormalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(lookupNormalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(lookupNormalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(lookupNormalizeBody, /\\s/);

  const setupListBody = replaceableSource.slice(
    replaceableSource.indexOf("function normalizeSetupList("),
    replaceableSource.indexOf("function findInventoryItemByName(")
  );
  assert.match(setupListBody, /normalizeReplaceableDemoSetupKey\(/);
  assert.match(setupListBody, /asciiCTrim\(value\)/);
  assert.doesNotMatch(setupListBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(setupListBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(setupListBody, /\.trim\(\)/);

  const findBody = replaceableSource.slice(
    replaceableSource.indexOf("function findInventoryItemByName(")
  );
  assert.match(findBody, /normalizeReplaceableDemoLookup\(/);
  assert.doesNotMatch(findBody, /normalizeLookup\(/);
});

test("ASCII C fold keeps ordinary demo setup and lookup keys stable", () => {
  assert.equal(normalizeReplaceableDemoSetupKey("  Bell Peppers  "), "bell peppers");
  assert.equal(normalizeReplaceableDemoSetupKey("BELL PEPPERS"), "bell peppers");
  assert.equal(normalizeReplaceableDemoSetupKey("Sysco"), "sysco");

  assert.equal(normalizeReplaceableDemoLookup("  Romaine Heads  "), "romaine head");
  assert.equal(normalizeReplaceableDemoLookup("Chicken Thighs"), "chicken thighs");
  assert.equal(normalizeReplaceableDemoLookup("12 LBs"), "12 lb");
  assert.equal(normalizeReplaceableDemoLookup("case units"), "case unit");
});

test("ASCII C fold does not invent Kelvin-sign demo setup or lookup identity", () => {
  // Unicode toLowerCase would fold K → k and invent "kelvin peppers" /
  // "kelvin" lookup keys that then survive the ASCII alnum filter.
  assert.equal(normalizeReplaceableDemoSetupKey("Kelvin Peppers"), "Kelvin peppers");
  assert.notEqual(
    normalizeReplaceableDemoSetupKey("Kelvin Peppers"),
    normalizeReplaceableDemoSetupKey("Kelvin Peppers")
  );

  assert.equal(normalizeReplaceableDemoLookup("Kelvin Peppers"), "elvin peppers");
  assert.notEqual(
    normalizeReplaceableDemoLookup("Kelvin Peppers"),
    normalizeReplaceableDemoLookup("Kelvin Peppers")
  );
  assert.equal(normalizeReplaceableDemoLookup("Kelvin Peppers"), "kelvin peppers");

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode `\s` break
  // for setup keys. Lookup strips non-alnum after the fold, so NBSP becomes a
  // space separator without inventing a Kelvin-style case fold.
  assert.equal(
    normalizeReplaceableDemoSetupKey("Bell\u00a0Peppers"),
    "bell\u00a0peppers"
  );
  assert.notEqual(
    normalizeReplaceableDemoSetupKey("Bell\u00a0Peppers"),
    normalizeReplaceableDemoSetupKey("Bell Peppers")
  );
  assert.equal(normalizeReplaceableDemoLookup("Bell\u00a0Peppers"), "bell peppers");
});
