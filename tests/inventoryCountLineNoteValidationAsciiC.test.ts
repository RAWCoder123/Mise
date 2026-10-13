import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeInventoryCountLineNote,
  canonicalInventoryCountLineNote,
  normalizeCanonicalInventoryCountLineNote,
  requireCanonicalInventoryCountLineNote
} from "../services/domain/inventoryCountLineNoteIdentity";
import {
  requireInventoryCountLineNote,
  requireInventoryCountLineUpdates
} from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountLineNoteIdentity.ts", import.meta.url),
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
const domainSource = readFileSync(
  new URL("../services/domain/inventoryCountSessions.ts", import.meta.url),
  "utf8"
);

const note = "Spill during prep";
const multilineNote = "Spill during prep.\nCase short on delivery.\nPhoto attached.";
const accentedNote = "Derrame durante la preparación.";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PL pins miseValidation inventory count-line notes to ASCII C", () => {
  assert.match(identitySource, /MISE-005PL/);
  assert.match(validationSource, /MISE-005PL/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalInventoryCountLineNote("),
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
    /normalizeCanonicalInventoryCountLineNote\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/inventoryCountLineNoteIdentity"/
  );

  const lineRequireBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryCountLineNote("),
    validationSource.indexOf("export function requireInventoryCountLineUpdates(")
  );
  assert.doesNotMatch(lineRequireBody, /value\.trim\(\)/);
  assert.match(lineRequireBody, /normalizeCanonicalInventoryCountLineNote/);

  // Application save path still routes through the require helper.
  assert.match(applicationSource, /requireInventoryCountLineUpdates\(lines\)/);

  // Leave sibling miseValidation count-session note helper on Unicode trim
  // until tipped (#845 / MISE-005PK).
  const sessionRequireBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryCountSessionNote("),
    validationSource.indexOf("export function requireInventoryCountLineNote(")
  );
  assert.match(sessionRequireBody, /value\.trim\(\)/);

  // Leave domain merge/plan count-line notes on Unicode trim until tipped
  // (#827 / MISE-005OS).
  assert.match(domainSource, /const normalized = update\.note\.trim\(\);/);
  assert.match(
    domainSource,
    /typeof line\.note === "string" && line\.note\.trim\(\) \? line\.note\.trim\(\) : null/
  );

  // Leave inventoryItemId Map-key path on Unicode trim until tipped.
  const updatesBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryCountLineUpdates("),
    validationSource.indexOf("export function requireSupplierOperatorNote(")
  );
  assert.match(
    updatesBody,
    /const inventoryItemId = String\(row\.inventoryItemId \?\? row\.inventory_item_id \?\? ""\)\.trim\(\);/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /inventoryCountSessionNoteIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryCountSessions"/);
});

test("ASCII C multiline prep keeps ordinary inventory count-line notes stable", () => {
  assert.equal(canonicalInventoryCountLineNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryCountLineNote(`\t${note}\n`), note);
  assert.equal(normalizeCanonicalInventoryCountLineNote(`  ${note}  `), note);
  assert.equal(requireInventoryCountLineNote(`  ${note}  `), note);
  assert.equal(canonicalizeInventoryCountLineNote(`  ${note}  `), note);

  assert.equal(canonicalInventoryCountLineNote(accentedNote), accentedNote);
  assert.equal(requireInventoryCountLineNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalInventoryCountLineNote(multilineNote), multilineNote);
  assert.equal(normalizeCanonicalInventoryCountLineNote(multilineNote), multilineNote);
  assert.equal(requireInventoryCountLineNote(multilineNote), multilineNote);

  const updates = requireInventoryCountLineUpdates([
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: `  ${note}  ` }
  ]);
  assert.equal(updates[0]?.note, note);
});

test("NBSP folds and em-space padding cannot invent inventory count-line notes", () => {
  const nbspNote = `${nbsp}${note}${nbsp}`;
  const emNote = `${em}${note}${em}`;
  const internalEm = `Spill${em}during prep`;
  const internalNbsp = `Spill${nbsp}during prep`;
  const emMultiline = `${em}${multilineNote}${em}`;

  // Inventing proof: Unicode trim would invent the clean line note.
  assert.equal(emNote.trim(), note);
  assert.equal(nbspNote.trim(), note);

  // Pasted NBSP is folded like MISE-005B / #827 / #840 / #845 free-text prep.
  assert.equal(canonicalInventoryCountLineNote(nbspNote), note);
  assert.equal(normalizeCanonicalInventoryCountLineNote(nbspNote), note);
  assert.equal(requireInventoryCountLineNote(nbspNote), note);
  assert.equal(canonicalInventoryCountLineNote(internalNbsp), "Spill during prep");

  const nbspUpdates = requireInventoryCountLineUpdates([
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: nbspNote }
  ]);
  assert.equal(nbspUpdates[0]?.note, note);

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.notEqual(canonicalInventoryCountLineNote(emNote), note);
  assert.equal(canonicalInventoryCountLineNote(emNote), emNote);
  assert.equal(normalizeCanonicalInventoryCountLineNote(emNote), emNote);
  assert.equal(requireInventoryCountLineNote(emNote), emNote);
  assert.equal(canonicalizeInventoryCountLineNote(emNote), emNote);

  const emUpdates = requireInventoryCountLineUpdates([
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: emNote }
  ]);
  assert.equal(emUpdates[0]?.note, emNote);

  assert.equal(canonicalInventoryCountLineNote(internalEm), internalEm);
  assert.notEqual(
    canonicalInventoryCountLineNote(internalEm),
    canonicalInventoryCountLineNote(note)
  );

  assert.equal(canonicalInventoryCountLineNote(emMultiline), emMultiline);
  assert.equal(requireInventoryCountLineNote(emMultiline), emMultiline);
});

test("soft empty line note stays null; unsafe control / over-long fail closed", () => {
  assert.equal(canonicalizeInventoryCountLineNote(undefined), null);
  assert.equal(canonicalizeInventoryCountLineNote(""), null);
  assert.equal(canonicalizeInventoryCountLineNote("   "), null);
  assert.equal(canonicalizeInventoryCountLineNote(`${em}${em}`), null);
  assert.equal(canonicalizeInventoryCountLineNote(`${nbsp}`), null);

  assert.equal(normalizeCanonicalInventoryCountLineNote(undefined), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote(""), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote("   "), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote(`${em}${em}`), null);
  assert.equal(requireInventoryCountLineNote(null), null);
  assert.equal(requireInventoryCountLineNote(undefined), null);
  assert.equal(requireInventoryCountLineNote("   "), null);
  assert.equal(requireInventoryCountLineNote(`${em}${em}`), null);

  const softUpdates = requireInventoryCountLineUpdates([
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: "   " }
  ]);
  assert.equal(softUpdates[0]?.note, null);

  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote(123),
    /Count line note must be text\./
  );
  assert.throws(
    () => requireInventoryCountLineNote(123 as unknown as string),
    /Count line note must be text\./
  );
  assert.throws(
    () => requireCanonicalInventoryCountLineNote(""),
    /Count line note must be text\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote(`\u0001${note}`),
    /Count line note must be text\./
  );
  assert.throws(
    () => requireInventoryCountLineNote(`\u0007${note}`),
    /Count line note must be text\./
  );

  const overLong = "a".repeat(241);
  assert.throws(
    () => requireInventoryCountLineNote(overLong),
    /Count line note is limited to 240 characters\./
  );
  assert.equal(requireInventoryCountLineNote("a".repeat(240)), "a".repeat(240));
});
