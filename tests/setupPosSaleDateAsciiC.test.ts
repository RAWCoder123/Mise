import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupPosSaleDate,
  canonicalizeSetupPosSaleDate,
  normalizeSetupPosSaleDate
} from "../services/domain/setupPosSaleDateIdentity";
import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupPosSaleDateIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const isoDate = "2026-08-01";
const slashDate = "8/1/2026";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QK pins setup POS saleDate to ASCII C", () => {
  assert.match(identitySource, /MISE-005QK/);
  assert.match(setupDraftsSource, /MISE-005QK/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupPosSaleDate\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(setupDraftsSource, /normalizeSetupPosSaleDate\(record\.saleDate \?\? ""\)/);
  assert.match(setupDraftsSource, /from "\.\/setupPosSaleDateIdentity"/);
  assert.match(
    setupDraftsSource,
    /entry\[header\] = header === "saleDate" \? raw : raw\.trim\(\);/
  );
  assert.doesNotMatch(setupDraftsSource, /function normalizeSaleDate\(/);
  assert.doesNotMatch(setupDraftsSource, /function isExactCalendarDate\(/);

  // Leave itemName / category / quantity Unicode trim on existing contracts
  // (#676 fingerprint fold owns those surfaces when landed).
  assert.match(setupDraftsSource, /\(record\.itemName \?\? ""\)\.trim\(\)/);
  assert.match(setupDraftsSource, /\(record\.category \?\? ""\)\.trim\(\)/);

  // Do not rewrite sibling setup / Insights / purchase-line date tips.
  assert.doesNotMatch(identitySource, /insightsSalesThroughDateIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineIsoDateIdentity/);
  assert.doesNotMatch(identitySource, /setupDraftsClientAsciiC/);
  assert.doesNotMatch(identitySource, /from "\.\/operationalSignals"/);
  assert.doesNotMatch(setupDraftsSource, /insightsSalesThroughDateIdentity/);
  assert.doesNotMatch(setupDraftsSource, /purchaseLineIsoDateIdentity/);
});

test("ASCII C prep keeps ordinary setup POS saleDate padding stable", () => {
  assert.equal(asciiTrimSetupPosSaleDate(`  ${isoDate}  `), isoDate);
  assert.equal(asciiTrimSetupPosSaleDate(`\t${isoDate}\n`), isoDate);
  assert.equal(canonicalizeSetupPosSaleDate(`  ${isoDate}  `), isoDate);
  assert.equal(normalizeSetupPosSaleDate(`  ${isoDate}  `), isoDate);
  assert.equal(canonicalizeSetupPosSaleDate(`  ${slashDate}  `), isoDate);
  assert.equal(normalizeSetupPosSaleDate(`  ${slashDate}  `), isoDate);
  assert.equal(normalizeSetupPosSaleDate(null), "");
  assert.equal(normalizeSetupPosSaleDate(undefined), "");
  assert.equal(normalizeSetupPosSaleDate(""), "");
  assert.equal(normalizeSetupPosSaleDate("   "), "");

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `  ${isoDate}  ,Chicken Bowl,Mains,2,20`,
      `  ${slashDate}  ,Iced Tea,Drinks,1,4`
    ].join("\n")
  );

  assert.equal(result.status, "ready");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 0);
  assert.equal(result.rows[0]?.saleDate, isoDate);
  assert.equal(result.rows[1]?.saleDate, isoDate);
});

test("NBSP and em-space padding cannot invent setup POS saleDate", () => {
  const paddedIso = `${em}${isoDate}${em}`;
  const nbspIso = `${nbsp}${isoDate}${nbsp}`;
  const paddedSlash = `${em}${slashDate}${em}`;
  const nbspSlash = `${nbsp}${slashDate}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean calendar date.
  assert.equal(paddedIso.trim(), isoDate);
  assert.equal(nbspIso.trim(), isoDate);
  assert.equal(paddedSlash.trim(), slashDate);
  assert.equal(nbspSlash.trim(), slashDate);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupPosSaleDate(paddedIso), paddedIso);
  assert.equal(canonicalizeSetupPosSaleDate(paddedIso), null);
  assert.equal(canonicalizeSetupPosSaleDate(nbspIso), null);
  assert.equal(canonicalizeSetupPosSaleDate(paddedSlash), null);
  assert.equal(canonicalizeSetupPosSaleDate(nbspSlash), null);
  assert.equal(normalizeSetupPosSaleDate(paddedIso), "");
  assert.equal(normalizeSetupPosSaleDate(nbspIso), "");
  assert.equal(normalizeSetupPosSaleDate(paddedSlash), "");
  assert.equal(normalizeSetupPosSaleDate(nbspSlash), "");
  assert.equal(normalizeSetupPosSaleDate("not-a-date"), "");
  assert.equal(normalizeSetupPosSaleDate("2026-13-40"), "");

  // Soft empty fails the row like prior emptied `.trim()`, without inventing.
  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `${paddedIso},Chicken Bowl,Mains,2,20`,
      `${nbspSlash},Iced Tea,Drinks,1,4`,
      `${isoDate},Soup,Mains,1,10`
    ].join("\n")
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 1);
  assert.equal(result.rejectedRowCount, 2);
  assert.equal(result.rows[0]?.saleDate, isoDate);
  assert.equal(result.rows[0]?.itemName, "Soup");
  assert.equal(
    result.issues.filter((issue) => issue.field === "sale_date").length,
    2
  );
});

test("ASCII-only empty and control setup POS saleDate soft-fail without inventing", () => {
  assert.equal(normalizeSetupPosSaleDate(`${em}${em}`), "");
  assert.equal(normalizeSetupPosSaleDate(`${nbsp}`), "");
  assert.equal(normalizeSetupPosSaleDate(`\u0000${isoDate}`), "");
  assert.equal(normalizeSetupPosSaleDate(`${isoDate}\u007f`), "");

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `${em}${em},Chicken Bowl,Mains,2,20`,
      `\u0000${isoDate},Iced Tea,Drinks,1,4`
    ].join("\n")
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 0);
  assert.equal(result.rejectedRowCount, 2);
  assert.equal(
    result.issues.filter((issue) => issue.field === "sale_date").length,
    2
  );
});
