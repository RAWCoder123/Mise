import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepOrdersDetailNoteNone,
  canonicalizeOrdersDetailNoteNone,
  normalizeOrdersDetailNoteNone
} from "../services/domain/ordersDetailNoteNoneIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersDetailNoteNoneIdentity.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const note = "Call on arrival";
const accentedNote = "Llamar al llegar";
const multilineNote = "Call on arrival.\nUse the side entrance.\tCase count attached.";
const FALLBACK = "No note";

test("MISE-005VE pins Orders detail note.none display to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005VE/);
  assert.match(ordersUiSource, /MISE-005VE/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepOrdersDetailNoteNone("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    ordersUiSource,
    /normalizeOrdersDetailNoteNone\(visibleOrder\.operator_note\)\s*\|\|\s*t\("orders\.detail\.note\.none"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleOrder\.operator_note \|\| t\("orders\.detail\.note\.none"\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["'].*supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*deliveryEvidenceDate/);
  assert.doesNotMatch(identitySource, /from ["'].*deliveryHistoryNoteIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSetupFallbackLabelIdentity/);
  assert.doesNotMatch(ordersUiSource, /normalizeOrdersDetailNoteNone\(visibleEmailPayload/);
  assert.doesNotMatch(
    ordersUiSource,
    /from ["'].*supplierOperatorNoteIdentity/
  );
});

test("ASCII C multiline prep keeps ordinary sent notes stable", () => {
  assert.equal(asciiPrepOrdersDetailNoteNone(`  ${note}  `), note);
  assert.equal(asciiPrepOrdersDetailNoteNone(`\t${note}\n`), note);
  assert.equal(canonicalizeOrdersDetailNoteNone(`  ${note}  `), note);
  assert.equal(normalizeOrdersDetailNoteNone(`  ${note}  `), note);

  assert.equal(asciiPrepOrdersDetailNoteNone(accentedNote), accentedNote);
  assert.equal(normalizeOrdersDetailNoteNone(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepOrdersDetailNoteNone(multilineNote), multilineNote);
  assert.equal(normalizeOrdersDetailNoteNone(multilineNote), multilineNote);
});

test("Unicode-only space bypasses note.none until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";

  assert.equal(Boolean(emOnly), true);
  assert.equal(emOnly || FALLBACK, emOnly);
  assert.notEqual(emOnly || FALLBACK, FALLBACK);

  assert.equal(normalizeOrdersDetailNoteNone(emOnly), null);
  assert.equal(normalizeOrdersDetailNoteNone(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailNoteNone(nbspOnly), null);
  assert.equal(normalizeOrdersDetailNoteNone(paddedSpaces), null);
  assert.equal(normalizeOrdersDetailNoteNone(null), null);
  assert.equal(normalizeOrdersDetailNoteNone(undefined), null);
  assert.equal(normalizeOrdersDetailNoteNone(""), null);
});

test("NBSP folds and em-space padding cannot invent clean sent-note display", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Call\u2003on arrival`;
  const internalNbsp = `Call\u00a0on arrival`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(asciiPrepOrdersDetailNoteNone(nbspNote), note);
  assert.equal(normalizeOrdersDetailNoteNone(nbspNote), note);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emNote.trim(), note);
  assert.notEqual(asciiPrepOrdersDetailNoteNone(emNote), note);
  assert.equal(normalizeOrdersDetailNoteNone(emNote), null);
  assert.equal(normalizeOrdersDetailNoteNone(emNote) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailNoteNone(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeOrdersDetailNoteNone(internalEm), internalEm);
  assert.equal(normalizeOrdersDetailNoteNone(internalNbsp), "Call on arrival");
});

test("Unsafe multiline controls soft-null for note.none display", () => {
  assert.equal(normalizeOrdersDetailNoteNone(`${note}\u0000`), null);
  assert.equal(normalizeOrdersDetailNoteNone(`${note}\u0007`), null);
  assert.equal(normalizeOrdersDetailNoteNone(`${note}\u007f`), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeOrdersDetailNoteNone("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});
