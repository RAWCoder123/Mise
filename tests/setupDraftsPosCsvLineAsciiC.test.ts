import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsPosCsvLineText,
  canonicalizeSetupDraftsPosCsvLineText,
  prepareSetupDraftsPosCsvLineText
} from "../services/domain/setupDraftsPosCsvLineIdentity";
import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsPosCsvLineIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);
const replaceableSource = readFileSync(
  new URL("../services/demo/replaceableDemoData.ts", import.meta.url),
  "utf8"
);

const dataLine = "2026-08-01,Chicken Bowl,Mains,2,20";
const headerLine = "sale_date,item_name,category,quantity_sold,gross_sales";
const accentedLine = "2026-08-01,Café Latte,Boissons,1,5";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RV pins setup-drafts POS CSV line identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RV/);
  assert.match(setupDraftsSource, /MISE-005RV/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsPosCsvLineText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupDraftsSource,
    /from "\.\/setupDraftsPosCsvLineIdentity"/
  );
  assert.match(setupDraftsSource, /prepareSetupDraftsPosCsvLineText\(/);
  assert.match(setupDraftsSource, /preparedLine\.status !== "ok"/);
  assert.match(setupDraftsSource, /return preparedLine\.text;/);
  assert.doesNotMatch(setupDraftsSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Leave itemName / category bare Unicode trim alone (open #872 / MISE-005QL).
  assert.match(setupDraftsSource, /\(record\.itemName \?\? ""\)\.trim\(\)/);
  assert.match(setupDraftsSource, /\(record\.category \?\? ""\)\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupPosItemLabel\(/);
  assert.doesNotMatch(setupDraftsSource, /setupPosItemLabelIdentity/);

  // Leave saleDate bare normalize alone (open #871 / MISE-005QK).
  assert.match(setupDraftsSource, /normalizeSaleDate\(record\.saleDate \?\? ""\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupPosSaleDate\(/);
  assert.doesNotMatch(setupDraftsSource, /setupPosSaleDateIdentity/);

  // Leave setup-drafts dishName inventing alone (open #900 / MISE-005RN).
  assert.match(setupDraftsSource, /const dishName = recipe\.dishName\.trim\(\);/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeDishNameText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsRecipeDishNameIdentity/);

  // Leave demo recipe-baseline line.trim alone (open #907 / MISE-005RU).
  assert.match(replaceableSource, /\.map\(\(line\) => line\.trim\(\)\)/);
  assert.doesNotMatch(replaceableSource, /setupDraftsPosCsvLineIdentity/);
  assert.doesNotMatch(replaceableSource, /prepareSetupDraftsPosCsvLineText\(/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /normalizeSetupPosItemLabel/);
  assert.doesNotMatch(identitySource, /setupPosItemLabelIdentity/);
  assert.doesNotMatch(identitySource, /normalizeSetupPosSaleDate/);
  assert.doesNotMatch(identitySource, /setupPosSaleDateIdentity/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeDishNameText/);
  assert.doesNotMatch(identitySource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(identitySource, /prepareDemoRecipeBaselineLineText/);
  assert.doesNotMatch(identitySource, /demoRecipeBaselineLineIdentity/);
  assert.doesNotMatch(identitySource, /asciiCTrim/);
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/setupPosItemLabelIdentity["']/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/setupPosSaleDateIdentity["']/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/demoRecipeBaselineLineIdentity["']/
  );
});

test("ASCII trim keeps ordinary setup-drafts POS CSV lines stable", () => {
  assert.equal(asciiTrimSetupDraftsPosCsvLineText(`  ${dataLine}  `), dataLine);
  assert.equal(asciiTrimSetupDraftsPosCsvLineText(`\t${dataLine}\n`), dataLine);
  assert.deepEqual(canonicalizeSetupDraftsPosCsvLineText(`  ${dataLine}  `), {
    status: "ok",
    text: dataLine
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(`  ${dataLine}  `), {
    status: "ok",
    text: dataLine
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(accentedLine), {
    status: "ok",
    text: accentedLine
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(headerLine), {
    status: "ok",
    text: headerLine
  });

  // Soft empty stays empty (prior line.trim() empty path).
  assert.deepEqual(prepareSetupDraftsPosCsvLineText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(""), { status: "empty" });

  const result = parseSetupPosSalesCsv(
    [
      headerLine,
      `  ${dataLine}  `,
      "2026-08-01,Iced Tea,Drinks,1,4"
    ].join("\n")
  );

  assert.equal(result.status, "ready");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 0);
  assert.equal(result.rows[0]?.itemName, "Chicken Bowl");
  assert.equal(result.rows[0]?.category, "Mains");
  assert.equal(result.rows[1]?.itemName, "Iced Tea");
});

test("NBSP and em-space padding cannot invent a clean setup-drafts POS CSV line", () => {
  const nbspLine = `${nbsp}${dataLine}${nbsp}`;
  const emLine = `${em}${dataLine}${em}`;

  // Live inventing proof on Unicode trim (what line.trim() previously did).
  assert.equal(nbspLine.trim(), dataLine);
  assert.equal(emLine.trim(), dataLine);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeSetupDraftsPosCsvLineText(nbspLine), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupDraftsPosCsvLineText(emLine), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(nbspLine), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(emLine), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior empty path,
  // and must not invent an ok draft from a padded line.
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupDraftsPosCsvLineText(emLine), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupDraftsPosCsvLineText(emLine), {
    status: "ok",
    text: dataLine
  });

  // Internal Unicode spaces are not stripped; they remain durable content
  // (and typically fail cell parse rather than inventing a clean accept).
  assert.deepEqual(
    prepareSetupDraftsPosCsvLineText(`2026-08-01,Chicken${em}Bowl,Mains,2,20`),
    {
      status: "ok",
      text: `2026-08-01,Chicken${em}Bowl,Mains,2,20`
    }
  );

  // Durable parse path: Unicode-padded lines fail closed and do not invent
  // clean accepted POS sales rows. Keep cell tokens ASCII-clean inside the
  // line so this tip does not depend on open #872 / MISE-005QL or #871 /
  // MISE-005QK.
  const invented = parseSetupPosSalesCsv(
    [headerLine, `${em}${dataLine}${em}`].join("\n")
  );
  assert.equal(invented.status, "empty");
  assert.equal(invented.acceptedRowCount, 0);
  assert.equal(invented.rejectedRowCount, 0);
  assert.equal(invented.rows.length, 0);
  assert.equal(
    invented.rows.filter((row) => row.itemName === "Chicken Bowl").length,
    0
  );

  const nbspInvented = parseSetupPosSalesCsv(
    [headerLine, `${nbsp}${dataLine}${nbsp}`].join("\n")
  );
  assert.equal(nbspInvented.status, "empty");
  assert.equal(nbspInvented.acceptedRowCount, 0);
  assert.equal(nbspInvented.rows.length, 0);

  const clean = parseSetupPosSalesCsv(
    [headerLine, `  ${dataLine}  `].join("\n")
  );
  assert.equal(clean.status, "ready");
  assert.equal(clean.acceptedRowCount, 1);
  assert.equal(clean.rows[0]?.itemName, "Chicken Bowl");
  assert.equal(clean.rows[0]?.category, "Mains");
  assert.equal(clean.rows[0]?.saleDate, "2026-08-01");

  // Mixed multiline: padded line skipped, ASCII-clean sibling still imports.
  const mixed = parseSetupPosSalesCsv(
    [
      headerLine,
      `${em}${dataLine}${em}`,
      "2026-08-01,Iced Tea,Drinks,1,4"
    ].join("\n")
  );
  assert.equal(mixed.status, "ready");
  assert.equal(mixed.acceptedRowCount, 1);
  assert.equal(mixed.rejectedRowCount, 0);
  assert.equal(mixed.rows.length, 1);
  assert.equal(mixed.rows[0]?.itemName, "Iced Tea");
  assert.equal(
    mixed.rows.filter((row) => row.itemName === "Chicken Bowl").length,
    0
  );
});

test("ASCII controls and non-string setup-drafts POS CSV line drafts fail closed without inventing", () => {
  assert.deepEqual(
    canonicalizeSetupDraftsPosCsvLineText("2026-08-01,Chicken\nBowl,Mains,2,20"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeSetupDraftsPosCsvLineText("2026-08-01,Chicken\rBowl,Mains,2,20"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeSetupDraftsPosCsvLineText("2026-08-01,Chicken\x01Bowl,Mains,2,20"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeSetupDraftsPosCsvLineText("2026-08-01,Chicken\x7fBowl,Mains,2,20"),
    { status: "invalid" }
  );
  assert.deepEqual(
    prepareSetupDraftsPosCsvLineText("2026-08-01,Chicken\nBowl,Mains,2,20"),
    { status: "invalid" }
  );
  assert.deepEqual(
    prepareSetupDraftsPosCsvLineText("2026-08-01,Chicken\x7fBowl,Mains,2,20"),
    { status: "invalid" }
  );

  assert.deepEqual(prepareSetupDraftsPosCsvLineText(null), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupDraftsPosCsvLineText(12), {
    status: "invalid"
  });

  const controlLine = parseSetupPosSalesCsv(
    [headerLine, "2026-08-01,Chicken\x01Bowl,Mains,2,20"].join("\n")
  );
  assert.equal(controlLine.status, "empty");
  assert.equal(controlLine.acceptedRowCount, 0);
  assert.equal(controlLine.rows.length, 0);
});
