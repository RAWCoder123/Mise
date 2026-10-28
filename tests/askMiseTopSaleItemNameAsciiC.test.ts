import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAskMiseTopSaleItemName,
  canonicalizeAskMiseTopSaleItemName,
  normalizeAskMiseTopSaleItemName
} from "../services/domain/askMiseTopSaleItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/askMiseTopSaleItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseSource = readFileSync(
  new URL("../services/ai/askMise.ts", import.meta.url),
  "utf8"
);

const itemName = "Chicken Bowl";
const accentedName = "Café Latte";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SY pins Ask Mise sales top-sale item names to ASCII C", () => {
  assert.match(identitySource, /MISE-005SY/);
  assert.match(askMiseSource, /MISE-005SY/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseTopSaleItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseSource,
    /from "\.\.\/domain\/askMiseTopSaleItemNameIdentity"/
  );
  assert.match(
    askMiseSource,
    /normalizeAskMiseTopSaleItemName\(/
  );
  assert.match(
    askMiseSource,
    /normalizeAskMiseTopSaleItemName\(summary\.topItems\[0\]\?\.item_name\)/
  );
  assert.doesNotMatch(
    askMiseSource,
    /topItems\[0\]\?\.item_name\?\.trim\(\)/
  );

  // Leave Ask Mise intent classify on its existing Unicode trim contract
  // (owned by open #700 / #879 question identity paths).
  assert.match(
    askMiseSource,
    /const normalized = question\.trim\(\)\.toLowerCase\(\);/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /askMiseQuestionIdentity/);
  assert.doesNotMatch(identityCode, /pilotReadinessSaleItemIdentity/);
  assert.doesNotMatch(identityCode, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(identityCode, /operationalFindingsUnmappedMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Ask Mise top-sale item names stable", () => {
  assert.equal(asciiTrimAskMiseTopSaleItemName(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimAskMiseTopSaleItemName(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeAskMiseTopSaleItemName(`  ${itemName}  `), itemName);
  assert.equal(normalizeAskMiseTopSaleItemName(`  ${itemName}  `), itemName);

  assert.equal(normalizeAskMiseTopSaleItemName(accentedName), accentedName);
  assert.equal(canonicalizeAskMiseTopSaleItemName(accentedName), accentedName);
});

test("Unicode em-space / NBSP padding cannot invent clean Ask Mise top-sale item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Chicken${em}Bowl`;
  const internalNbsp = `Chicken${nbsp}Bowl`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimAskMiseTopSaleItemName(padded), padded);
  assert.equal(canonicalizeAskMiseTopSaleItemName(padded), null);
  assert.equal(canonicalizeAskMiseTopSaleItemName(nbspName), null);
  assert.equal(normalizeAskMiseTopSaleItemName(padded), null);
  assert.equal(normalizeAskMiseTopSaleItemName(nbspName), null);

  // Soft empty still fails closed without inventing a top-sale label from padding alone.
  assert.equal(normalizeAskMiseTopSaleItemName(`${em}${em}`), null);
  assert.equal(normalizeAskMiseTopSaleItemName(`${nbsp}`), null);
  assert.equal(normalizeAskMiseTopSaleItemName("   "), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeAskMiseTopSaleItemName(internalEm), internalEm);
  assert.equal(normalizeAskMiseTopSaleItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeAskMiseTopSaleItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Ask Mise top-sale item names", () => {
  assert.equal(normalizeAskMiseTopSaleItemName(undefined), null);
  assert.equal(normalizeAskMiseTopSaleItemName(null), null);
  assert.equal(normalizeAskMiseTopSaleItemName(""), null);
  assert.equal(normalizeAskMiseTopSaleItemName("   "), null);
  assert.equal(normalizeAskMiseTopSaleItemName(123 as unknown as string), null);
  assert.equal(normalizeAskMiseTopSaleItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeAskMiseTopSaleItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeAskMiseTopSaleItemName(`${itemName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeAskMiseTopSaleItemName(em), null);
});
