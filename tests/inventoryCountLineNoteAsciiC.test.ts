import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  mergeCountLineUpdates,
  planCountSessionApprovals
} from "../services/domain/inventoryCountSessions";
import {
  canonicalInventoryCountLineNote,
  normalizeCanonicalInventoryCountLineNote
} from "../services/domain/inventoryCountLineNoteIdentity";
import type { InventoryCountLine, InventoryItem } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountLineNoteIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/inventoryCountSessions.ts", import.meta.url),
  "utf8"
);

const note = "Spill during prep";
const multilineNote = "Spill during prep.\nCase short on delivery.\nPhoto attached.";
const accentedNote = "Derrame durante la preparación.";

const item = (id: string, quantity: number): InventoryItem => ({
  id,
  restaurant_id: "rest_a",
  item_name: id,
  category: "Produce",
  unit: "lbs",
  current_quantity: quantity,
  par_level: 10,
  reorder_threshold: 4,
  estimated_unit_cost: 1,
  supplier_id: "10000000-0000-4000-8000-000000000009",
  supplier_name: "Local",
  last_updated: "2026-07-31T00:00:00.000Z",
  canonical_unit: "g",
  canonical_quantity_per_unit: 453.592,
  canonical_unit_verification_status: "verified"
});

const line = (
  itemId: string,
  systemQuantity: number,
  countedQuantity: number | null,
  lineNote: string | null = null
): InventoryCountLine => ({
  id: `line_${itemId}`,
  restaurant_id: "rest_a",
  session_id: "session_1",
  inventory_item_id: itemId,
  item_name: itemId,
  unit: "lbs",
  system_quantity_at_start: systemQuantity,
  counted_quantity: countedQuantity,
  note: lineNote,
  created_at: "2026-07-31T00:00:00.000Z",
  updated_at: "2026-07-31T00:00:00.000Z"
});

test("MISE-005OS pins inventory count-line notes to ASCII C multiline free-text prep", () => {
  assert.match(identitySource, /MISE-005OS/);
  assert.match(domainSource, /MISE-005OS/);

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
    domainSource,
    /normalizeCanonicalInventoryCountLineNote\(line\.note,\s*\{\s*overLongMessage:\s*"Count line note is outside supported limits\."\s*\}\)/
  );
  assert.match(
    domainSource,
    /note = normalizeCanonicalInventoryCountLineNote\(update\.note\);/
  );
  assert.match(domainSource, /from "\.\/inventoryCountLineNoteIdentity"/);

  // Leave sibling inventoryItemId Map-key path on Unicode trim until tipped.
  assert.match(domainSource, /const itemId = update\.inventoryItemId\.trim\(\);/);

  assert.doesNotMatch(identitySource, /inventoryCountSessionsInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(domainSource, /restaurantTasksDetailIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksCompletionResultIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsErrorIdentity/);
});

test("ASCII C multiline prep keeps ordinary inventory count-line notes stable", () => {
  assert.equal(canonicalInventoryCountLineNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryCountLineNote(`\t${note}\n`), note);
  assert.equal(normalizeCanonicalInventoryCountLineNote(`  ${note}  `), note);
  assert.equal(canonicalInventoryCountLineNote(accentedNote), accentedNote);
  assert.equal(normalizeCanonicalInventoryCountLineNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalInventoryCountLineNote(multilineNote), multilineNote);
  assert.equal(normalizeCanonicalInventoryCountLineNote(multilineNote), multilineNote);

  const lines = [line("tomatoes", 10, null)];
  const merged = mergeCountLineUpdates(lines, [
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: `  ${note}  ` }
  ]);
  assert.equal(merged[0]?.note, note);

  const planned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9)],
    lines: [line("tomatoes", 10, 8, multilineNote)]
  });
  assert.equal(planned[0]?.note, multilineNote);
});

