import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";
import {
  asciiTrimPurchaseLineRawItemDescriptionToken,
  canonicalizePurchaseLineRawItemDescriptionToken,
  normalizeCanonicalPurchaseLineRawItemDescription,
  PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS
} from "../services/domain/purchaseLineRawItemDescriptionIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLineRawItemDescriptionIdentity.ts", import.meta.url),
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

const description = "Chicken Thighs 40 LB";
const em = "\u2003";
const nbsp = "\u00a0";

const base = {
  lineIndex: 0,
  lineType: "purchase" as const,
  rawItemDescription: description,
  quantity: 2,
  unitOfMeasure: "lb",
  unitPrice: 10,
  extendedPrice: 20,
  currency: "USD",
  packSize: "12ct",
  transactionDate: "2026-10-01",
  parseConfidence: "confirmed" as const
};

test("MISE-005PY pins purchase-line rawItemDescription to ASCII C", () => {
  assert.match(identitySource, /MISE-005PY/);
  assert.match(domainSource, /MISE-005PY/);
  assert.match(
    securityLimitsSource,
    /PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS = 500/
  );
  assert.equal(PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS, 500);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLineRawItemDescriptionToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLineRawItemDescription\(\s*input\.rawItemDescription\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseLineRawItemDescriptionIdentity"/);

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
    /boundedText\(input\.rawItemDescription/
  );
  // Sibling optional text / date paths stay on Unicode trim in this tip
  // (#857 owns optional unit/currency/pack; #858 owns ISO dates when landed).
  assert.match(
    normalizeBody,
    /optionalBoundedText\(input\.unitOfMeasure, "Unit of measure", 80\)/
  );
  assert.match(normalizeBody, /isoDate\(input\.transactionDate/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseLineOptionalTextIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineIsoDateIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesSourceDocumentIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineUnitHelpers/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary purchase-line raw descriptions stable", () => {
  assert.equal(
    asciiTrimPurchaseLineRawItemDescriptionToken(`  ${description}  `),
    description
  );
  assert.equal(
    asciiTrimPurchaseLineRawItemDescriptionToken(`\t${description}\n`),
    description
  );
  assert.equal(
    canonicalizePurchaseLineRawItemDescriptionToken(`  ${description}  `),
    description
  );
  assert.equal(
    normalizeCanonicalPurchaseLineRawItemDescription(`  ${description}  `),
    description
  );

  const line = normalizePurchaseLineInput({
    ...base,
    rawItemDescription: `  ${description}  `,
    packSize: null
  });
  assert.equal(line.rawItemDescription, description);
  assert.equal(line.normalizedItemKey, "chicken thighs");
  assert.equal(line.packSize, "40lb");
});

test("Unicode em-space / NBSP padding cannot invent clean raw descriptions", () => {
  const padded = `${em}${description}${em}`;
  const nbspPadded = `${nbsp}${description}${nbsp}`;
  const olive = "Olive Oil";
  const paddedOlive = `${em}${olive}${em}`;

  // Inventing proof: Unicode trim would invent the clean ledger description.
  assert.equal(padded.trim(), description);
  assert.equal(nbspPadded.trim(), description);
  assert.equal(paddedOlive.trim(), olive);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPurchaseLineRawItemDescriptionToken(padded), padded);
  assert.equal(canonicalizePurchaseLineRawItemDescriptionToken(padded), null);
  assert.equal(canonicalizePurchaseLineRawItemDescriptionToken(nbspPadded), null);
  assert.equal(canonicalizePurchaseLineRawItemDescriptionToken(paddedOlive), null);

  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription(padded),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription(nbspPadded),
    /Raw item description must be bounded printable text\./
  );

  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        rawItemDescription: padded
      }),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        rawItemDescription: nbspPadded
      }),
    /Raw item description must be bounded printable text\./
  );
});

test("empty, control, over-long, and non-string raw descriptions fail closed", () => {
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription("   "),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription(`${nbsp}`),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription(`${em}`),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription("line\nbreak"),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription("has\u0000null"),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () =>
      normalizeCanonicalPurchaseLineRawItemDescription(
        "x".repeat(PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS + 1)
      ),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription(null),
    /Raw item description must be bounded printable text\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineRawItemDescription(12),
    /Raw item description must be bounded printable text\./
  );

  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        rawItemDescription: "  "
      }),
    /Raw item description must be bounded printable text\./
  );

  const atLimit = "y".repeat(PURCHASE_LINE_RAW_ITEM_DESCRIPTION_MAX_CHARACTERS);
  assert.equal(
    normalizeCanonicalPurchaseLineRawItemDescription(atLimit),
    atLimit
  );
});
