import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupplierOrderDeliveryEvidence,
  type SupplierDeliveryItemRecord,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import {
  canonicalSupplierReliabilityDeliveryNotes,
  canonicalizeSupplierReliabilityDeliveryNotes,
  normalizeCanonicalSupplierReliabilityDeliveryNotes,
  requireCanonicalSupplierReliabilityDeliveryNotes
} from "../services/domain/supplierReliabilityDeliveryNotesIdentity";
import type { SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/supplierReliabilityDeliveryNotesIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";
const supplierId = "00000000-0000-4000-8000-000000000401";
const supplierName = "Pantry Co.";
const note = "Late truck; crushed corner";
const accentedNote = "Camión tarde; esquina aplastada";
const multilineNote = "Late truck\ncrushed corner\tcase.";

function order(): SupplierOrder {
  return {
    id: "order-1",
    restaurant_id: workspace,
    supplier_id: supplierId,
    supplier_name: supplierName,
    order_message: "Recorded order",
    operator_note: null,
    status: "completed",
    delivery_date: "2026-07-10",
    created_at: "2026-07-01T12:00:00.000Z"
  };
}

function delivery(overrides: Partial<SupplierDeliveryRecord> = {}): SupplierDeliveryRecord {
  return {
    id: "delivery-1",
    restaurant_id: workspace,
    supplier_order_id: "order-1",
    status: "received",
    received_at: "2026-07-10T15:00:00.000Z",
    notes: note,
    created_at: "2026-07-10T15:00:00.000Z",
    ...overrides
  };
}

function line(): SupplierDeliveryItemRecord {
  return {
    id: "line-1",
    restaurant_id: workspace,
    delivery_id: "delivery-1",
    inventory_item_id: "item-1",
    ordered_quantity: 20,
    received_quantity: 20,
    damaged_quantity: 0,
    missing_quantity: 0,
    canonical_unit: "each",
    discrepancy_reason: null
  };
}

function evidence(notes: string | null) {
  return buildSupplierOrderDeliveryEvidence({
    restaurantId: workspace,
    restaurantTimeZone: "America/New_York",
    order: order(),
    deliveries: [delivery({ notes })],
    items: [line()]
  });
}

test("MISE-005PA pins supplierReliability delivery notes to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005PA/);
  assert.match(domainSource, /MISE-005PA/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalSupplierReliabilityDeliveryNotes("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    domainSource,
    /canonicalizeSupplierReliabilityDeliveryNotes\(delivery\.notes\)/
  );
  assert.match(domainSource, /from "\.\/supplierReliabilityDeliveryNotesIdentity"/);
  assert.doesNotMatch(domainSource, /delivery\.notes\?\.trim\(\)/);
  assert.doesNotMatch(domainSource, /delivery\.notes\.trim\(\)/);

  // Leave discrepancy emptiness-only gates and identity fields on Unicode trim.
  assert.match(domainSource, /item\.discrepancy_reason\?\.trim\(\)/);
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);
  assert.match(domainSource, /order\.supplier_name\.trim\(\)/);
  assert.match(domainSource, /const key = order\.supplier_id\.trim\(\);/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /supplierReliabilitySupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilitySupplierIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsErrorIdentity/);
  assert.doesNotMatch(domainSource, /supplierReliabilitySupplierNameIdentity/);
  assert.doesNotMatch(domainSource, /inventoryCountLineNoteIdentity/);
});

test("ASCII C free-text prep keeps ordinary supplier-reliability delivery notes stable", () => {
  assert.equal(canonicalSupplierReliabilityDeliveryNotes(`  ${note}  `), note);
  assert.equal(canonicalSupplierReliabilityDeliveryNotes(`\t${note}\n`), note);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(`  ${note}  `), note);
  assert.equal(normalizeCanonicalSupplierReliabilityDeliveryNotes(`  ${note}  `), note);
  assert.equal(requireCanonicalSupplierReliabilityDeliveryNotes(`  ${note}  `), note);

  assert.equal(canonicalSupplierReliabilityDeliveryNotes(accentedNote), accentedNote);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(accentedNote), accentedNote);
  assert.equal(canonicalSupplierReliabilityDeliveryNotes(multilineNote), multilineNote);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(multilineNote), multilineNote);

  const rows = evidence(`  ${note}  `);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.notes, note);
});

