import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mergeDeliveryHistoryEntries } from "../services/application/deliveryHistoryMerge";
import {
  canonicalDeliveryHistoryNote,
  canonicalizeDeliveryHistoryNote,
  normalizeCanonicalDeliveryHistoryNote,
  requireCanonicalDeliveryHistoryNote
} from "../services/application/deliveryHistoryNoteIdentity";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import { createInventoryOutboxEntry } from "../services/domain/inventoryOutbox";

const identitySource = readFileSync(
  new URL("../services/application/deliveryHistoryNoteIdentity.ts", import.meta.url),
  "utf8"
);
const mergeSource = readFileSync(
  new URL("../services/application/deliveryHistoryMerge.ts", import.meta.url),
  "utf8"
);

const note = "Morning drop";
const accentedNote = "Entrega matutina";
const multilineNote = "Morning drop\nwalk-in floor\tcase.";

function receiptEvent(metadataNote: string | null): InventoryEvent {
  return {
    id: "receipt-1",
    sequence: 1,
    restaurantId: "restaurant-a",
    inventoryItemId: "item-chicken",
    eventType: "receipt",
    quantity: 2500,
    canonicalUnit: "g",
    effectiveAt: "2026-08-01T09:00:00.000Z",
    recordedAt: "2026-08-01T09:05:00.000Z",
    actorUserId: "manager-1",
    source: "receiving",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "client-receipt-1",
    idempotencyKey: "inventory:client-receipt-1",
    supersedesEventId: null,
    metadata: metadataNote === null ? {} : { note: metadataNote }
  };
}

function merge(metadataNote: string | null) {
  return mergeDeliveryHistoryEntries({
    events: [receiptEvent(metadataNote)],
    itemNames: new Map([["item-chicken", "Chicken thighs"]]),
    queued: []
  });
}

test("MISE-005PC pins deliveryHistory notes to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005PC/);
  assert.match(mergeSource, /MISE-005PC/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalDeliveryHistoryNote("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(mergeSource, /canonicalizeDeliveryHistoryNote\(note\)/);
  assert.match(mergeSource, /from "\.\/deliveryHistoryNoteIdentity"/);
  assert.doesNotMatch(mergeSource, /note\.trim\(\) \? note\.trim\(\)/);
  assert.doesNotMatch(mergeSource, /&& note\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /wasteAnalysisNoteIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilityDeliveryNotesIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(mergeSource, /wasteAnalysisNoteIdentity/);
  assert.doesNotMatch(mergeSource, /supplierReliabilityDeliveryNotesIdentity/);
  assert.doesNotMatch(mergeSource, /inventoryCountLineNoteIdentity/);
});

test("ASCII C free-text prep keeps ordinary delivery-history notes stable", () => {
  assert.equal(canonicalDeliveryHistoryNote(`  ${note}  `), note);
  assert.equal(canonicalDeliveryHistoryNote(`\t${note}\n`), note);
  assert.equal(canonicalizeDeliveryHistoryNote(`  ${note}  `), note);
  assert.equal(normalizeCanonicalDeliveryHistoryNote(`  ${note}  `), note);
  assert.equal(requireCanonicalDeliveryHistoryNote(`  ${note}  `), note);

  assert.equal(canonicalDeliveryHistoryNote(accentedNote), accentedNote);
  assert.equal(canonicalizeDeliveryHistoryNote(accentedNote), accentedNote);
  assert.equal(canonicalDeliveryHistoryNote(multilineNote), multilineNote);
  assert.equal(canonicalizeDeliveryHistoryNote(multilineNote), multilineNote);

  const history = merge(`  ${note}  `);
  assert.equal(history.length, 1);
  assert.equal(history[0]!.note, note);
});

test("NBSP folds and em-space padding cannot invent delivery-history notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Morning\u2003drop`;

  // Pasted NBSP is folded like operator_note / MISE-005OS / MISE-005PA / MISE-005PB.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalDeliveryHistoryNote(nbspNote), note);
  assert.equal(canonicalizeDeliveryHistoryNote(nbspNote), note);
  assert.equal(normalizeCanonicalDeliveryHistoryNote(nbspNote), note);
  assert.equal(merge(nbspNote)[0]!.note, note);

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalDeliveryHistoryNote(emNote), note);
  assert.equal(canonicalDeliveryHistoryNote(emNote), emNote);
  assert.equal(canonicalizeDeliveryHistoryNote(emNote), emNote);
  assert.equal(normalizeCanonicalDeliveryHistoryNote(emNote), emNote);
  assert.equal(merge(emNote)[0]!.note, emNote);

  assert.equal(canonicalDeliveryHistoryNote(internalEm), internalEm);
  assert.notEqual(
    canonicalDeliveryHistoryNote(internalEm),
    canonicalDeliveryHistoryNote("Morning drop")
  );

  // Internal LF/TAB/CR survive; Kelvin / accents stay presentation-faithful.
  assert.equal(
    canonicalizeDeliveryHistoryNote("Morning\tdrop\ncase\r."),
    "Morning\tdrop\ncase\r."
  );
  assert.equal(canonicalDeliveryHistoryNote("Kelvin drop"), "Kelvin drop");
  assert.notEqual(
    canonicalDeliveryHistoryNote("Kelvin drop"),
    canonicalDeliveryHistoryNote("Kelvin drop")
  );
});

