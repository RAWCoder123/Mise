import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsPosQuantitySoldText,
  canonicalizeSetupDraftsPosQuantitySoldText,
  prepareSetupDraftsPosQuantitySoldText
} from "../services/domain/setupDraftsPosQuantitySoldIdentity";
import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsPosQuantitySoldIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const quantity = "2";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RW pins setup-drafts POS quantitySold to ASCII C", () => {
  assert.match(identitySource, /MISE-005RW/);
  assert.match(setupDraftsSource, /MISE-005RW/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsPosQuantitySoldText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(identitySource, /replace\(\/\[\$, \\t\\n\\r\\f\\v\]\/g/);

  assert.match(setupDraftsSource, /from "\.\/setupDraftsPosQuantitySoldIdentity"/);
  assert.match(
    setupDraftsSource,
    /prepareSetupDraftsPosQuantitySoldText\(record\.quantitySold \?\? ""\)/
  );
  assert.match(
    setupDraftsSource,
    /header === "quantitySold" \? raw : raw\.trim\(\)/
  );
  assert.match(
    setupDraftsSource,
    /preparedQuantity\.status === "ok" \? preparedQuantity\.quantity : Number\.NaN/
  );

  // Leave itemName/category (#872), saleDate (#871), grossSales, and full-line
  // (#908) on existing contracts until those tips own those paths.
  assert.match(setupDraftsSource, /\(record\.itemName \?\? ""\)\.trim\(\)/);
  assert.match(setupDraftsSource, /\(record\.category \?\? ""\)\.trim\(\)/);
  assert.match(setupDraftsSource, /normalizeSaleDate\(record\.saleDate \?\? ""\)/);
  assert.match(setupDraftsSource, /parseSetupNumber\(record\.grossSales \?\? ""\)/);
  assert.match(setupDraftsSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Do not rewrite sibling POS / quantity tips through this module.
  assert.doesNotMatch(identitySource, /setupPosItemLabelIdentity/);
  assert.doesNotMatch(identitySource, /setupPosSaleDateIdentity/);
  assert.doesNotMatch(identitySource, /setupDraftsPosCsvLineIdentity/);
  assert.doesNotMatch(identitySource, /setupDraftsRecipeIngredientQuantityIdentity/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsPosCsvLineText/);
  assert.doesNotMatch(identitySource, /normalizeSetupPosItemLabel/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsPosCsvLineIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupPosItemLabelIdentity/);
});

test("ASCII C prep keeps ordinary setup-drafts POS quantitySold padding stable", () => {
  assert.equal(asciiTrimSetupDraftsPosQuantitySoldText(`  ${quantity}  `), quantity);
  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText(`\t${quantity}\n`), {
    status: "ok",
    quantity: 2,
    text: quantity
  });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(`  ${quantity}  `), {
    status: "ok",
    quantity: 2,
    text: quantity
  });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("2.5"), {
    status: "ok",
    quantity: 2.5,
    text: "2.5"
  });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("$1,234.50"), {
    status: "ok",
    quantity: 1234.5,
    text: "$1,234.50"
  });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(undefined), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(""), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("\t\n"), { status: "empty" });

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,Chicken Bowl,Mains,  ${quantity}  ,20`,
      "2026-08-01,Iced Tea,Drinks,1.5,4"
    ].join("\n")
  );

  assert.equal(result.status, "ready");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 0);
  assert.equal(result.rows[0]?.quantitySold, 2);
  assert.equal(result.rows[1]?.quantitySold, 1.5);
});

test("NBSP and em-space padding cannot invent setup-drafts POS quantitySold", () => {
  const padded = `${em}${quantity}${em}`;
  const nbspPadded = `${nbsp}${quantity}${nbsp}`;

  // Live inventing proof on Unicode trim / parseSetupNumber `\s` strip.
  assert.equal(padded.trim(), quantity);
  assert.equal(nbspPadded.trim(), quantity);
  assert.equal(padded.replace(/[$,\s]/g, ""), quantity);
  assert.equal(nbspPadded.replace(/[$,\s]/g, ""), quantity);
  assert.equal(Number(padded.replace(/[$,\s]/g, "")), 2);
  assert.equal(Number(nbspPadded.replace(/[$,\s]/g, "")), 2);

  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText(padded), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText(nbspPadded), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(padded), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(nbspPadded), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior empty → NaN review,
  // and must not invent an ok quantity from a padded amount.
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(`${em}${em}`), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(`${nbsp}${nbsp}`), { status: "empty" });
  assert.notDeepEqual(prepareSetupDraftsPosQuantitySoldText(padded), { status: "empty" });
  assert.notDeepEqual(prepareSetupDraftsPosQuantitySoldText(padded), {
    status: "ok",
    quantity: 2,
    text: quantity
  });

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,Chicken Bowl,Mains,${padded},20`,
      `2026-08-01,Iced Tea,Drinks,${nbspPadded},4`,
      `2026-08-01,Soup,Mains,${em}${em},10`,
      "2026-08-01,Chicken Bowl,Mains,3,30"
    ].join("\n")
  );

  // Padded / soft-empty quantitySold fail closed → quantity_sold review.
  // Clean sibling still imports.
  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 1);
  assert.equal(result.rejectedRowCount, 3);
  assert.equal(result.rows[0]?.itemName, "Chicken Bowl");
  assert.equal(result.rows[0]?.quantitySold, 3);
  assert.equal(
    result.issues.filter((issue) => issue.field === "quantity_sold").length,
    3
  );
});

test("ASCII controls and malformed setup-drafts POS quantitySold fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText("2\n3"), { status: "invalid" });
  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText("2\r3"), { status: "invalid" });
  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText("2\x013"), { status: "invalid" });
  assert.deepEqual(canonicalizeSetupDraftsPosQuantitySoldText("2\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("2\n3"), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("2\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText("abc"), { status: "invalid" });
  // Interior em-space must not invent via `\s` currency strip (`"2\u20033"` → `"23"`).
  assert.deepEqual(prepareSetupDraftsPosQuantitySoldText(`2${em}3`), { status: "invalid" });

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,Chicken Bowl,Mains,2${em}3,20`,
      "2026-08-01,Iced Tea,Drinks,abc,4",
      "2026-08-01,Soup,Mains,1,10"
    ].join("\n")
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 1);
  assert.equal(result.rejectedRowCount, 2);
  assert.equal(result.rows[0]?.itemName, "Soup");
  assert.equal(result.rows[0]?.quantitySold, 1);
  assert.equal(
    result.issues.filter((issue) => issue.field === "quantity_sold").length,
    2
  );
});