test("NBSP folds and em-space padding cannot invent supplier-reliability delivery notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Late\u2003truck`;

  // Pasted NBSP is folded like operator_note / MISE-005OS / MISE-005OT.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalSupplierReliabilityDeliveryNotes(nbspNote), note);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(nbspNote), note);
  assert.equal(normalizeCanonicalSupplierReliabilityDeliveryNotes(nbspNote), note);
  assert.equal(evidence(nbspNote)[0]!.notes, note);

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalSupplierReliabilityDeliveryNotes(emNote), note);
  assert.equal(canonicalSupplierReliabilityDeliveryNotes(emNote), emNote);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(emNote), emNote);
  assert.equal(normalizeCanonicalSupplierReliabilityDeliveryNotes(emNote), emNote);
  assert.equal(evidence(emNote)[0]!.notes, emNote);

  assert.equal(canonicalSupplierReliabilityDeliveryNotes(internalEm), internalEm);
  assert.notEqual(
    canonicalSupplierReliabilityDeliveryNotes(internalEm),
    canonicalSupplierReliabilityDeliveryNotes("Late truck")
  );

  // Internal LF/TAB/CR survive; Kelvin / accents stay presentation-faithful.
  assert.equal(
    canonicalizeSupplierReliabilityDeliveryNotes("Late\ttruck\ncrushed\rcorner"),
    "Late\ttruck\ncrushed\rcorner"
  );
  assert.equal(canonicalSupplierReliabilityDeliveryNotes("Kelvin crushed"), "Kelvin crushed");
  assert.notEqual(
    canonicalSupplierReliabilityDeliveryNotes("Kelvin crushed"),
    canonicalSupplierReliabilityDeliveryNotes("Kelvin crushed")
  );
});

test("supplier-reliability delivery notes soft-empty stays null and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(null), null);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(undefined), null);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes(""), null);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes("   "), null);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes("\u00a0\u00a0"), null);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes("\u2003"), null);
  assert.equal(canonicalizeSupplierReliabilityDeliveryNotes("\n\t\r"), null);
  assert.equal(normalizeCanonicalSupplierReliabilityDeliveryNotes("   "), null);
  assert.equal(normalizeCanonicalSupplierReliabilityDeliveryNotes("\u2003"), null);
  assert.equal(evidence(null)[0]!.notes, null);
  assert.equal(evidence("   ")[0]!.notes, null);
  assert.equal(evidence("\u2003")[0]!.notes, null);

  assert.throws(
    () => normalizeCanonicalSupplierReliabilityDeliveryNotes(123),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierReliabilityDeliveryNotes("Bad\u0000Note"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierReliabilityDeliveryNotes("Bad\u000bNote"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierReliabilityDeliveryNotes("Bad\u000cNote"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes must be text."
  );
  assert.throws(
    () => normalizeCanonicalSupplierReliabilityDeliveryNotes("Bad\u007fNote"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes must be text."
  );
  assert.equal(
    normalizeCanonicalSupplierReliabilityDeliveryNotes("Late\ttruck\ncase."),
    "Late\ttruck\ncase."
  );

  assert.throws(
    () => normalizeCanonicalSupplierReliabilityDeliveryNotes("x".repeat(2001)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes are outside supported limits."
  );
  assert.throws(
    () => requireCanonicalSupplierReliabilityDeliveryNotes(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Supplier reliability delivery notes must be text."
  );

  // Evidence soft path never newly throws on presentation text.
  assert.equal(evidence("x".repeat(2001))[0]!.notes, "x".repeat(2001));
  assert.equal(evidence("Bad\u0000Note")[0]!.notes, "Bad\u0000Note");
});

test("sibling supplier_name / discrepancy_reason Unicode trim still invents until tipped", () => {
  const cleanName = "Pantry Co.";
  const emName = `\u2003${cleanName}\u2003`;
  assert.equal(emName.trim(), cleanName);
  assert.match(domainSource, /order\.supplier_name\.trim\(\)/);

  const cleanReason = "short ship";
  const emReason = `\u2003${cleanReason}\u2003`;
  assert.equal(emReason.trim(), cleanReason);
  assert.match(domainSource, /item\.discrepancy_reason\?\.trim\(\)/);
  // Emptiness-only gate: padded reason still counts as a discrepancy line.
  assert.equal(Boolean(emReason.trim()), true);
});
