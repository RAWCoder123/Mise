import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeRestaurantMemoryCorrectionDraft,
  canonicalRestaurantMemoryCorrectionDraft,
  normalizeCanonicalRestaurantMemoryCorrectionDraft,
  requireCanonicalRestaurantMemoryCorrectionDraft
} from "../services/domain/restaurantMemoryCorrectionDraftIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantMemoryCorrectionDraftIdentity.ts", import.meta.url),
  "utf8"
);
const uiSource = readFileSync(
  new URL("../app/more/restaurant-memory.tsx", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);

const correction = "Friday dinner runs hot on chicken";
const accentedCorrection = "El viernes la cena pide más pollo";
const multilineCorrection =
  "Friday dinner runs hot on chicken.\nPrep two extra pans.\tConfirm with lead.";

test("MISE-005PN pins restaurant-memory UI correction draft to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005PN/);
  assert.match(uiSource, /MISE-005PN/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRestaurantMemoryCorrectionDraft("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    uiSource,
    /canonicalizeRestaurantMemoryCorrectionDraft\(\s*correctionDrafts\[memory\.id\] \?\? memory\.statement\s*\)/
  );
  assert.match(
    uiSource,
    /from "\.\.\/\.\.\/services\/domain\/restaurantMemoryCorrectionDraftIdentity"/
  );
  assert.doesNotMatch(
    uiSource,
    /\(correctionDrafts\[memory\.id\] \?\? memory\.statement\)\.trim\(\)/
  );

  // Leave domain statement / hydrate correction preference to #830 / MISE-005OV.
  assert.doesNotMatch(identitySource, /restaurantMemoryStatementIdentity/);
  assert.doesNotMatch(identitySource, /function boundedStatement\(/);
  assert.match(domainSource, /function boundedStatement\(/);
  assert.match(domainSource, /row\.correction\?\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /generatedOrderMessageIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsLessonIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
});

test("ASCII C multiline prep keeps ordinary restaurant-memory corrections stable", () => {
  assert.equal(canonicalRestaurantMemoryCorrectionDraft(`  ${correction}  `), correction);
  assert.equal(canonicalRestaurantMemoryCorrectionDraft(`\t${correction}\n`), correction);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(`  ${correction}  `), correction);
  assert.equal(normalizeCanonicalRestaurantMemoryCorrectionDraft(`  ${correction}  `), correction);
  assert.equal(requireCanonicalRestaurantMemoryCorrectionDraft(`  ${correction}  `), correction);

  assert.equal(canonicalRestaurantMemoryCorrectionDraft(accentedCorrection), accentedCorrection);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(accentedCorrection), accentedCorrection);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalRestaurantMemoryCorrectionDraft(multilineCorrection), multilineCorrection);
  assert.equal(
    normalizeCanonicalRestaurantMemoryCorrectionDraft(multilineCorrection),
    multilineCorrection
  );
});

test("NBSP folds and em-space padding cannot invent restaurant-memory corrections", () => {
  const nbspCorrection = `\u00a0${correction}\u00a0`;
  const emCorrection = `\u2003${correction}\u2003`;
  const internalEm = `Friday\u2003dinner runs hot on chicken`;
  const internalNbsp = `Friday\u00a0dinner runs hot on chicken`;
  const emMultiline = `\u2003${multilineCorrection}\u2003`;

  // Pasted NBSP is folded like MISE-005OS / MISE-005PF / MISE-005PE free-text prep.
  assert.equal(nbspCorrection.trim(), correction);
  assert.equal(canonicalRestaurantMemoryCorrectionDraft(nbspCorrection), correction);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(nbspCorrection), correction);
  assert.equal(normalizeCanonicalRestaurantMemoryCorrectionDraft(nbspCorrection), correction);
  assert.equal(
    canonicalRestaurantMemoryCorrectionDraft(internalNbsp),
    "Friday dinner runs hot on chicken"
  );

  // Unicode em-space trim invents a clean correction; C free-text prep does not.
  assert.equal(emCorrection.trim(), correction);
  assert.notEqual(canonicalRestaurantMemoryCorrectionDraft(emCorrection), correction);
  assert.equal(canonicalRestaurantMemoryCorrectionDraft(emCorrection), emCorrection);
  assert.equal(normalizeCanonicalRestaurantMemoryCorrectionDraft(emCorrection), emCorrection);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(emCorrection), emCorrection);
  assert.notEqual(canonicalizeRestaurantMemoryCorrectionDraft(emCorrection), correction);

  assert.equal(canonicalRestaurantMemoryCorrectionDraft(internalEm), internalEm);
  assert.notEqual(
    canonicalRestaurantMemoryCorrectionDraft(internalEm),
    canonicalRestaurantMemoryCorrectionDraft(correction)
  );

  assert.equal(emMultiline.trim(), multilineCorrection);
  assert.notEqual(canonicalRestaurantMemoryCorrectionDraft(emMultiline), multilineCorrection);
  assert.equal(canonicalRestaurantMemoryCorrectionDraft(emMultiline), emMultiline);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalRestaurantMemoryCorrectionDraft("Kelvin correction note"),
    "Kelvin correction note"
  );
  assert.notEqual(
    canonicalRestaurantMemoryCorrectionDraft("Kelvin correction note"),
    canonicalRestaurantMemoryCorrectionDraft("kelvin correction note")
  );
});

test("soft empty and unsafe controls keep restaurant-memory correction contracts", () => {
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(null), null);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(undefined), null);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft(""), null);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft("   "), null);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft("\t\n"), null);
  // Unicode-only space soft-empties like prior `.trim()` without inventing a body.
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft("\u2003\u2003"), null);
  assert.equal(canonicalizeRestaurantMemoryCorrectionDraft("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalRestaurantMemoryCorrectionDraft("\u2003"), null);

  assert.throws(
    () => normalizeCanonicalRestaurantMemoryCorrectionDraft(12 as unknown as string),
    /Restaurant memory correction must be text\./
  );
  assert.throws(
    () => normalizeCanonicalRestaurantMemoryCorrectionDraft("bad\u0000control"),
    /Restaurant memory correction must be text\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryCorrectionDraft(""),
    /Restaurant memory correction must be text\./
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryCorrectionDraft("\u2003"),
    /Restaurant memory correction must be text\./
  );
});
