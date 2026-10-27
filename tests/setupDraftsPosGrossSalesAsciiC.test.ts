import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsPosGrossSalesText,
  canonicalizeSetupDraftsPosGrossSalesText,
  prepareSetupDraftsPosGrossSalesText
} from "../services/domain/setupDraftsPosGrossSalesIdentity";
import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsPosGrossSalesIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const amount = "20";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RX pins setup-drafts POS grossSales to ASCII C", () => {
  assert.match(identitySource, /MISE-005RX/);
  assert.match(setupDraftsSource, /MISE-005RX/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsPosGrossSalesText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(identitySource, /replace\(\/\[\$, \\t\\n\\r\\f\\v\]\/g/);

  assert.match(setupDraftsSource, /from "\.\/setupDraftsPosGrossSalesIdentity"/);
  assert.match(
    setupDraftsSource,
    /prepareSetupDraftsPosGrossSalesText\(record\.grossSales \?\? ""\)/
  );
  assert.match(
    setupDraftsSource,
    /header === "grossSales" \? raw : raw\.trim\(\)/
  );
  assert.match(
    setupDraftsSource,
    /preparedGrossSales\.status === "ok" \? preparedGrossSales\.amount : Number\.NaN/
  );

  // Leave quantitySold (#909), itemName/category (#872), saleDate (#871), and
  // full-line (#908) on existing contracts until those tips own those paths.
  assert.match(setupDraftsSource, /parseSetupNumber\(record\.quantitySold \?\? ""\)/);
  assert.match(setupDraftsSource, /\(record\.itemName \?\? ""\)\.trim\(\)/);
  assert.match(setupDraftsSource, /\(record\.category \?\? ""\)\.trim\(\)/);
  assert.match(setupDraftsSource, /normalizeSaleDate\(record\.saleDate \?\? ""\)/);
  assert.match(setupDraftsSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Do not rewrite sibling POS / quantity tips through this module.
  assert.doesNotMatch(identitySource, /setupDraftsPosQuantitySoldIdentity/);
  assert.doesNotMatch(identitySource, /setupPosItemLabelIdentity/);
  assert.doesNotMatch(identitySource, /setupPosSaleDateIdentity/);
  assert.doesNotMatch(identitySource, /setupDraftsPosCsvLineIdentity/);
  assert.doesNotMatch(identitySource, /setupDraftsRecipeIngredientQuantityIdentity/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsPosQuantitySoldText/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsPosCsvLineText/);
  assert.doesNotMatch(identitySource, /normalizeSetupPosItemLabel/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsPosQuantitySoldIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsPosCsvLineIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupPosItemLabelIdentity/);
});

test("ASCII C prep keeps ordinary setup-drafts POS grossSales padding stable", () => {
  assert.equal(asciiTrimSetupDraftsPosGrossSalesText(`  ${amount}  `), amount);
  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText(`\t${amount}\n`), {
    status: "ok",
    amount: 20,
    text: amount
  });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(`  ${amount}  `), {
    status: "ok",
    amount: 20,
    text: amount
  });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("0"), {
    status: "ok",
    amount: 0,
    text: "0"
  });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("20.5"), {
    status: "ok",
    amount: 20.5,
    text: "20.5"
  });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("$1,234.50"), {
    status: "ok",
    amount: 1234.5,
    text: "$1,234.50"
  });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(undefined), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(""), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("\t\n"), { status: "empty" });

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,Chicken Bowl,Mains,2,  ${amount}  `,
      "2026-08-01,Iced Tea,Drinks,1.5,$4.00"
    ].join("\n")
  );

  assert.equal(result.status, "ready");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 0);
  assert.equal(result.rows[0]?.grossSales, 20);
  assert.equal(result.rows[1]?.grossSales, 4);
});

test("NBSP and em-space padding cannot invent setup-drafts POS grossSales", () => {
  const padded = `${em}${amount}${em}`;
  const nbspPadded = `${nbsp}${amount}${nbsp}`;

  // Live inventing proof on Unicode trim / parseSetupNumber `\s` strip.
  assert.equal(padded.trim(), amount);
  assert.equal(nbspPadded.trim(), amount);
  assert.equal(padded.replace(/[$,\s]/g, ""), amount);
  assert.equal(nbspPadded.replace(/[$,\s]/g, ""), amount);
  assert.equal(Number(padded.replace(/[$,\s]/g, "")), 20);
  assert.equal(Number(nbspPadded.replace(/[$,\s]/g, "")), 20);

  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText(padded), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText(nbspPadded), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(padded), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(nbspPadded), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior empty → NaN review,
  // and must not invent an ok amount from a padded value.
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(`${em}${em}`), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(`${nbsp}${nbsp}`), { status: "empty" });
  assert.notDeepEqual(prepareSetupDraftsPosGrossSalesText(padded), { status: "empty" });
  assert.notDeepEqual(prepareSetupDraftsPosGrossSalesText(padded), {
    status: "ok",
    amount: 20,
    text: amount
  });

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,Chicken Bowl,Mains,2,${padded}`,
      `2026-08-01,Iced Tea,Drinks,1,${nbspPadded}`,
      `2026-08-01,Soup,Mains,1,${em}${em}`,
      "2026-08-01,Chicken Bowl,Mains,3,30"
    ].join("\n")
  );

  // Padded / soft-empty grossSales fail closed → gross_sales review.
  // Clean sibling still imports.
  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 1);
  assert.equal(result.rejectedRowCount, 3);
  assert.equal(result.rows[0]?.itemName, "Chicken Bowl");
  assert.equal(result.rows[0]?.grossSales, 30);
  assert.equal(
    result.issues.filter((issue) => issue.field === "gross_sales").length,
    3
  );
});

test("ASCII controls and malformed setup-drafts POS grossSales fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText("20\n30"), { status: "invalid" });
  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText("20\r30"), { status: "invalid" });
  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText("20\x0130"), { status: "invalid" });
  assert.deepEqual(canonicalizeSetupDraftsPosGrossSalesText("20\x7f30"), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("20\n30"), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("20\x7f30"), { status: "invalid" });
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText("abc"), { status: "invalid" });
  // Interior em-space must not invent via `\s` currency strip (`"20\u20030"` → `"200"`).
  assert.deepEqual(prepareSetupDraftsPosGrossSalesText(`20${em}0`), { status: "invalid" });

  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      `2026-08-01,Chicken Bowl,Mains,2,20${em}0`,
      "2026-08-01,Iced Tea,Drinks,1,abc",
      "2026-08-01,Soup,Mains,1,10"
    ].join("\n")
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 1);
  assert.equal(result.rejectedRowCount, 2);
  assert.equal(result.rows[0]?.itemName, "Soup");
  assert.equal(result.rows[0]?.grossSales, 10);
  assert.equal(
    result.issues.filter((issue) => issue.field === "gross_sales").length,
    2
  );
});
