import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeInventoryOperationNote,
  canonicalInventoryOperationNote
} from "../services/domain/inventoryOperationNoteIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOperationNoteIdentity.ts", import.meta.url),
  "utf8"
);
const logDeliverySource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
  "utf8"
);
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const miseValidationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const securityLimitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);

const note = "Chilled on arrival";
const accentedNote = "Producto dañado";
const multilineNote = "Chilled on arrival.\nKeep on ice.\tCase count attached.";

test("MISE-005QZ pins Log Delivery notes to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005PT/);
  assert.match(logDeliverySource, /MISE-005QZ/);
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
    logDeliverySource,
    /from "\.\.\/\.\.\/services\/domain\/inventoryOperationNoteIdentity"/
  );
  assert.match(
    logDeliverySource,
    /canonicalizeInventoryOperationNote\(noteText\)/
  );

  const submitBody = logDeliverySource.slice(
    logDeliverySource.indexOf("await queueInventoryOperation({"),
    logDeliverySource.indexOf("if (activeRestaurantIdRef.current !== restaurantId) return;")
  );
  assert.doesNotMatch(submitBody, /noteText\.trim\(\)/);
  assert.doesNotMatch(submitBody, /note: noteText\.trim\(\) \|\| undefined/);

  // Open #854 owns inventory detail UI + requireInventoryOperation note routing.
  assert.match(inventoryDetailSource, /note: noteText\.trim\(\) \|\| undefined/);
  const requireInventoryOperationBody = miseValidationSource.slice(
    miseValidationSource.indexOf("export function requireInventoryOperation("),
    miseValidationSource.indexOf("function requireOperatorInventoryEventType(")
  );
  assert.match(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.note, "note", 500\)/
  );

  // Do not rewrite sibling free-text tips through this module.
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountSessionNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountSheetNoteIdentity/);
  assert.doesNotMatch(identitySource, /logDeliveryNoteIdentity/);
  assert.doesNotMatch(logDeliverySource, /normalizeCanonicalInventoryCountLineNote/);
  assert.doesNotMatch(logDeliverySource, /normalizeInventoryCountSheetNote/);
});

test("ASCII C multiline prep keeps ordinary Log Delivery notes stable", () => {
  assert.equal(canonicalInventoryOperationNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryOperationNote(`\t${note}\n`), note);
  assert.equal(canonicalizeInventoryOperationNote(`  ${note}  `), note);

  assert.equal(canonicalInventoryOperationNote(accentedNote), accentedNote);
  assert.equal(canonicalizeInventoryOperationNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalInventoryOperationNote(multilineNote), multilineNote);
  assert.equal(canonicalizeInventoryOperationNote(multilineNote), multilineNote);
});

test("NBSP folds and em-space padding cannot invent Log Delivery notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Chilled\u2003on arrival`;
  const internalNbsp = `Chilled\u00a0on arrival`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalInventoryOperationNote(nbspNote), note);
  assert.equal(canonicalizeInventoryOperationNote(nbspNote), note);
  assert.equal(canonicalInventoryOperationNote(internalNbsp), "Chilled on arrival");

  // Unicode em-space trim invents a clean delivery note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalInventoryOperationNote(emNote), note);
  assert.equal(canonicalInventoryOperationNote(emNote), emNote);
  assert.equal(canonicalizeInventoryOperationNote(emNote), emNote);
  assert.notEqual(canonicalizeInventoryOperationNote(emNote), note);

  assert.equal(canonicalInventoryOperationNote(internalEm), internalEm);
  assert.notEqual(
    canonicalInventoryOperationNote(internalEm),
    canonicalInventoryOperationNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalInventoryOperationNote(emMultiline), multilineNote);
  assert.equal(canonicalInventoryOperationNote(emMultiline), emMultiline);
  assert.equal(canonicalizeInventoryOperationNote(emMultiline), emMultiline);

  assert.equal(
    canonicalInventoryOperationNote("Kelvin delivery note"),
    "Kelvin delivery note"
  );
});

test("Soft empty omits Log Delivery notes without inventing", () => {
  assert.equal(canonicalizeInventoryOperationNote(null), null);
  assert.equal(canonicalizeInventoryOperationNote(undefined), null);
  assert.equal(canonicalizeInventoryOperationNote(""), null);
  assert.equal(canonicalizeInventoryOperationNote("   "), null);
  assert.equal(canonicalizeInventoryOperationNote("\t\n"), null);
  assert.equal(canonicalizeInventoryOperationNote("\u2003"), null);
  assert.equal(canonicalizeInventoryOperationNote("\u00a0"), null);
  assert.equal(canonicalizeInventoryOperationNote("\u2003\u00a0\u2003"), null);

  // Soft canonicalize does not throw on unsafe controls; live require (#854) owns that.
  assert.equal(
    canonicalizeInventoryOperationNote("Line one.\nLine two.\tKeep."),
    "Line one.\nLine two.\tKeep."
  );

  // Soft path does not truncate; over-long stays for fail-closed require (#854).
  const overLong = "a".repeat(501);
  assert.equal(canonicalizeInventoryOperationNote(overLong)?.length, 501);
  const emPaddedShort = `\u2003${"a".repeat(500)}\u2003`;
  assert.equal(emPaddedShort.trim().length, 500);
  assert.equal(canonicalizeInventoryOperationNote(emPaddedShort)?.length, 502);
});
