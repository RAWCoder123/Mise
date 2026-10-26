import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupPosItemLabel,
  canonicalizeSetupPosItemLabel,
  normalizeSetupPosItemLabel
} from "../services/domain/setupPosItemLabelIdentity";
import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupPosItemLabelIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const itemName = "Chicken Bowl";
const category = "Mains";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QL pins setup POS itemName/category to ASCII C", () => {
  assert.match(identitySource, /MISE-005QL/);
  assert.match(setupDraftsSource, /MISE-005QL/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupPosItemLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupDraftsSource,
    /normalizeSetupPosItemLabel\(record\.itemName \?\? ""\)/
  );
  assert.match(
    setupDraftsSource,
    /normalizeSetupPosItemLabel\(record\.category \?\? ""\) \|\| "Sales"/
  );
  assert.match(setupDraftsSource, /from "\.\/setupPosItemLabelIdentity"/);
  assert.match(
    setupDraftsSource,
    /header === "itemName" \|\| header === "category" \? raw : raw\.trim\(\)/
  );

  // Leave saleDate / quantity / fingerprint fold on existing contracts
  // (#871 saleDate, #676 fingerprint/header).
  assert.match(setupDraftsSource, /normalizeSaleDate\(record\.saleDate \?\? ""\)/);
  assert.doesNotMatch(setupDraftsSource, /\(record\.itemName \?\? ""\)\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /\(record\.category \?\? ""\)\.trim\(\)/);

  // Do not rewrite sibling setup / Insights / saleDate tips.
  assert.doesNotMatch(identitySource, /setupPosSaleDateIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(identitySource, /setupRecipeDishNameIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/operationalSignals"/);
  assert.doesNotMatch(setupDraftsSource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupPosSaleDateIdentity/);
});

test("ASCII C prep keeps ordinary setup POS itemName/category padding stable", () => {
  assert.equal(asciiTrimSetupPosItemLabel(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimSetupPosItemLabel(`\t${category}\n`), category);
  assert.equal(canonicalizeSetupPosItemLabel(`  ${itemName}  `), itemName);
  assert.equal(normalizeSetupPosItemLabel(`  ${itemName}  `), itemName);
  assert.equal(normalizeSetupPosItemLabel(`  ${category}  `), category);
  assert.equal(normalizeSetupPosItemLabel(null), "");
  assert.equal(normalizeSetupPosItemLabel(undefined), "");
  assert.equal(normalizeSetupPosItemLabel(""), "");
  assert.equal(normalizeSetupPosItemLabel("   "), "");

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,  ${itemName}  ,  ${category}  ,2,20`,
      "2026-08-01,Iced Tea,,1,4"
    ].join("\n")
  );

  assert.equal(result.status, "ready");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 0);
  assert.equal(result.rows[0]?.itemName, itemName);
  assert.equal(result.rows[0]?.category, category);
  assert.equal(result.rows[1]?.itemName, "Iced Tea");
  assert.equal(result.rows[1]?.category, "Sales");
});

test("NBSP and em-space padding cannot invent setup POS itemName/category", () => {
  const paddedItem = `${em}${itemName}${em}`;
  const nbspItem = `${nbsp}${itemName}${nbsp}`;
  const paddedCategory = `${em}${category}${em}`;
  const nbspCategory = `${nbsp}${category}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean label.
  assert.equal(paddedItem.trim(), itemName);
  assert.equal(nbspItem.trim(), itemName);
  assert.equal(paddedCategory.trim(), category);
  assert.equal(nbspCategory.trim(), category);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupPosItemLabel(paddedItem), paddedItem);
  assert.equal(canonicalizeSetupPosItemLabel(paddedItem), null);
  assert.equal(canonicalizeSetupPosItemLabel(nbspItem), null);
  assert.equal(canonicalizeSetupPosItemLabel(paddedCategory), null);
  assert.equal(canonicalizeSetupPosItemLabel(nbspCategory), null);
  assert.equal(normalizeSetupPosItemLabel(paddedItem), "");
  assert.equal(normalizeSetupPosItemLabel(nbspItem), "");
  assert.equal(normalizeSetupPosItemLabel(paddedCategory), "");
  assert.equal(normalizeSetupPosItemLabel(nbspCategory), "");

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,${paddedItem},${paddedCategory},2,20`,
      `2026-08-01,${nbspItem},Drinks,1,4`,
      `2026-08-01,Soup,${nbspCategory},1,10`,
      `2026-08-01,${itemName},${category},3,30`
    ].join("\n")
  );

  // Padded itemName soft-fails like empty → item_name review.
  // Padded category soft-fails like empty → "Sales" fallthrough (Soup row).
  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 2);
  assert.equal(result.rows[0]?.itemName, "Soup");
  assert.equal(result.rows[0]?.category, "Sales");
  assert.equal(result.rows[1]?.itemName, itemName);
  assert.equal(result.rows[1]?.category, category);
  assert.equal(
    result.issues.filter((issue) => issue.field === "item_name").length,
    2
  );
});

test("ASCII-only empty and control setup POS item labels soft-fail without inventing", () => {
  assert.equal(normalizeSetupPosItemLabel(`${em}${em}`), "");
  assert.equal(normalizeSetupPosItemLabel(`${nbsp}`), "");
  assert.equal(normalizeSetupPosItemLabel(`\u0000${itemName}`), "");
  assert.equal(normalizeSetupPosItemLabel(`${itemName}\u007f`), "");

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,${em}${em},Mains,2,20`,
      `2026-08-01,\u0000${itemName},Drinks,1,4`,
      `2026-08-01,Iced Tea,${em}${em},1,4`
    ].join("\n")
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 1);
  assert.equal(result.rejectedRowCount, 2);
  assert.equal(result.rows[0]?.itemName, "Iced Tea");
  assert.equal(result.rows[0]?.category, "Sales");
  assert.equal(
    result.issues.filter((issue) => issue.field === "item_name").length,
    2
  );
});
