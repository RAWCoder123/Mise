import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeSupplierOperatorNote,
  canonicalSupplierOperatorNote,
  normalizeCanonicalSupplierOperatorNote,
  requireCanonicalSupplierOperatorNote
} from "../services/domain/supplierOperatorNoteIdentity";
import { requireSupplierOperatorNote } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/supplierOperatorNoteIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);
const demoSource = readFileSync(
  new URL("../services/repositories/demoRepository.ts", import.meta.url),
  "utf8"
);

const note = "Call on arrival";
const accentedNote = "Llamar al llegar";
const multilineNote = "Call on arrival.\nUse the side entrance.\tCase count attached.";

test("MISE-005PF pins supplier operator_note free-text to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005PF/);
  assert.match(validationSource, /MISE-005PF/);
  assert.match(ordersUiSource, /MISE-005PF/);
  assert.match(demoSource, /MISE-005PF/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalSupplierOperatorNote("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    validationSource,
    /normalizeCanonicalSupplierOperatorNote\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/supplierOperatorNoteIdentity"/
  );
  assert.doesNotMatch(
    validationSource.slice(
      validationSource.indexOf("export function requireSupplierOperatorNote("),
      validationSource.indexOf(
        "export function requireSupplierOperatorNote("
      ) + 500
    ),
    /value\.trim\(\)/
  );

  assert.match(ordersUiSource, /canonicalizeSupplierOperatorNote\(operatorNote\)/);
  assert.match(ordersUiSource, /operator_note: operatorNote/);
  assert.doesNotMatch(ordersUiSource, /operator_note: operatorNote\.trim\(\) \|\| null/);

  assert.match(demoSource, /canonicalizeSupplierOperatorNote\(patch\.operator_note\)/);
  assert.doesNotMatch(demoSource, /patch\.operator_note\?\.trim\(\) \|\| null/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisNoteIdentity/);
  assert.doesNotMatch(identitySource, /deliveryHistoryNoteIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(validationSource, /requireInventoryCountLineNote[\s\S]{0,200}normalizeCanonicalSupplierOperatorNote/);
});

test("ASCII C multiline prep keeps ordinary supplier operator notes stable", () => {
  assert.equal(canonicalSupplierOperatorNote(`  ${note}  `), note);
  assert.equal(canonicalSupplierOperatorNote(`\t${note}\n`), note);
  assert.equal(canonicalizeSupplierOperatorNote(`  ${note}  `), note);
  assert.equal(normalizeCanonicalSupplierOperatorNote(`  ${note}  `), note);
  assert.equal(requireCanonicalSupplierOperatorNote(`  ${note}  `), note);
  assert.equal(requireSupplierOperatorNote(`  ${note}  `), note);

  assert.equal(canonicalSupplierOperatorNote(accentedNote), accentedNote);
  assert.equal(canonicalizeSupplierOperatorNote(accentedNote), accentedNote);
  assert.equal(requireSupplierOperatorNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalSupplierOperatorNote(multilineNote), multilineNote);
  assert.equal(normalizeCanonicalSupplierOperatorNote(multilineNote), multilineNote);
  assert.equal(requireSupplierOperatorNote(multilineNote), multilineNote);
});

test("NBSP folds and em-space padding cannot invent supplier operator notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Call\u2003on arrival`;
  const internalNbsp = `Call\u00a0on arrival`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP is folded like MISE-005OS / MISE-005OT / MISE-005PE free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalSupplierOperatorNote(nbspNote), note);
  assert.equal(canonicalizeSupplierOperatorNote(nbspNote), note);
  assert.equal(normalizeCanonicalSupplierOperatorNote(nbspNote), note);
  assert.equal(requireSupplierOperatorNote(nbspNote), note);
  assert.equal(canonicalSupplierOperatorNote(internalNbsp), "Call on arrival");

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalSupplierOperatorNote(emNote), note);
  assert.equal(canonicalSupplierOperatorNote(emNote), emNote);
  assert.equal(normalizeCanonicalSupplierOperatorNote(emNote), emNote);
  assert.equal(requireSupplierOperatorNote(emNote), emNote);
  assert.notEqual(requireSupplierOperatorNote(emNote), note);

  assert.equal(canonicalSupplierOperatorNote(internalEm), internalEm);
  assert.notEqual(
    canonicalSupplierOperatorNote(internalEm),
    canonicalSupplierOperatorNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalSupplierOperatorNote(emMultiline), multilineNote);
  assert.equal(canonicalSupplierOperatorNote(emMultiline), emMultiline);
  assert.equal(requireSupplierOperatorNote(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalSupplierOperatorNote("Kelvin delivery note"),
    "Kelvin delivery note"
  );
  assert.notEqual(
    canonicalSupplierOperatorNote("Kelvin delivery note"),
    canonicalSupplierOperatorNote("Kelvin delivery note")
  );
});

test("supplier operator notes soft-empty to null; unsafe control/over-long fail closed", () => {
  assert.equal(canonicalizeSupplierOperatorNote(null), null);
  assert.equal(canonicalizeSupplierOperatorNote(undefined), null);
  assert.equal(canonicalizeSupplierOperatorNote(""), null);
  assert.equal(canonicalizeSupplierOperatorNote("   "), null);
  assert.equal(canonicalizeSupplierOperatorNote("\u00a0\u00a0"), null);
  assert.equal(canonicalizeSupplierOperatorNote("\u2003"), null);
  assert.equal(canonicalizeSupplierOperatorNote("\n\t\r"), null);

  assert.equal(requireSupplierOperatorNote(null), null);
  assert.equal(requireSupplierOperatorNote(undefined), null);
  assert.equal(requireSupplierOperatorNote(""), null);
  assert.equal(requireSupplierOperatorNote("   "), null);
  assert.equal(requireSupplierOperatorNote("\u2003"), null);

  assert.throws(
    () => normalizeCanonicalSupplierOperatorNote(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.throws(
    () => requireSupplierOperatorNote(123 as unknown as string),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierOperatorNote("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierOperatorNote("Bad\u000bNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierOperatorNote("Bad\u000cNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierOperatorNote("Bad\u007fNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.equal(
    normalizeCanonicalSupplierOperatorNote("Call\ton arrival\nside entrance."),
    "Call\ton arrival\nside entrance."
  );

  assert.equal(requireSupplierOperatorNote("x".repeat(2000))?.length, 2000);
  assert.throws(
    () => normalizeCanonicalSupplierOperatorNote("x".repeat(2001)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier note is limited to 2,000 characters."
  );
  assert.throws(
    () => requireSupplierOperatorNote("x".repeat(2001)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier note is limited to 2,000 characters."
  );

  assert.throws(
    () => requireCanonicalSupplierOperatorNote(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
  assert.throws(
    () => requireCanonicalSupplierOperatorNote("\u2003"),
    (error: unknown) =>
      error instanceof Error && error.message === "Supplier note must be text."
  );
});
