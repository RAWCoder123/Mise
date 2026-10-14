import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalizeOrderMessageNote,
  canonicalOrderMessageNote,
  generatedOrderMessage
} from "../services/domain/generatedOrderMessageIdentity";
import { buildSupplierOrderMessage } from "../services/domain/miseDomain";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/generatedOrderMessageIdentity.ts", import.meta.url),
  "utf8"
);
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const note = "Call on arrival";
const accentedNote = "Llamar al llegar";
const multilineNote = "Call on arrival.\nUse the side entrance.\tCase count attached.";

function recommendationFixture(): PurchaseRecommendation {
  return {
    id: "rec-1",
    restaurant_id: "rest-1",
    inventory_item_id: "item-1",
    item_name: "Roma Tomatoes",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Below par",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-10-14T00:00:00.000Z",
    supplier_id: "sup-1",
    supplier_name: "Local Produce Co."
  } as PurchaseRecommendation;
}

function orderFixture(
  overrides: Partial<Pick<SupplierOrder, "order_message" | "operator_note">>
): Pick<SupplierOrder, "order_message" | "operator_note"> {
  return {
    order_message: "Order draft for Local Produce Co.\n\nRoma Tomatoes - 20 lb",
    operator_note: null,
    ...overrides
  };
}

test("MISE-005PM pins generatedOrderMessage Notes: prep to ASCII C multiline free-text", () => {
  assert.match(identitySource, /MISE-005PM/);
  assert.match(miseDomainSource, /MISE-005PM/);
  assert.match(ordersUiSource, /MISE-005PM/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalStart = identitySource.indexOf(
    "export function canonicalOrderMessageNote("
  );
  const canonicalEnd = identitySource.indexOf("\n}", canonicalStart) + 2;
  const canonicalBody = identitySource.slice(canonicalStart, canonicalEnd);
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    ordersUiSource,
    /from "\.\.\/\.\.\/services\/domain\/generatedOrderMessageIdentity"/
  );
  assert.doesNotMatch(ordersUiSource, /function generatedOrderMessage\(/);
  assert.doesNotMatch(ordersUiSource, /operator_note\?\.trim\(\)/);

  const buildBody = miseDomainSource.slice(
    miseDomainSource.indexOf("export function buildSupplierOrderMessage("),
    miseDomainSource.indexOf("export type RecommendationWorkflowOutcome")
  );
  assert.match(buildBody, /canonicalizeOrderMessageNote\(operatorNote\)/);
  assert.doesNotMatch(buildBody, /operatorNote\?\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesBodyIdentity/);
  assert.doesNotMatch(identitySource, /wasteAnalysisNoteIdentity/);
  assert.doesNotMatch(identitySource, /deliveryHistoryNoteIdentity/);
  // Leave #840 require / UI persist / demo patch paths alone.
  assert.match(ordersUiSource, /operator_note: operatorNote\.trim\(\) \|\| null/);
});

test("ASCII C multiline prep keeps ordinary order-message notes stable", () => {
  assert.equal(canonicalOrderMessageNote(`  ${note}  `), note);
  assert.equal(canonicalOrderMessageNote(`\t${note}\n`), note);
  assert.equal(canonicalizeOrderMessageNote(`  ${note}  `), note);

  assert.equal(canonicalOrderMessageNote(accentedNote), accentedNote);
  assert.equal(canonicalizeOrderMessageNote(accentedNote), accentedNote);

  // Internal LF/TAB/CR are preserved (operator_note-style multiline).
  assert.equal(canonicalOrderMessageNote(multilineNote), multilineNote);
  assert.equal(canonicalizeOrderMessageNote(multilineNote), multilineNote);
});

test("NBSP folds and em-space padding cannot invent order-message Notes notes", () => {
  const nbspNote = `\u00a0${note}\u00a0`;
  const emNote = `\u2003${note}\u2003`;
  const internalEm = `Call\u2003on arrival`;
  const internalNbsp = `Call\u00a0on arrival`;
  const emMultiline = `\u2003${multilineNote}\u2003`;

  // Pasted NBSP is folded like MISE-005PF / MISE-005PL free-text prep.
  assert.equal(nbspNote.trim(), note);
  assert.equal(canonicalOrderMessageNote(nbspNote), note);
  assert.equal(canonicalizeOrderMessageNote(nbspNote), note);
  assert.equal(canonicalOrderMessageNote(internalNbsp), "Call on arrival");

  // Unicode em-space trim invents a clean note; C free-text prep does not.
  assert.equal(emNote.trim(), note);
  assert.notEqual(canonicalOrderMessageNote(emNote), note);
  assert.equal(canonicalOrderMessageNote(emNote), emNote);
  assert.equal(canonicalizeOrderMessageNote(emNote), emNote);

  assert.equal(canonicalOrderMessageNote(internalEm), internalEm);
  assert.notEqual(
    canonicalOrderMessageNote(internalEm),
    canonicalOrderMessageNote(note)
  );

  assert.equal(emMultiline.trim(), multilineNote);
  assert.notEqual(canonicalOrderMessageNote(emMultiline), multilineNote);
  assert.equal(canonicalOrderMessageNote(emMultiline), emMultiline);

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(
    canonicalOrderMessageNote("Kelvin delivery note"),
    "Kelvin delivery note"
  );
  assert.notEqual(
    canonicalOrderMessageNote("Kelvin delivery note"),
    canonicalOrderMessageNote("Kelvin delivery note")
  );
});

test("order-message notes soft-empty to null", () => {
  assert.equal(canonicalizeOrderMessageNote(null), null);
  assert.equal(canonicalizeOrderMessageNote(undefined), null);
  assert.equal(canonicalizeOrderMessageNote(""), null);
  assert.equal(canonicalizeOrderMessageNote("   "), null);
  assert.equal(canonicalizeOrderMessageNote("\u00a0\u00a0"), null);
  assert.equal(canonicalizeOrderMessageNote("\u2003"), null);
  assert.equal(canonicalizeOrderMessageNote("\n\t\r"), null);
});

test("generatedOrderMessage strips Notes: with ASCII C prep; Unicode trim invents a miss", () => {
  const base =
    "Order draft for Local Produce Co.\n\nRoma Tomatoes - 20 lb\n\nDelivery requested: Tomorrow morning";
  const emNote = `\u2003${note}\u2003`;
  const rawMessage = `${base}\n\nNotes:\n${emNote}`;

  // Unicode trim invents a clean suffix that does not match the raw message.
  const inventedSuffix = `\n\nNotes:\n${emNote.trim()}`;
  assert.equal(emNote.trim(), note);
  assert.equal(rawMessage.endsWith(inventedSuffix), false);

  // ASCII C prep preserves em-space and strips correctly.
  assert.equal(
    generatedOrderMessage(
      orderFixture({ order_message: rawMessage, operator_note: emNote })
    ),
    base
  );

  // Ordinary notes still strip.
  const cleanMessage = `${base}\n\nNotes:\n${note}`;
  assert.equal(
    generatedOrderMessage(
      orderFixture({ order_message: cleanMessage, operator_note: note })
    ),
    base
  );

  // Soft-empty / missing note returns the full message.
  assert.equal(
    generatedOrderMessage(
      orderFixture({ order_message: cleanMessage, operator_note: null })
    ),
    cleanMessage
  );
  assert.equal(
    generatedOrderMessage(
      orderFixture({ order_message: cleanMessage, operator_note: "\u2003" })
    ),
    cleanMessage
  );

  // Mismatch leaves the message untouched (no invented strip).
  assert.equal(
    generatedOrderMessage(
      orderFixture({
        order_message: cleanMessage,
        operator_note: "Different note"
      })
    ),
    cleanMessage
  );
});

test("buildSupplierOrderMessage appends Notes: under ASCII C prep without inventing", () => {
  const recommendations = [recommendationFixture()];
  const emNote = `\u2003${note}\u2003`;

  const withEm = buildSupplierOrderMessage(
    "Local Produce Co.",
    recommendations,
    emNote
  );
  assert.match(withEm, new RegExp(`Notes:\\n${emNote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  assert.doesNotMatch(withEm, new RegExp(`Notes:\\n${note}$`));

  // Build + display round-trip: strip recovers the base without inventing.
  const stripped = generatedOrderMessage({
    order_message: withEm,
    operator_note: emNote
  });
  assert.equal(stripped.includes("Notes:"), false);
  assert.match(stripped, /Order draft for Local Produce Co\./);

  const withClean = buildSupplierOrderMessage(
    "Local Produce Co.",
    recommendations,
    `  ${note}  `
  );
  assert.match(withClean, new RegExp(`Notes:\\n${note}$`));

  const withoutNote = buildSupplierOrderMessage(
    "Local Produce Co.",
    recommendations,
    "\u2003"
  );
  assert.doesNotMatch(withoutNote, /Notes:/);
});
