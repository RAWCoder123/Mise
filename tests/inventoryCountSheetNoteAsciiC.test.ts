import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalInventoryCountSheetNote,
  normalizeInventoryCountSheetNote
} from "../services/domain/inventoryCountSheetNoteIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountSheetNoteIdentity.ts", import.meta.url),
  "utf8"
);
const countSheetSource = readFileSync(
  new URL("../app/inventory/count.tsx", import.meta.url),
  "utf8"
);
const countSessionsSource = readFileSync(
  new URL("../services/domain/inventoryCountSessions.ts", import.meta.url),
  "utf8"
);
const miseValidationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const note = "Spill during prep";
const accentedNote = "Producto dañado en recepción";
const multilineNote = "Spill during prep.\nPhoto attached.\tKeep cold.";

test("MISE-005QY pins inventory count-sheet notes to ASCII C", () => {
  assert.match(identitySource, /MISE-005QY/);
  assert.match(countSheetSource, /MISE-005QY/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalInventoryCountSheetNote\(value: string\) \{/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalInventoryCountSheetNote"),
    identitySource.indexOf("function hasUnsafeMultilineControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    countSheetSource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryCountSheetNoteIdentity"/
  );
  assert.match(countSheetSource, /normalizeInventoryCountSheetNote\(noteRaw\)/);

  const payloadBody = countSheetSource.slice(
    countSheetSource.indexOf("function buildCountLinePayload("),
    countSheetSource.indexOf("async function saveProgress()")
  );
  assert.doesNotMatch(payloadBody, /noteRaw\.trim\(\)/);
  assert.doesNotMatch(payloadBody, /note: noteRaw\.trim\(\)/);
  // Quantity draft trim and presentation show-note gates stay on Unicode trim.
  assert.match(payloadBody, /draftCounts\[line\.inventory_item_id\]\?\.trim\(\)/);
  assert.match(countSheetSource, /noteRaw\.trim\(\)\.length > 0/);

  // Open #827 owns domain count-line note ASCII C; leave merge/plan Unicode trim alone.
  assert.match(
    countSessionsSource,
    /typeof line\.note === "string" && line\.note\.trim\(\) \? line\.note\.trim\(\) : null/
  );
  assert.match(countSessionsSource, /const normalized = update\.note\.trim\(\);/);

  // Open #846 owns miseValidation count-line note ASCII C; leave helper alone.
  const requireLineNoteBody = miseValidationSource.slice(
    miseValidationSource.indexOf("export function requireInventoryCountLineNote"),
    miseValidationSource.indexOf("export function requireInventoryCountLineUpdates")
  );
  assert.match(requireLineNoteBody, /const normalized = value\.trim\(\);/);

  // Do not rewrite sibling free-text or count tips through this module.
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountSessionNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /taskCompletionEvidenceNoteIdentity/);
  assert.doesNotMatch(identitySource, /dailyBriefRecommendedActionEditIdentity/);
  assert.doesNotMatch(countSheetSource, /normalizeCanonicalInventoryCountLineNote/);
  assert.doesNotMatch(countSheetSource, /normalizeCanonicalInventoryOperationNote/);
});

test("ASCII trim keeps ordinary inventory count-sheet notes stable", () => {
  assert.equal(canonicalInventoryCountSheetNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryCountSheetNote(`\t${note}\n`), note);
  assert.equal(normalizeInventoryCountSheetNote(`  ${note}  `), note);

  assert.equal(canonicalInventoryCountSheetNote(accentedNote), accentedNote);
  assert.equal(normalizeInventoryCountSheetNote(accentedNote), accentedNote);

  assert.equal(canonicalInventoryCountSheetNote(multilineNote), multilineNote);
  assert.equal(normalizeInventoryCountSheetNote(multilineNote), multilineNote);
});

test("NBSP folds and em-space padding cannot invent inventory count-sheet notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Spill\u2003during prep`;
  const internalNbsp = `Spill\u00a0during prep`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalInventoryCountSheetNote(nbspNote), note);
  assert.equal(normalizeInventoryCountSheetNote(nbspNote), note);
  assert.equal(canonicalInventoryCountSheetNote(internalNbsp), "Spill during prep");

  // Unicode em-space trim invents a clean variance note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalInventoryCountSheetNote(emNote), note);
  assert.equal(canonicalInventoryCountSheetNote(emNote), emNote);
  assert.equal(normalizeInventoryCountSheetNote(emNote), emNote);
  assert.notEqual(normalizeInventoryCountSheetNote(emNote), note);

  assert.equal(canonicalInventoryCountSheetNote(internalEm), internalEm);
  assert.notEqual(
    canonicalInventoryCountSheetNote(internalEm),
    canonicalInventoryCountSheetNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalInventoryCountSheetNote(emMultiline), multilineNote);
  assert.equal(canonicalInventoryCountSheetNote(emMultiline), emMultiline);
  assert.equal(normalizeInventoryCountSheetNote(emMultiline), emMultiline);

  assert.equal(
    canonicalInventoryCountSheetNote("Kelvin variance note"),
    "Kelvin variance note"
  );
});

test("Soft empty and unsafe controls omit inventory count-sheet notes without inventing", () => {
  assert.equal(normalizeInventoryCountSheetNote(null), null);
  assert.equal(normalizeInventoryCountSheetNote(undefined), null);
  assert.equal(normalizeInventoryCountSheetNote(""), null);
  assert.equal(normalizeInventoryCountSheetNote("   "), null);
  assert.equal(normalizeInventoryCountSheetNote("\t\n"), null);
  assert.equal(normalizeInventoryCountSheetNote("\u2003"), null);
  assert.equal(normalizeInventoryCountSheetNote("\u00a0"), null);
  assert.equal(normalizeInventoryCountSheetNote("\u2003\u00a0\u2003"), null);

  assert.equal(normalizeInventoryCountSheetNote(`\u0000${note}`), null);
  assert.equal(normalizeInventoryCountSheetNote(`${note}\u0007`), null);
  assert.equal(normalizeInventoryCountSheetNote(`${note}\u007f`), null);

  // LF/TAB/CR remain allowed inside count-sheet variance prose.
  assert.equal(
    normalizeInventoryCountSheetNote("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );

  // Over-long stays a caller-owned throw against prepared length, not Unicode trim.
  const overLong = `${"a".repeat(241)}`;
  assert.equal(normalizeInventoryCountSheetNote(overLong)?.length, 241);
  const emPaddedShort = `\u2003${"a".repeat(240)}\u2003`;
  assert.equal(emPaddedShort.trim().length, 240);
  assert.equal(normalizeInventoryCountSheetNote(emPaddedShort)?.length, 242);
});
