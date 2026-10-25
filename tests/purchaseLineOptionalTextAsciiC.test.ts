import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";
import {
  asciiTrimPurchaseLineOptionalTextToken,
  canonicalizePurchaseLineOptionalTextToken,
  normalizeCanonicalPurchaseLineCurrency,
  normalizeCanonicalPurchaseLineOptionalText,
  normalizeCanonicalPurchaseLinePackSize,
  normalizeCanonicalPurchaseLineUnitOfMeasure,
  PURCHASE_LINE_CURRENCY_MAX_CHARACTERS,
  PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS,
  PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS
} from "../services/domain/purchaseLineOptionalTextIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLineOptionalTextIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseLines.ts", import.meta.url),
  "utf8"
);
const securityLimitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);

const unit = "lb";
const currency = "USD";
const packSize = "12ct";
const em = "\u2003";
const nbsp = "\u00a0";

const base = {
  lineIndex: 0,
  lineType: "purchase" as const,
  rawItemDescription: "Chicken Thighs 40 LB",
  quantity: 2,
  unitOfMeasure: unit,
  unitPrice: 10,
  extendedPrice: 20,
  currency,
  packSize,
  transactionDate: "2026-10-01",
  parseConfidence: "confirmed" as const
};

test("MISE-005PW pins purchase-line optional unit/currency/pack to ASCII C", () => {
  assert.match(identitySource, /MISE-005PW/);
  assert.match(domainSource, /MISE-005PW/);
  assert.match(
    securityLimitsSource,
    /PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS = 80/
  );
  assert.match(
    securityLimitsSource,
    /PURCHASE_LINE_CURRENCY_MAX_CHARACTERS = 3/
  );
  assert.match(
    securityLimitsSource,
    /PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS = 80/
  );
  assert.equal(PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS, 80);
  assert.equal(PURCHASE_LINE_CURRENCY_MAX_CHARACTERS, 3);
  assert.equal(PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS, 80);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLineOptionalTextToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLineUnitOfMeasure\(\s*input\.unitOfMeasure\s*\)/
  );
  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLineCurrency\(input\.currency\)/
  );
  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLinePackSize\(input\.packSize\)/
  );
  assert.match(domainSource, /from "\.\/purchaseLineOptionalTextIdentity"/);

  const normalizeStart = domainSource.indexOf(
    "export function normalizePurchaseLineInput("
  );
  const nextExport = domainSource.indexOf(
    "export function markCurrentPurchaseLines("
  );
  const normalizeBody = domainSource.slice(
    normalizeStart,
    nextExport >= 0 ? nextExport : domainSource.length
  );
  assert.doesNotMatch(
    normalizeBody,
    /optionalBoundedText\(input\.unitOfMeasure/
  );
  assert.doesNotMatch(normalizeBody, /optionalBoundedText\(input\.currency/);
  assert.doesNotMatch(normalizeBody, /optionalBoundedText\(input\.packSize/);
  // Sibling required description / date paths stay on Unicode trim in this tip.
  assert.match(
    normalizeBody,
    /boundedText\(input\.rawItemDescription, "Raw item description", 500\)/
  );
  assert.match(normalizeBody, /isoDate\(input\.transactionDate/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineUnitHelpers/);
  assert.doesNotMatch(identitySource, /inventoryOperationReferenceIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary purchase-line optional text stable", () => {
  assert.equal(asciiTrimPurchaseLineOptionalTextToken(`  ${unit}  `), unit);
  assert.equal(asciiTrimPurchaseLineOptionalTextToken(`\t${currency}\n`), currency);
  assert.equal(
    canonicalizePurchaseLineOptionalTextToken(
      `  ${packSize}  `,
      PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS
    ),
    packSize
  );
  assert.equal(normalizeCanonicalPurchaseLineUnitOfMeasure(`  ${unit}  `), unit);
  assert.equal(normalizeCanonicalPurchaseLineCurrency(`  ${currency}  `), currency);
  assert.equal(normalizeCanonicalPurchaseLinePackSize(`  ${packSize}  `), packSize);
  assert.equal(
    normalizeCanonicalPurchaseLineOptionalText(
      `  ${unit}  `,
      "Unit of measure",
      PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS
    ),
    unit
  );

  const line = normalizePurchaseLineInput({
    ...base,
    unitOfMeasure: `  ${unit}  `,
    currency: `  ${currency}  `,
    packSize: `  ${packSize}  `
  });
  assert.equal(line.unitOfMeasure, unit);
  assert.equal(line.currency, currency);
  assert.equal(line.packSize, packSize);
});

test("Unicode em-space / NBSP padding cannot invent clean unit/currency/pack", () => {
  const paddedUnit = `${em}${unit}${em}`;
  const paddedCurrency = `${em}${currency}${em}`;
  const paddedPack = `${em}${packSize}${em}`;
  const nbspUnit = `${nbsp}${unit}${nbsp}`;
  const nbspCurrency = `${nbsp}${currency}${nbsp}`;
  const nbspPack = `${nbsp}${packSize}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean ledger token.
  assert.equal(paddedUnit.trim(), unit);
  assert.equal(paddedCurrency.trim(), currency);
  assert.equal(paddedPack.trim(), packSize);
  assert.equal(nbspUnit.trim(), unit);
  assert.equal(nbspCurrency.trim(), currency);
  assert.equal(nbspPack.trim(), packSize);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPurchaseLineOptionalTextToken(paddedUnit), paddedUnit);
  assert.equal(
    canonicalizePurchaseLineOptionalTextToken(
      paddedUnit,
      PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS
    ),
    null
  );
  assert.equal(
    canonicalizePurchaseLineOptionalTextToken(
      nbspCurrency,
      PURCHASE_LINE_CURRENCY_MAX_CHARACTERS
    ),
    null
  );
  assert.equal(
    canonicalizePurchaseLineOptionalTextToken(
      paddedPack,
      PURCHASE_LINE_PACK_SIZE_MAX_CHARACTERS
    ),
    null
  );

  assert.throws(
    () => normalizeCanonicalPurchaseLineUnitOfMeasure(paddedUnit),
    /Unit of measure must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineCurrency(nbspCurrency),
    /Currency must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLinePackSize(paddedPack),
    /Pack size must be bounded printable text\./
  );

  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        unitOfMeasure: paddedUnit
      }),
    /Unit of measure must be bounded printable text\./
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        currency: nbspCurrency
      }),
    /Currency must be bounded printable text\./
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        packSize: paddedPack
      }),
    /Pack size must be bounded printable text\./
  );
});

test("soft-empty optional unit/currency/pack stay null without inventing", () => {
  assert.equal(normalizeCanonicalPurchaseLineUnitOfMeasure(null), null);
  assert.equal(normalizeCanonicalPurchaseLineUnitOfMeasure(undefined), null);
  assert.equal(normalizeCanonicalPurchaseLineUnitOfMeasure("   "), null);
  assert.equal(normalizeCanonicalPurchaseLineUnitOfMeasure(`${nbsp}${nbsp}`), null);
  assert.equal(normalizeCanonicalPurchaseLineCurrency(""), null);
  assert.equal(normalizeCanonicalPurchaseLinePackSize(`${em}`), null);

  const line = normalizePurchaseLineInput({
    ...base,
    unitOfMeasure: "   ",
    currency: null,
    packSize: `${nbsp}`,
    unitPrice: null,
    extendedPrice: null,
    parseConfidence: "could_not_verify"
  });
  assert.equal(line.unitOfMeasure, null);
  assert.equal(line.currency, null);
  assert.equal(line.packSize, "40lb");
});

test("over-long and control-bearing optional text fail closed", () => {
  const overLongUnit = "u".repeat(PURCHASE_LINE_UNIT_OF_MEASURE_MAX_CHARACTERS + 1);
  assert.throws(
    () => normalizeCanonicalPurchaseLineUnitOfMeasure(overLongUnit),
    /Unit of measure must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineCurrency("USDX"),
    /Currency must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLinePackSize(`12ct\u0001`),
    /Pack size must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineUnitOfMeasure(42),
    /Unit of measure must be bounded printable text\./
  );
});