test("NBSP folds and em-space padding cannot invent inventory count-line notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Spill\u2003during prep`;
  const internalNbsp = `Spill\u00a0during prep`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP is folded like MISE-005B / #821 / #823 / #824 free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalInventoryCountLineNote(nbspNote), note);
  assert.equal(normalizeCanonicalInventoryCountLineNote(nbspNote), note);
  assert.equal(canonicalInventoryCountLineNote(internalNbsp), "Spill during prep");

  const nbspMerged = mergeCountLineUpdates([line("tomatoes", 10, null)], [
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: nbspNote }
  ]);
  assert.equal(nbspMerged[0]?.note, note);

  const nbspPlanned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9)],
    lines: [line("tomatoes", 10, 8, nbspNote)]
  });
  assert.equal(nbspPlanned[0]?.note, note);

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalInventoryCountLineNote(emNote), note);
  assert.equal(canonicalInventoryCountLineNote(emNote), emNote);
  assert.equal(normalizeCanonicalInventoryCountLineNote(emNote), emNote);

  const emMerged = mergeCountLineUpdates([line("tomatoes", 10, null)], [
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: emNote }
  ]);
  assert.equal(emMerged[0]?.note, emNote);

  const emPlanned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9)],
    lines: [line("tomatoes", 10, 8, emNote)]
  });
  assert.equal(emPlanned[0]?.note, emNote);

  assert.equal(canonicalInventoryCountLineNote(internalEm), internalEm);
  assert.notEqual(
    canonicalInventoryCountLineNote(internalEm),
    canonicalInventoryCountLineNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalInventoryCountLineNote(emMultiline), multilineNote);
  assert.equal(canonicalInventoryCountLineNote(emMultiline), emMultiline);
  assert.equal(normalizeCanonicalInventoryCountLineNote(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalInventoryCountLineNote("Kelvin count notes"), "Kelvin count notes");
  assert.notEqual(
    canonicalInventoryCountLineNote("Kelvin count notes"),
    canonicalInventoryCountLineNote("Kelvin count notes")
  );
});

test("inventory count-line notes soft-empty stay null; unsafe control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalInventoryCountLineNote(null), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote(undefined), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote(""), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote("   "), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote("\u2003"), null);
  assert.equal(normalizeCanonicalInventoryCountLineNote("\n\t\r"), null);

  const softMerged = mergeCountLineUpdates([line("tomatoes", 10, null)], [
    { inventoryItemId: "tomatoes", countedQuantity: 8, note: "   " }
  ]);
  assert.equal(softMerged[0]?.note, null);

  const softPlanned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9)],
    lines: [line("tomatoes", 10, 8, "\u2003")]
  });
  assert.equal(softPlanned[0]?.note, null);

  // Non-string notes on plan stay soft-null (prior typeof gate).
  const weirdLine = line("tomatoes", 10, 8);
  (weirdLine as { note: unknown }).note = 12;
  const weirdPlanned = planCountSessionApprovals({
    inventoryItems: [item("tomatoes", 9)],
    lines: [weirdLine]
  });
  assert.equal(weirdPlanned[0]?.note, null);

  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line note must be text."
  );
  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line note must be text."
  );
  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote("Spill\u000bduring prep"),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line note must be text."
  );
  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote("Spill\u000cduring prep"),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line note must be text."
  );
  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote("Spill\u007fduring prep"),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line note must be text."
  );
  assert.equal(
    normalizeCanonicalInventoryCountLineNote("Spill\tduring prep\ncase."),
    "Spill\tduring prep\ncase."
  );

  assert.throws(
    () => normalizeCanonicalInventoryCountLineNote("x".repeat(241)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Count line note is limited to 240 characters."
  );
  assert.throws(
    () =>
      normalizeCanonicalInventoryCountLineNote("x".repeat(241), {
        overLongMessage: "Count line note is outside supported limits."
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Count line note is outside supported limits."
  );

  assert.throws(
    () =>
      mergeCountLineUpdates([line("tomatoes", 10, null)], [
        { inventoryItemId: "tomatoes", countedQuantity: 8, note: "Bad\u0000Note" }
      ]),
    (error: unknown) =>
      error instanceof Error && error.message === "Count line note must be text."
  );
  assert.throws(
    () =>
      mergeCountLineUpdates([line("tomatoes", 10, null)], [
        { inventoryItemId: "tomatoes", countedQuantity: 8, note: "n".repeat(241) }
      ]),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Count line note is limited to 240 characters."
  );
  assert.throws(
    () =>
      planCountSessionApprovals({
        inventoryItems: [item("tomatoes", 9)],
        lines: [line("tomatoes", 10, 8, "n".repeat(241))]
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Count line note is outside supported limits."
  );
});

test("sibling inventoryItemId NBSP/em-space padding still invents under Unicode trim until tipped", () => {
  const cleanId = "tomatoes";
  const nbspId = `\u00a0${cleanId}\u00a0`;
  const emId = `\u2003${cleanId}\u2003`;

  assert.equal(nbspId.trim(), cleanId);
  assert.equal(emId.trim(), cleanId);

  const lines = [line(cleanId, 10, null)];
  const nbspMerged = mergeCountLineUpdates(lines, [
    { inventoryItemId: nbspId, countedQuantity: 7, note }
  ]);
  assert.equal(nbspMerged[0]?.counted_quantity, 7);
  assert.equal(nbspMerged[0]?.note, note);

  const emMerged = mergeCountLineUpdates(lines, [
    { inventoryItemId: emId, countedQuantity: 6, note }
  ]);
  assert.equal(emMerged[0]?.counted_quantity, 6);
  assert.equal(emMerged[0]?.note, note);
});
