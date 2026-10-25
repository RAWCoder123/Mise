import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeInventoryOperationNote,
  canonicalInventoryOperationNote,
  normalizeCanonicalInventoryOperationNote,
  requireCanonicalInventoryOperationNote
} from "../services/domain/inventoryOperationNoteIdentity";
import { requireInventoryOperation } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOperationNoteIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const inventoryUiSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const securityLimitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);

const note = "Chilled on arrival";
const accentedNote = "Producto dañado";
const multilineNote = "Chilled on arrival.\nKeep on ice.\tCase count attached.";

test("MISE-005PT pins inventory-operation notes to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005PT/);
  assert.match(validationSource, /MISE-005PT/);
  assert.match(inventoryUiSource, /MISE-005PT/);
  assert.match(securityLimitsSource, /INVENTORY_OPERATION_NOTE_MAX_CHARACTERS = 500/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalInventoryOperationNote("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    validationSource,
    /normalizeCanonicalInventoryOperationNote\(input\.note\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/inventoryOperationNoteIdentity"/
  );

  const requireInventoryOperationBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryOperation("),
    validationSource.indexOf("function requireOperatorInventoryEventType(")
  );
  assert.doesNotMatch(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.note/
  );
  // Sibling optionalBoundedText paths stay on Unicode trim in this tip.
  assert.match(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.sourceReference, "reference", 200\)/
  );
  assert.match(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.reasonCode, "reason", 80\)/
  );

  assert.match(
    inventoryUiSource,
    /canonicalizeInventoryOperationNote\(noteText\)/
  );
  assert.doesNotMatch(inventoryUiSource, /note: noteText\.trim\(\) \|\| undefined/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountSessionNoteIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisNoteIdentity/);
  assert.doesNotMatch(
    validationSource,
    /requireInventoryCountLineNote[\s\S]{0,200}normalizeCanonicalInventoryOperationNote/
  );
});

test("ASCII C multiline prep keeps ordinary inventory-operation notes stable", () => {
  assert.equal(canonicalInventoryOperationNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryOperationNote(`\t${note}\n`), note);
  assert.equal(canonicalizeInventoryOperationNote(`  ${note}  `), note);
  assert.equal(normalizeCanonicalInventoryOperationNote(`  ${note}  `), note);
  assert.equal(requireCanonicalInventoryOperationNote(`  ${note}  `), note);

  assert.equal(canonicalInventoryOperationNote(accentedNote), accentedNote);
  assert.equal(canonicalizeInventoryOperationNote(accentedNote), accentedNote);
  assert.equal(normalizeCanonicalInventoryOperationNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalInventoryOperationNote(multilineNote), multilineNote);
  assert.equal(normalizeCanonicalInventoryOperationNote(multilineNote), multilineNote);

  assert.deepEqual(
    requireInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "receipt",
      quantity: 1250,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      note: `  ${note}  `
    }).metadata,
    { note }
  );
});

test("NBSP folds and em-space padding cannot invent inventory-operation notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Chilled\u2003on arrival`;
  const internalNbsp = `Chilled\u00a0on arrival`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP is folded like MISE-005PF / MISE-005OS free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalInventoryOperationNote(nbspNote), note);
  assert.equal(canonicalizeInventoryOperationNote(nbspNote), note);
  assert.equal(normalizeCanonicalInventoryOperationNote(nbspNote), note);
  assert.equal(canonicalInventoryOperationNote(internalNbsp), "Chilled on arrival");

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalInventoryOperationNote(emNote), note);
  assert.equal(canonicalInventoryOperationNote(emNote), emNote);
  assert.equal(normalizeCanonicalInventoryOperationNote(emNote), emNote);
  assert.notEqual(normalizeCanonicalInventoryOperationNote(emNote), note);

  assert.deepEqual(
    requireInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "waste",
      quantity: 100,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      note: emNote
    }).metadata,
    { note: emNote }
  );
  assert.notDeepEqual(
    requireInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "waste",
      quantity: 100,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      note: emNote
    }).metadata,
    { note }
  );

  assert.equal(canonicalInventoryOperationNote(internalEm), internalEm);
  assert.notEqual(
    canonicalInventoryOperationNote(internalEm),
    canonicalInventoryOperationNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalInventoryOperationNote(emMultiline), multilineNote);
  assert.equal(canonicalInventoryOperationNote(emMultiline), emMultiline);
  assert.equal(normalizeCanonicalInventoryOperationNote(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalInventoryOperationNote("Kelvin waste note"),
    "Kelvin waste note"
  );
  assert.notEqual(
    canonicalInventoryOperationNote("Kelvin waste note"),
    canonicalInventoryOperationNote("Kelvin waste note")
  );
});

test("inventory-operation notes soft-empty to null; unsafe control/over-long fail closed", () => {
  assert.equal(canonicalizeInventoryOperationNote(null), null);
  assert.equal(canonicalizeInventoryOperationNote(undefined), null);
  assert.equal(canonicalizeInventoryOperationNote(""), null);
  assert.equal(canonicalizeInventoryOperationNote("   "), null);
  assert.equal(canonicalizeInventoryOperationNote("\u00a0\u00a0"), null);
  assert.equal(canonicalizeInventoryOperationNote("\u2003"), null);
  assert.equal(canonicalizeInventoryOperationNote("\n\t\r"), null);

  assert.equal(normalizeCanonicalInventoryOperationNote(null), null);
  assert.equal(normalizeCanonicalInventoryOperationNote(undefined), null);
  assert.equal(normalizeCanonicalInventoryOperationNote(""), null);
  assert.equal(normalizeCanonicalInventoryOperationNote("   "), null);
  assert.equal(normalizeCanonicalInventoryOperationNote("\u2003"), null);

  assert.deepEqual(
    requireInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "count",
      quantity: 1,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      note: "\u2003"
    }).metadata,
    {}
  );

  assert.throws(
    () => normalizeCanonicalInventoryOperationNote(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a valid note."
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationNote("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a valid note."
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationNote("Bad\u000bNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a valid note."
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationNote("Bad\u000cNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a valid note."
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationNote("Bad\u007fNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a valid note."
  );
  assert.equal(
    normalizeCanonicalInventoryOperationNote("Chilled\ton arrival\nkeep cold."),
    "Chilled\ton arrival\nkeep cold."
  );

  assert.equal(normalizeCanonicalInventoryOperationNote("x".repeat(500))?.length, 500);
  assert.throws(
    () => normalizeCanonicalInventoryOperationNote("x".repeat(501)),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a shorter note."
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        restaurantId: "restaurant-a",
        inventoryItemId: "chicken",
        eventType: "count",
        quantity: 1,
        canonicalUnit: "g",
        effectiveAt: "2026-07-26T10:00:00.000Z",
        note: "x".repeat(501)
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a shorter note."
  );

  assert.throws(
    () => requireCanonicalInventoryOperationNote(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter a valid note."
  );
});
