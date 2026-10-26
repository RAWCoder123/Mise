import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalOrderPresentationLineLabel,
  normalizeOrderPresentationLineLabel
} from "../services/domain/orderPresentationLineIdentity";
import {
  buildSupplierDraftPresentation,
  parseSupplierOrderLines
} from "../utils/orderPresentation";

const identitySource = readFileSync(
  new URL("../services/domain/orderPresentationLineIdentity.ts", import.meta.url),
  "utf8"
);
const presentationSource = readFileSync(
  new URL("../utils/orderPresentation.ts", import.meta.url),
  "utf8"
);

const itemName = "Roma tomatoes";
const quantityLabel = "2 cases";
const accentedItem = "Tomates roma";

test("MISE-005RA pins orderPresentation line labels to ASCII C", () => {
  assert.match(identitySource, /MISE-005RA/);
  assert.match(presentationSource, /MISE-005RA/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /export function canonicalOrderPresentationLineLabel\(value: string\) \{/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOrderPresentationLineLabel"),
    identitySource.indexOf("function hasUnsafeLineControls")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    presentationSource,
    /from "\.\.\/services\/domain\/orderPresentationLineIdentity"/
  );
  assert.match(presentationSource, /normalizeOrderPresentationLineLabel/);

  const scanBody = presentationSource.slice(
    presentationSource.indexOf("function scanSupplierOrderLines("),
    presentationSource.indexOf("function estimateLineCents(")
  );
  assert.match(scanBody, /normalizeOrderPresentationLineLabel\(/);
  assert.doesNotMatch(scanBody, /\.trim\(\)/);

  // Open #703 owns demo unit-price Kelvin haystack — leave estimateLineCents alone.
  assert.doesNotMatch(identitySource, /estimateOrderPresentationUnitCents/);
  assert.doesNotMatch(identitySource, /normalizeOrderPresentationItemToken/);
});

test("ASCII C display prep keeps ordinary draft line labels stable", () => {
  assert.equal(normalizeOrderPresentationLineLabel("  Roma tomatoes  "), itemName);
  assert.equal(normalizeOrderPresentationLineLabel("2 cases"), quantityLabel);
  assert.equal(normalizeOrderPresentationLineLabel(accentedItem), accentedItem);
  assert.equal(normalizeOrderPresentationLineLabel(null), null);
  assert.equal(normalizeOrderPresentationLineLabel(undefined), null);
  assert.equal(normalizeOrderPresentationLineLabel(""), null);
  assert.equal(normalizeOrderPresentationLineLabel("   "), null);
  assert.equal(normalizeOrderPresentationLineLabel("\t\n"), null);

  assert.equal(
    canonicalOrderPresentationLineLabel("Roma\u00a0tomatoes"),
    "Roma tomatoes"
  );
  assert.equal(
    canonicalOrderPresentationLineLabel("Roma\t\ntomatoes"),
    "Roma tomatoes"
  );

  const lines = parseSupplierOrderLines("Roma tomatoes — 2 cases\nOnion — 1 case\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.itemName, itemName);
  assert.equal(lines[0]?.quantityLabel, quantityLabel);
  assert.equal(lines[1]?.itemName, "Onion");
  assert.equal(lines[1]?.quantityLabel, "1 case");
});

test("ASCII C display prep does not invent clean draft lines via em-space / NBSP padding", () => {
  const paddedItem = `\u2003${itemName}\u2003`;
  assert.equal(paddedItem.trim(), itemName);
  assert.notEqual(normalizeOrderPresentationLineLabel(paddedItem), itemName);
  assert.equal(normalizeOrderPresentationLineLabel(paddedItem), paddedItem);

  const nbspPadded = `\u00a0${itemName}\u00a0`;
  assert.equal(nbspPadded.trim(), itemName);
  // NBSP folds to plain space, then C-trim → clean item (NBSP is not preserved).
  assert.equal(normalizeOrderPresentationLineLabel(nbspPadded), itemName);

  // Unicode-only space softs to omit (prior .trim() emptiness → skip).
  assert.equal(normalizeOrderPresentationLineLabel("\u2003\u2003"), null);
  assert.equal(normalizeOrderPresentationLineLabel("\u00a0\u00a0"), null);

  const paddedMessage = `\u2003${itemName} — ${quantityLabel}\u2003\n`;
  const paddedLines = parseSupplierOrderLines(paddedMessage);
  assert.equal(paddedLines.length, 1);
  assert.equal(paddedLines[0]?.itemName, `\u2003${itemName}`);
  assert.equal(paddedLines[0]?.quantityLabel, `${quantityLabel}\u2003`);
  assert.notEqual(paddedLines[0]?.itemName, itemName);
  assert.notEqual(paddedLines[0]?.quantityLabel, quantityLabel);

  // Em-space-padded header must not invent a clean non-item skip.
  const paddedHeader = "\u2003Order draft for Acme\u2003\nRoma tomatoes — 2 cases\n";
  assert.equal(/^order draft for/i.test("\u2003Order draft for Acme\u2003".trim()), true);
  const headerLines = parseSupplierOrderLines(paddedHeader);
  // Padded header fails the anchored non-item pattern and also fails the dash
  // item match after ASCII C prep, so only the real item line is kept.
  assert.equal(headerLines.length, 1);
  assert.equal(headerLines[0]?.itemName, itemName);

  const ordinary = parseSupplierOrderLines("Order draft for Acme\nRoma tomatoes — 2 cases\n");
  assert.equal(ordinary.length, 1);
  assert.equal(ordinary[0]?.itemName, itemName);

  const draft = buildSupplierDraftPresentation({
    id: "demo-order",
    restaurant_id: "demo-restaurant",
    supplier_id: "demo-supplier",
    supplier_name: "Demo Produce",
    status: "draft",
    delivery_date: null,
    order_message: paddedMessage,
    operator_note: null,
    created_at: "2026-10-26T00:00:00.000Z"
  });
  assert.equal(draft.itemCount, 1);
  assert.equal(draft.lines[0]?.itemName, `\u2003${itemName}`);
  assert.notEqual(draft.lines[0]?.itemName, itemName);
});

test("ASCII C display prep soft-skips unsafe control characters in draft lines", () => {
  assert.equal(normalizeOrderPresentationLineLabel("Roma\u0000tomatoes"), null);
  assert.equal(normalizeOrderPresentationLineLabel("2 cases\u007f"), null);

  const lines = parseSupplierOrderLines("Roma\u0000tomatoes — 2 cases\nOnion — 1 case\n");
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.itemName, "Onion");
});
