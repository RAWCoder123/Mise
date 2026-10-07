import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  estimateOrderPresentationUnitCents,
  normalizeOrderPresentationItemToken
} from "../services/domain/orderPresentationIdentity";
import {
  buildSupplierDraftPresentation,
  parseSupplierOrderLines
} from "../utils/orderPresentation";

const domainSource = readFileSync(
  new URL("../services/domain/orderPresentationIdentity.ts", import.meta.url),
  "utf8"
);
const presentationSource = readFileSync(
  new URL("../utils/orderPresentation.ts", import.meta.url),
  "utf8"
);

test("MISE-005KH pins orderPresentation demo price heuristic to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005KH/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeOrderPresentationItemToken("),
    domainSource.indexOf("const DEMO_UNIT_CENTS")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(presentationSource, /estimateOrderPresentationUnitCents/);

  const estimateBody = presentationSource.slice(
    presentationSource.indexOf("function estimateLineCents("),
    presentationSource.indexOf("function formatCents(")
  );
  assert.match(estimateBody, /estimateOrderPresentationUnitCents\(itemName\)/);
  assert.doesNotMatch(estimateBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(estimateBody, /\.toLocaleLowerCase\(\)/);
});

test("ASCII C fold keeps ordinary demo unit-price matches stable", () => {
  assert.equal(normalizeOrderPresentationItemToken("  Chicken Thigh  "), "chicken thigh");
  assert.equal(normalizeOrderPresentationItemToken("TOMATO"), "tomato");
  assert.equal(normalizeOrderPresentationItemToken(null), "");
  assert.equal(normalizeOrderPresentationItemToken(undefined), "");
  assert.equal(normalizeOrderPresentationItemToken(""), "");
  assert.equal(normalizeOrderPresentationItemToken("   "), "");

  assert.equal(estimateOrderPresentationUnitCents("Roma Tomato"), 163);
  assert.equal(estimateOrderPresentationUnitCents("Yellow Onion"), 182);
  assert.equal(estimateOrderPresentationUnitCents("Lemon"), 295);
  assert.equal(estimateOrderPresentationUnitCents("Fresh Cilantro"), 420);
  assert.equal(estimateOrderPresentationUnitCents("Garlic"), 455);
  assert.equal(estimateOrderPresentationUnitCents("Napa Cabbage"), 210);
  assert.equal(estimateOrderPresentationUnitCents("Bell Pepper"), 235);
  assert.equal(estimateOrderPresentationUnitCents("Scallion"), 385);
  assert.equal(estimateOrderPresentationUnitCents("Ginger"), 315);
  assert.equal(estimateOrderPresentationUnitCents("Wonton Wrapper"), 220);
  assert.equal(estimateOrderPresentationUnitCents("Soy Sauce"), 850);
  assert.equal(estimateOrderPresentationUnitCents("Sesame Oil"), 1125);
  assert.equal(estimateOrderPresentationUnitCents("Chicken Thigh"), 370);
  assert.equal(estimateOrderPresentationUnitCents("CHICKEN"), 370);
  assert.equal(estimateOrderPresentationUnitCents("Jasmine Rice"), 95);
  assert.equal(estimateOrderPresentationUnitCents("Ground Beef"), 545);
  assert.equal(estimateOrderPresentationUnitCents("Butter Lettuce"), 230);
  assert.equal(estimateOrderPresentationUnitCents("Unknown Item"), 0);
  assert.equal(estimateOrderPresentationUnitCents(""), 0);
  assert.equal(estimateOrderPresentationUnitCents(null), 0);
});

test("ASCII C fold does not invent Kelvin-sign demo chicken unit price", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken" → 370¢.
  assert.equal(normalizeOrderPresentationItemToken("chicKen"), "chicKen");
  assert.notEqual(
    normalizeOrderPresentationItemToken("chicKen"),
    normalizeOrderPresentationItemToken("chicken")
  );
  assert.equal("chicKen".toLowerCase(), "chicken");

  assert.equal(estimateOrderPresentationUnitCents("chicKen"), 0);
  assert.equal(estimateOrderPresentationUnitCents("chicken"), 370);

  const kelvinLines = parseSupplierOrderLines("ChicKen Thigh — 2 cases\n");
  assert.equal(kelvinLines.length, 1);
  assert.equal(kelvinLines[0]?.itemName, "ChicKen Thigh");
  assert.equal(kelvinLines[0]?.estimatedCents, 0);
  assert.equal(kelvinLines[0]?.priceLabel, null);

  const ordinaryLines = parseSupplierOrderLines("Chicken Thigh — 2 cases\n");
  assert.equal(ordinaryLines.length, 1);
  assert.equal(ordinaryLines[0]?.estimatedCents, 740);
  assert.equal(ordinaryLines[0]?.priceLabel, "$7.40");

  const draft = buildSupplierDraftPresentation({
    id: "demo-order",
    restaurant_id: "demo",
    supplier_id: "demo-supplier",
    supplier_name: "Demo Foods",
    status: "draft",
    order_message: "ChicKen Thigh — 2 cases\nChicken Thigh — 2 cases\n",
    operator_note: null,
    delivery_date: null,
    created_at: "2026-10-07T00:00:00.000Z"
  });

  assert.equal(draft.itemCount, 2);
  assert.equal(draft.estimatedTotalCents, 740);
  assert.equal(draft.totalLabel, "$7.40");
  assert.equal(draft.lines[0]?.estimatedCents, 0);
  assert.equal(draft.lines[1]?.estimatedCents, 740);
});
