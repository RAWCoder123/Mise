import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiPrepOrdersDetailDeliveryEvidenceNotes,
  canonicalizeOrdersDetailDeliveryEvidenceNotes,
  normalizeOrdersDetailDeliveryEvidenceNotes
} from "../services/domain/ordersDetailDeliveryEvidenceNotesIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersDetailDeliveryEvidenceNotesIdentity.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const note = "Late truck; crushed corner";
const accentedNote = "Camión tarde; esquina aplastada";
const multilineNote = "Late truck.\nCrushed corner.\tCase count attached.";

const noteNoneIdentityPath = new URL(
  "../services/domain/ordersDetailNoteNoneIdentity.ts",
  import.meta.url
);
const supplierReliabilityDeliveryNotesIdentityPath = new URL(
  "../services/domain/supplierReliabilityDeliveryNotesIdentity.ts",
  import.meta.url
);
const deliveryEvidenceDatePath = new URL(
  "../services/domain/deliveryEvidenceDate.ts",
  import.meta.url
);

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005AAW pins Orders detail deliveryEvidence notes display to ASCII C multiline prep", () => {
  assert.match(identitySource, /MISE-005AAW/);
  assert.match(ordersUiSource, /MISE-005AAW/);

  assert.ok(identitySource.includes("C_LEADING_WHITESPACE = /^[ \\t\\n\\v\\f\\r]+/;"));
  assert.ok(identitySource.includes("C_TRAILING_WHITESPACE = /[ \\t\\n\\v\\f\\r]+$/;"));
  assert.ok(identitySource.includes('.replace(/\\u00a0/g, " ")'));
  assert.ok(
    identitySource.includes(
      "UNSAFE_MULTILINE_CONTROL = /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/;"
    )
  );

  const prepBody = identitySource.slice(
    identitySource.indexOf("export function asciiPrepOrdersDetailDeliveryEvidenceNotes("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(prepBody, /\.trim\(\)/);
  assert.doesNotMatch(prepBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(prepBody, /\\s/);

  assert.match(
    ordersUiSource,
    /from "\.\.\/\.\.\/services\/domain\/ordersDetailDeliveryEvidenceNotesIdentity"/
  );
  assert.match(
    ordersUiSource,
    /const deliveryEvidenceNotes = normalizeOrdersDetailDeliveryEvidenceNotes\(\s*evidence\.notes\s*\)/
  );
  assert.match(
    ordersUiSource,
    /\{deliveryEvidenceNotes \? \(\s*<Text style=\{styles\.deliveryEvidenceNote\}>\{deliveryEvidenceNotes\}<\/Text>\s*\) : null\}/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /\{evidence\.notes \? \(\s*<Text style=\{styles\.deliveryEvidenceNote\}>\{evidence\.notes\}<\/Text>\s*\) : null\}/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*supplierReliabilityDeliveryNotesIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*deliveryEvidenceDate/);
  assert.doesNotMatch(identitySource, /from ["'].*deliveryHistoryNoteIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(ordersUiSource, /normalizeOrdersDetailNoteNone\b/);
  assert.doesNotMatch(ordersUiSource, /canonicalizeSupplierReliabilityDeliveryNotes\b/);
  assert.doesNotMatch(ordersUiSource, /normalizeOrdersDetailDeliveryEvidenceNotes\(visibleOrder/);
  assert.equal(filePresence(noteNoneIdentityPath), "absent");
  assert.equal(filePresence(supplierReliabilityDeliveryNotesIdentityPath), "absent");
  assert.equal(filePresence(deliveryEvidenceDatePath), "absent");
});

test("ASCII C multiline prep keeps ordinary deliveryEvidence notes stable", () => {
  assert.equal(asciiPrepOrdersDetailDeliveryEvidenceNotes(`  ${note}  `), note);
  assert.equal(asciiPrepOrdersDetailDeliveryEvidenceNotes(`\t${note}\n`), note);
  assert.equal(canonicalizeOrdersDetailDeliveryEvidenceNotes(`  ${note}  `), note);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(`  ${note}  `), note);

  assert.equal(asciiPrepOrdersDetailDeliveryEvidenceNotes(accentedNote), accentedNote);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(asciiPrepOrdersDetailDeliveryEvidenceNotes(multilineNote), multilineNote);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(multilineNote), multilineNote);
});

test("Unicode-only space cannot bypass deliveryEvidence notes hide branch", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";

  // Bypass proof: raw truthiness previously rendered blank-looking notes.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(paddedSpaces), true);
  assert.notEqual(emOnly.trim(), emOnly);
  assert.equal(emOnly.trim(), "");

  // Soft-null restores the intentional hide branch.
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(emOnly), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(nbspOnly), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(paddedSpaces), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(null), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(undefined), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(""), null);
  assert.equal(Boolean(normalizeOrdersDetailDeliveryEvidenceNotes(emOnly)), false);
});

test("NBSP folds and em-space padding cannot invent clean deliveryEvidence notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Late\u2003truck`;
  const internalNbsp = `Late\u00a0truck`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP folds like sibling multiline free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(asciiPrepOrdersDetailDeliveryEvidenceNotes(nbspNote), note);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(nbspNote), note);

  // Unicode trim invents a clean body; ASCII C soft-null refuses to invent.
  assert.equal(emNote.trim(), note);
  assert.notEqual(asciiPrepOrdersDetailDeliveryEvidenceNotes(emNote), note);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(emNote), null);
  assert.equal(Boolean(normalizeOrdersDetailDeliveryEvidenceNotes(emNote)), false);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(emMultiline), null);

  // Internal em-space / folded NBSP stay (no inventing strip of interior).
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(internalEm), internalEm);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(internalNbsp), "Late truck");
});

test("Unsafe multiline controls soft-null for deliveryEvidence notes display", () => {
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(`${note}\u0000`), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(`${note}\u0007`), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(`${note}\u007f`), null);
  assert.equal(normalizeOrdersDetailDeliveryEvidenceNotes(123 as unknown as string), null);
  // LF/TAB/CR remain allowed.
  assert.equal(
    normalizeOrdersDetailDeliveryEvidenceNotes("Line one\nLine two\tTabbed\r"),
    "Line one\nLine two\tTabbed"
  );
});
