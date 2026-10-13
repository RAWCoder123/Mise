import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeInventoryCountSessionNote,
  canonicalInventoryCountSessionNote,
  normalizeCanonicalInventoryCountSessionNote,
  requireCanonicalInventoryCountSessionNote
} from "../services/domain/inventoryCountSessionNoteIdentity";
import { requireInventoryCountSessionNote } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountSessionNoteIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const note = "Count before lunch rush";
const multilineNote = "Count before lunch rush.\nWalk-in first.\nPhoto attached.";
const accentedNote = "Conteo antes del almuerzo.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PK pins inventory count-session opening notes to ASCII C", () => {
  assert.match(identitySource, /MISE-005PK/);
  assert.match(validationSource, /MISE-005PK/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalInventoryCountSessionNote("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.doesNotMatch(canonicalBody, /\.replace\(C_WHITESPACE/);

  assert.match(
    validationSource,
    /normalizeCanonicalInventoryCountSessionNote\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/inventoryCountSessionNoteIdentity"/
  );

  const sessionRequireBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryCountSessionNote("),
    validationSource.indexOf("export function requireInventoryCountLineNote(")
  );
  assert.doesNotMatch(sessionRequireBody, /value\.trim\(\)/);
  assert.match(sessionRequireBody, /normalizeCanonicalInventoryCountSessionNote/);

  // Application begin path still routes through the require helper.
  assert.match(applicationSource, /requireInventoryCountSessionNote\(note\)/);

  // Leave sibling miseValidation count-line note helper on Unicode trim.
  const lineRequireBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryCountLineNote("),
    validationSource.indexOf("export function requireInventoryCountLineUpdates(")
  );
  assert.match(lineRequireBody, /value\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryCountSessions"/);
});

test("ASCII C multiline prep keeps ordinary inventory count-session notes stable", () => {
  assert.equal(canonicalInventoryCountSessionNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryCountSessionNote(`\t${note}\n`), note);
  assert.equal(normalizeCanonicalInventoryCountSessionNote(`  ${note}  `), note);
  assert.equal(requireInventoryCountSessionNote(`  ${note}  `), note);
  assert.equal(canonicalizeInventoryCountSessionNote(`  ${note}  `), note);

  assert.equal(canonicalInventoryCountSessionNote(accentedNote), accentedNote);
  assert.equal(requireInventoryCountSessionNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalInventoryCountSessionNote(multilineNote), multilineNote);
  assert.equal(normalizeCanonicalInventoryCountSessionNote(multilineNote), multilineNote);
  assert.equal(requireInventoryCountSessionNote(multilineNote), multilineNote);
});

test("NBSP folds and em-space padding cannot invent inventory count-session notes", () => {
  const nbspNote = `${nbsp}${note}${nbsp}`;
  const emNote = `${em}${note}${em}`;
  const internalEm = `Count${em}before lunch rush`;
  const internalNbsp = `Count${nbsp}before lunch rush`;
  const emMultiline = `${em}${multilineNote}${em}`;

  // Inventing proof: Unicode trim would invent the clean session note.
  assert.equal(emNote.trim(), note);
  assert.equal(nbspNote.trim(), note);

  // Pasted NBSP is folded like MISE-005B / #827 / #840 free-text prep.
  assert.equal(canonicalInventoryCountSessionNote(nbspNote), note);
  assert.equal(normalizeCanonicalInventoryCountSessionNote(nbspNote), note);
  assert.equal(requireInventoryCountSessionNote(nbspNote), note);
  assert.equal(canonicalInventoryCountSessionNote(internalNbsp), "Count before lunch rush");

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.notEqual(canonicalInventoryCountSessionNote(emNote), note);
  assert.equal(canonicalInventoryCountSessionNote(emNote), emNote);
  assert.equal(normalizeCanonicalInventoryCountSessionNote(emNote), emNote);
  assert.equal(requireInventoryCountSessionNote(emNote), emNote);
  assert.equal(canonicalizeInventoryCountSessionNote(emNote), emNote);

  assert.equal(canonicalInventoryCountSessionNote(internalEm), internalEm);
  assert.notEqual(
    canonicalInventoryCountSessionNote(internalEm),
    canonicalInventoryCountSessionNote(note)
  );

  assert.equal(canonicalInventoryCountSessionNote(emMultiline), emMultiline);
  assert.equal(requireInventoryCountSessionNote(emMultiline), emMultiline);
});

test("soft empty session note stays null; unsafe control / over-long fail closed", () => {
  assert.equal(canonicalizeInventoryCountSessionNote(undefined), null);
  assert.equal(canonicalizeInventoryCountSessionNote(""), null);
  assert.equal(canonicalizeInventoryCountSessionNote("   "), null);
  assert.equal(canonicalizeInventoryCountSessionNote(`${em}${em}`), null);
  assert.equal(canonicalizeInventoryCountSessionNote(`${nbsp}`), null);

  assert.equal(normalizeCanonicalInventoryCountSessionNote(undefined), null);
  assert.equal(normalizeCanonicalInventoryCountSessionNote(""), null);
  assert.equal(normalizeCanonicalInventoryCountSessionNote("   "), null);
  assert.equal(normalizeCanonicalInventoryCountSessionNote(`${em}${em}`), null);
  assert.equal(requireInventoryCountSessionNote(null), null);
  assert.equal(requireInventoryCountSessionNote(undefined), null);
  assert.equal(requireInventoryCountSessionNote("   "), null);
  assert.equal(requireInventoryCountSessionNote(`${em}${em}`), null);

  assert.throws(
    () => normalizeCanonicalInventoryCountSessionNote(123),
    /Count session note must be text\./
  );
  assert.throws(
    () => requireInventoryCountSessionNote(123 as unknown as string),
    /Count session note must be text\./
  );
  assert.throws(
    () => requireCanonicalInventoryCountSessionNote(""),
    /Count session note must be text\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryCountSessionNote(`\u0001${note}`),
    /Count session note must be text\./
  );
  assert.throws(
    () => requireInventoryCountSessionNote(`\u0007${note}`),
    /Count session note must be text\./
  );

  const overLong = "a".repeat(241);
  assert.throws(
    () => requireInventoryCountSessionNote(overLong),
    /Count session note is limited to 240 characters\./
  );
  assert.equal(requireInventoryCountSessionNote("a".repeat(240)), "a".repeat(240));
});