test("delivery-history notes soft-empty stays null and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeDeliveryHistoryNote(null), null);
  assert.equal(canonicalizeDeliveryHistoryNote(undefined), null);
  assert.equal(canonicalizeDeliveryHistoryNote(""), null);
  assert.equal(canonicalizeDeliveryHistoryNote("   "), null);
  assert.equal(canonicalizeDeliveryHistoryNote("\u00a0\u00a0"), null);
  assert.equal(canonicalizeDeliveryHistoryNote("\u2003"), null);
  assert.equal(canonicalizeDeliveryHistoryNote("\n\t\r"), null);
  assert.equal(normalizeCanonicalDeliveryHistoryNote("   "), null);
  assert.equal(normalizeCanonicalDeliveryHistoryNote("\u2003"), null);
  assert.equal(merge(null)[0]!.note, null);
  assert.equal(merge("   ")[0]!.note, null);
  assert.equal(merge("\u2003")[0]!.note, null);

  assert.throws(
    () => normalizeCanonicalDeliveryHistoryNote(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Delivery history note must be text."
  );
  assert.throws(
    () => normalizeCanonicalDeliveryHistoryNote("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error && error.message === "Delivery history note must be text."
  );
  assert.throws(
    () => normalizeCanonicalDeliveryHistoryNote("Bad\u000bNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Delivery history note must be text."
  );
  assert.throws(
    () => normalizeCanonicalDeliveryHistoryNote("Bad\u000cNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Delivery history note must be text."
  );
  assert.throws(
    () => normalizeCanonicalDeliveryHistoryNote("Bad\u007fNote"),
    (error: unknown) =>
      error instanceof Error && error.message === "Delivery history note must be text."
  );
  assert.equal(
    normalizeCanonicalDeliveryHistoryNote("Morning\tdrop\ncase."),
    "Morning\tdrop\ncase."
  );

  assert.throws(
    () => normalizeCanonicalDeliveryHistoryNote("x".repeat(501)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Delivery history note is outside supported limits."
  );
  assert.throws(
    () => requireCanonicalDeliveryHistoryNote(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Delivery history note must be text."
  );

  // Soft presentation does not newly truncate or throw (prior merge returned full trim).
  assert.equal(merge("x".repeat(501))[0]!.note, "x".repeat(501));
  assert.equal(merge("Bad\u0000Note")[0]!.note, "Bad\u0000Note");
});

test("pending outbox receipt notes use the same ASCII C soft canonicalize", () => {
  const emNote = `\u2003${note}\u2003`;
  const pending = createInventoryOutboxEntry({
    id: "outbox-pending-1",
    event: {
      restaurantId: "restaurant-a",
      inventoryItemId: "item-chicken",
      eventType: "receipt",
      quantity: 1000,
      canonicalUnit: "g",
      effectiveAt: "2026-08-01T10:00:00.000Z",
      source: "receiving",
      sourceReference: null,
      reasonCode: null,
      clientEventId: "client-receipt-pending",
      idempotencyKey: "inventory:client-receipt-pending",
      supersedesEventId: null,
      metadata: { note: emNote }
    },
    now: "2026-08-01T10:00:01.000Z"
  });

  const history = mergeDeliveryHistoryEntries({
    events: [],
    itemNames: new Map([["item-chicken", "Chicken thighs"]]),
    queued: [pending]
  });

  assert.equal(history.length, 1);
  assert.equal(history[0]!.syncing, true);
  assert.equal(history[0]!.note, emNote);
  assert.notEqual(history[0]!.note, note);
});
