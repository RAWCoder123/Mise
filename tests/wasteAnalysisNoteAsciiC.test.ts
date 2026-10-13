import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildWasteAnalysis } from "../services/domain/wasteAnalysis";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import {
  canonicalWasteAnalysisNote,
  canonicalizeWasteAnalysisNote,
  normalizeCanonicalWasteAnalysisNote,
  requireCanonicalWasteAnalysisNote
} from "../services/domain/wasteAnalysisNoteIdentity";
import type { InventoryItem } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/wasteAnalysisNoteIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/wasteAnalysis.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-a";
const note = "Spill during prep";
const accentedNote = "Derrame durante la preparación";
const multilineNote = "Spill during prep\nwalk-in floor\tcase.";

function item(): InventoryItem {
  return {
    id: "tomatoes",
    restaurant_id: restaurantId,
    item_name: "Roma tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 8,
    estimated_unit_cost: 2.5,
    supplier_id: "10000000-0000-4000-8000-000000000013",
    supplier_name: "Supplier",
    last_updated: "2026-08-03T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 1000,
    canonical_unit_verification_status: "verified"
  };
}

function event(metadataNote: string | null): InventoryEvent {
  return {
    id: "waste-1",
    sequence: 1,
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "waste",
    quantity: 500,
    canonicalUnit: "g",
    effectiveAt: "2026-08-03T16:00:00.000Z",
    recordedAt: "2026-08-03T16:05:00.000Z",
    actorUserId: "user-a",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "client-waste-1",
    idempotencyKey: "inventory:waste-1",
    supersedesEventId: null,
    metadata: metadataNote === null ? {} : { note: metadataNote }
  };
}

function analyze(metadataNote: string | null) {
  return buildWasteAnalysis({
    restaurantId,
    operatingDate: "2026-08-03",
    restaurantTimeZone: "America/New_York",
    inventoryItems: [item()],
    events: [event(metadataNote)]
  });
}

test("MISE-005PB pins wasteAnalysis notes to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005PB/);
  assert.match(domainSource, /MISE-005PB/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalWasteAnalysisNote("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(domainSource, /canonicalizeWasteAnalysisNote\(note\)/);
  assert.match(domainSource, /from "\.\/wasteAnalysisNoteIdentity"/);
  assert.doesNotMatch(domainSource, /note\.trim\(\)\.slice\(0, 500\)/);
  assert.doesNotMatch(domainSource, /note\.trim\(\) \? note\.trim\(\)/);

  // Leave restaurantId / timezone emptiness contracts on their existing paths.
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);
  assert.match(domainSource, /if \(!value\.trim\(\)\) throw new Error\("Waste analysis requires a restaurant timezone\."\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /supplierReliabilityDeliveryNotesIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsLessonIdentity/);
  assert.doesNotMatch(domainSource, /supplierReliabilityDeliveryNotesIdentity/);
  assert.doesNotMatch(domainSource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(domainSource, /deliveryHistoryMerge/);
});

test("ASCII C free-text prep keeps ordinary waste-analysis notes stable", () => {
  assert.equal(canonicalWasteAnalysisNote(`  ${note}  `), note);
  assert.equal(canonicalWasteAnalysisNote(`\t${note}\n`), note);
  assert.equal(canonicalizeWasteAnalysisNote(`  ${note}  `), note);
  assert.equal(normalizeCanonicalWasteAnalysisNote(`  ${note}  `), note);
  assert.equal(requireCanonicalWasteAnalysisNote(`  ${note}  `), note);

  assert.equal(canonicalWasteAnalysisNote(accentedNote), accentedNote);
  assert.equal(canonicalizeWasteAnalysisNote(accentedNote), accentedNote);
  assert.equal(canonicalWasteAnalysisNote(multilineNote), multilineNote);
  assert.equal(canonicalizeWasteAnalysisNote(multilineNote), multilineNote);

  const summary = analyze(`  ${note}  `);
  assert.equal(summary.recentEvents.length, 1);
  assert.equal(summary.recentEvents[0]!.note, note);
});

test("NBSP folds and em-space padding cannot invent waste-analysis notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Spill\u2003during prep`;

  // Pasted NBSP is folded like operator_note / MISE-005OS / MISE-005PA.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalWasteAnalysisNote(nbspNote), note);
  assert.equal(canonicalizeWasteAnalysisNote(nbspNote), note);
  assert.equal(normalizeCanonicalWasteAnalysisNote(nbspNote), note);
  assert.equal(analyze(nbspNote).recentEvents[0]!.note, note);

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalWasteAnalysisNote(emNote), note);
  assert.equal(canonicalWasteAnalysisNote(emNote), emNote);
  assert.equal(canonicalizeWasteAnalysisNote(emNote), emNote);
  assert.equal(normalizeCanonicalWasteAnalysisNote(emNote), emNote);
  assert.equal(analyze(emNote).recentEvents[0]!.note, emNote);

  assert.equal(canonicalWasteAnalysisNote(internalEm), internalEm);
  assert.notEqual(
    canonicalWasteAnalysisNote(internalEm),
    canonicalWasteAnalysisNote("Spill during prep")
  );

  // Internal LF/TAB/CR survive; Kelvin / accents stay presentation-faithful.
  assert.equal(
    canonicalizeWasteAnalysisNote("Spill\tduring\nprep\rcase."),
    "Spill\tduring\nprep\rcase."
  );
  assert.equal(canonicalWasteAnalysisNote("Kelvin spill"), "Kelvin spill");
  assert.notEqual(
    canonicalWasteAnalysisNote("Kelvin spill"),
    canonicalWasteAnalysisNote("Kelvin spill")
  );
});

