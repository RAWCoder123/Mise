import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimWasteItemName,
  canonicalizeWasteItemName,
  normalizeWasteItemName
} from "../services/domain/presentationWasteItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationWasteItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const wasteUiSource = readFileSync(
  new URL("../app/more/waste.tsx", import.meta.url),
  "utf8"
);
const dailyReportUiSource = readFileSync(
  new URL("../app/more/daily-report.tsx", import.meta.url),
  "utf8"
);

const itemName = "Roma Tomatoes";
const accentedItemName = "Café Beans";
const FALLBACK = "Inventory item unavailable";

test("MISE-005VJ pins waste / daily-report itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005VJ/);
  assert.match(wasteUiSource, /MISE-005VJ/);
  assert.match(dailyReportUiSource, /MISE-005VJ/);

  assert.match(
    identitySource,
    /export function asciiTrimWasteItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimWasteItemName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    wasteUiSource,
    /normalizeWasteItemName\(event\.itemName\)\s*\|\|\s*t\("waste\.event\.unknownItem"\)/
  );
  assert.match(
    wasteUiSource,
    /normalizeWasteItemName\(item\?\.itemName\)\s*\|\|\s*t\("waste\.event\.unknownItem"\)/
  );
  assert.match(
    dailyReportUiSource,
    /normalizeWasteItemName\(item\?\.itemName\)\s*\|\|\s*t\("waste\.event\.unknownItem"\)/
  );
  assert.doesNotMatch(
    wasteUiSource,
    /event\.itemName \?\? t\("waste\.event\.unknownItem"\)/
  );
  assert.doesNotMatch(
    wasteUiSource,
    /item\?\.itemName \?\? t\("waste\.event\.unknownItem"\)/
  );
  assert.doesNotMatch(
    dailyReportUiSource,
    /item\?\.itemName \?\? t\("waste\.event\.unknownItem"\)/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewHeaderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewBodyIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*homeStatusApprovalTitleIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSetupFallbackLabelIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationGmailSenderEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationOrdersGmailSenderIdentity/);

  // Do not import or rewrite activityEvents hard-coded English or setupDrafts
  // emptiness gates from this presentation tip module.
  assert.doesNotMatch(identitySource, /from ["'].*activityEvents/);
  assert.doesNotMatch(identitySource, /from ["'].*setupDrafts/);
});

test("ASCII C waste itemName prep keeps ordinary display stable", () => {
  assert.equal(asciiTrimWasteItemName(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimWasteItemName(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeWasteItemName(`  ${itemName}  `), itemName);
  assert.equal(normalizeWasteItemName(`  ${itemName}  `), itemName);
  assert.equal(normalizeWasteItemName(accentedItemName), accentedItemName);
});

test("Unicode-only space and empty string bypass waste.event.unknownItem via ?? until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior `??` bypass proofs (weaker than `||`, but still skips unknown-item fallback).
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeWasteItemName(emOnly), null);
  assert.equal(normalizeWasteItemName(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeWasteItemName(nbspOnly), null);
  assert.equal(normalizeWasteItemName(paddedSpaces), null);
  assert.equal(normalizeWasteItemName(empty), null);
  assert.equal(normalizeWasteItemName(null), null);
  assert.equal(normalizeWasteItemName(undefined), null);
  assert.equal(normalizeWasteItemName(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean waste itemName display", () => {
  const emName = `\u2003${itemName}\u2003`;
  const nbspName = `\u00a0${itemName}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emName.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);

  // Name tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimWasteItemName(emName), emName);
  assert.equal(asciiTrimWasteItemName(nbspName), nbspName);

  // Soft-null refuses to invent clean itemName display.
  assert.equal(canonicalizeWasteItemName(emName), null);
  assert.equal(canonicalizeWasteItemName(nbspName), null);
  assert.equal(normalizeWasteItemName(emName), null);
  assert.equal(normalizeWasteItemName(nbspName), null);
  assert.equal(normalizeWasteItemName(emName) || FALLBACK, FALLBACK);
  assert.equal(normalizeWasteItemName(nbspName) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for waste itemName display", () => {
  assert.equal(normalizeWasteItemName(`${itemName}\u0000`), null);
  assert.equal(normalizeWasteItemName(`\u0007${itemName}`), null);
  assert.equal(normalizeWasteItemName(`${itemName}\u007f`), null);
  // Single-line titles reject embedded LF/CR (unlike multiline note/body tips).
  assert.equal(normalizeWasteItemName(`${itemName}\nnext`), null);
  assert.equal(normalizeWasteItemName(`${itemName}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeWasteItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeWasteItemName("Roma Tomatoes"), itemName);
});
