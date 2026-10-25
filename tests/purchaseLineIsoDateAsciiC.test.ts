import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";
import {
  asciiTrimPurchaseLineIsoDateToken,
  canonicalizePurchaseLineIsoDateToken,
  normalizeCanonicalPurchaseLineIsoDate
} from "../services/domain/purchaseLineIsoDateIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLineIsoDateIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseLines.ts", import.meta.url),
  "utf8"
);

const date = "2026-10-01";
const received = "2026-10-02";
const em = "\u2003";
const nbsp = "\u00a0";

const base = {
  lineIndex: 0,
  lineType: "purchase" as const,
  rawItemDescription: "Chicken Thighs 40 LB",
  quantity: 2,
  unitOfMeasure: "lb",
  unitPrice: 10,
  extendedPrice: 20,
  currency: "USD",
  packSize: "12ct",
  transactionDate: date,
  parseConfidence: "confirmed" as const
};

test("MISE-005PX pins purchase-line ISO calendar dates to ASCII C", () => {
  assert.match(identitySource, /MISE-005PX/);
  assert.match(domainSource, /MISE-005PX/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLineIsoDateToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLineIsoDate\(\s*input\.transactionDate,\s*"Transaction date"\s*\)/
  );
  assert.match(
    domainSource,
    /normalizeCanonicalPurchaseLineIsoDate\(input\.receivedDate, "Received date"\)/
  );
  assert.match(domainSource, /from "\.\/purchaseLineIsoDateIdentity"/);

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
  assert.doesNotMatch(normalizeBody, /\bisoDate\(/);
  // Sibling required description / optional text paths stay on Unicode trim
  // in this tip (#857 owns optional unit/currency/pack when landed).
  assert.match(
    normalizeBody,
    /boundedText\(input\.rawItemDescription, "Raw item description", 500\)/
  );
  assert.match(
    normalizeBody,
    /optionalBoundedText\(input\.unitOfMeasure, "Unit of measure", 80\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseLineOptionalTextIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesSourceDocumentIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineUnitHelpers/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary purchase-line ISO dates stable", () => {
  assert.equal(asciiTrimPurchaseLineIsoDateToken(`  ${date}  `), date);
  assert.equal(asciiTrimPurchaseLineIsoDateToken(`\t${received}\n`), received);
  assert.equal(canonicalizePurchaseLineIsoDateToken(`  ${date}  `), date);
  assert.equal(
    normalizeCanonicalPurchaseLineIsoDate(`  ${date}  `, "Transaction date"),
    date
  );
  assert.equal(
    normalizeCanonicalPurchaseLineIsoDate(`  ${received}  `, "Received date"),
    received
  );

  const line = normalizePurchaseLineInput({
    ...base,
    transactionDate: `  ${date}  `,
    receivedDate: `  ${received}  `
  });
  assert.equal(line.transactionDate, date);
  assert.equal(line.receivedDate, received);
});

test("Unicode em-space / NBSP padding cannot invent clean ISO calendar dates", () => {
  const paddedDate = `${em}${date}${em}`;
  const paddedReceived = `${em}${received}${em}`;
  const nbspDate = `${nbsp}${date}${nbsp}`;
  const nbspReceived = `${nbsp}${received}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean ledger calendar token.
  assert.equal(paddedDate.trim(), date);
  assert.equal(paddedReceived.trim(), received);
  assert.equal(nbspDate.trim(), date);
  assert.equal(nbspReceived.trim(), received);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPurchaseLineIsoDateToken(paddedDate), paddedDate);
  assert.equal(canonicalizePurchaseLineIsoDateToken(paddedDate), null);
  assert.equal(canonicalizePurchaseLineIsoDateToken(nbspDate), null);
  assert.equal(canonicalizePurchaseLineIsoDateToken(paddedReceived), null);
  assert.equal(canonicalizePurchaseLineIsoDateToken(nbspReceived), null);

  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate(paddedDate, "Transaction date"),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate(nbspReceived, "Received date"),
    /Received date must be an ISO calendar date\./
  );

  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        transactionDate: paddedDate
      }),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        receivedDate: nbspReceived
      }),
    /Received date must be an ISO calendar date\./
  );
});

test("absent receivedDate stays null; empty/malformed dates fail closed", () => {
  const withoutReceived = normalizePurchaseLineInput({
    ...base,
    receivedDate: null
  });
  assert.equal(withoutReceived.receivedDate, null);

  const emptyReceived = normalizePurchaseLineInput({
    ...base,
    receivedDate: ""
  });
  assert.equal(emptyReceived.receivedDate, null);

  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate("   ", "Transaction date"),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate(`${nbsp}`, "Transaction date"),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate("09/01/2026", "Transaction date"),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate("2026-13-40", "Transaction date"),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () => normalizeCanonicalPurchaseLineIsoDate(42, "Transaction date"),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        transactionDate: "09/01/2026"
      }),
    /Transaction date must be an ISO calendar date\./
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        ...base,
        receivedDate: "   "
      }),
    /Received date must be an ISO calendar date\./
  );
});