test("waste-analysis notes soft-empty stays null and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeWasteAnalysisNote(null), null);
  assert.equal(canonicalizeWasteAnalysisNote(undefined), null);
  assert.equal(canonicalizeWasteAnalysisNote(""), null);
  assert.equal(canonicalizeWasteAnalysisNote("   "), null);
  assert.equal(canonicalizeWasteAnalysisNote("\u00a0\u00a0"), null);
  assert.equal(canonicalizeWasteAnalysisNote("\u2003"), null);
  assert.equal(canonicalizeWasteAnalysisNote("\n\t\r"), null);
  assert.equal(normalizeCanonicalWasteAnalysisNote("   "), null);
  assert.equal(normalizeCanonicalWasteAnalysisNote("\u2003"), null);
  assert.equal(analyze(null).recentEvents[0]!.note, null);
  assert.equal(analyze("   ").recentEvents[0]!.note, null);
  assert.equal(analyze("\u2003").recentEvents[0]!.note, null);

  assert.throws(
    () => normalizeCanonicalWasteAnalysisNote(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis note must be text."
  );
  assert.throws(
    () => normalizeCanonicalWasteAnalysisNote("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis note must be text."
  );
  assert.throws(
    () => normalizeCanonicalWasteAnalysisNote("Bad\u000bNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis note must be text."
  );
  assert.throws(
    () => normalizeCanonicalWasteAnalysisNote("Bad\u000cNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis note must be text."
  );
  assert.throws(
    () => normalizeCanonicalWasteAnalysisNote("Bad\u007fNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis note must be text."
  );
  assert.equal(
    normalizeCanonicalWasteAnalysisNote("Spill\tduring\nprep."),
    "Spill\tduring\nprep."
  );

  assert.throws(
    () => normalizeCanonicalWasteAnalysisNote("x".repeat(501)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Waste analysis note is outside supported limits."
  );
  assert.throws(
    () => requireCanonicalWasteAnalysisNote(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis note must be text."
  );

  // Soft presentation truncates to 500; never newly throws on presentation text.
  assert.equal(analyze("x".repeat(501)).recentEvents[0]!.note, "x".repeat(500));
  assert.equal(analyze("Bad\u0000Note").recentEvents[0]!.note, "Bad\u0000Note");
});

test("sibling restaurantId Unicode trim still invents until tipped; timezone emptiness stays fail-closed", () => {
  const cleanId = "restaurant-a";
  const emId = `\u2003${cleanId}\u2003`;
  assert.equal(emId.trim(), cleanId);
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);

  // Timezone emptiness uses Unicode trim for emptiness only, then Intl on raw.
  assert.match(
    domainSource,
    /if \(!value\.trim\(\)\) throw new Error\("Waste analysis requires a restaurant timezone\."\);/
  );
  assert.match(
    domainSource,
    /new Intl\.DateTimeFormat\("en-US", \{ timeZone: value \}\)/
  );
});
