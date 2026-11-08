import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimScanItemRowCategory,
  canonicalizeScanItemRowCategory,
  normalizeScanItemRowCategory
} from "../services/domain/presentationScanItemRowCategoryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationScanItemRowCategoryIdentity.ts", import.meta.url),
  "utf8"
);
const scanItemSource = readFileSync(new URL("../app/more/scan-item.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const rowItemNameIdentityPath = new URL(
  "../services/domain/presentationScanItemRowItemNameIdentity.ts",
  import.meta.url
);
const detailCategoryIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailCategoryIdentity.ts",
  import.meta.url
);
const categoryIconPath = new URL(
  "../services/domain/presentationInventoryCategoryIconIdentity.ts",
  import.meta.url
);

const category = "Produce";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005AAE pins Scan Item row category to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAE/);
  assert.match(scanItemSource, /MISE-005AAE/);

  assert.match(
    identitySource,
    /export function asciiTrimScanItemRowCategory\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    scanItemSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationScanItemRowCategoryIdentity"/
  );
  assert.match(scanItemSource, /normalizeScanItemRowCategory\(/);
  assert.match(
    scanItemSource,
    /normalizeScanItemRowCategory\(\s*item\.category\s*\)\s*\|\|\s*t\("scanItem\.row\.category\.none"\)/
  );
  assert.doesNotMatch(
    scanItemSource,
    /subtitle=\{t\("scanItem\.row\.meta", \{\s*category: item\.category,/
  );

  assert.match(catalogSource, /"scanItem\.row\.category\.none": "Category"/);
  assert.match(catalogSource, /"scanItem\.row\.category\.none": "Categoría"/);
  assert.match(catalogSource, /"scanItem\.row\.category\.none": "类别"/);

  // Leave sibling Scan Item item_name / Inventory detail category / categoryIcon tips alone.
  assert.doesNotMatch(scanItemSource, /normalizeScanItemRowItemName/);
  assert.doesNotMatch(scanItemSource, /normalizeInventoryDetailCategory/);
  assert.doesNotMatch(identitySource, /presentationScanItemRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailCategoryIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(rowItemNameIdentityPath), "absent");
  assert.equal(filePresence(detailCategoryIdentityPath), "absent");
  assert.equal(filePresence(categoryIconPath), "absent");

  // Leave Scan Item row title item.item_name and search haystack alone.
  assert.match(scanItemSource, /title=\{item\.item_name\}/);
  assert.match(
    scanItemSource,
    /const haystack = \[item\.item_name, item\.id, item\.category, item\.supplier_name, item\.unit\]/
  );
  assert.match(
    scanItemSource,
    /subtitle=\{t\("scanItem\.row\.meta", \{\s*category: displayCategory,\s*code: item\.id/
  );

  assert.equal(normalizeScanItemRowCategory(category), category);
  assert.equal(normalizeScanItemRowCategory(` ${category} `), category);
  assert.equal(
    normalizeScanItemRowCategory(`Fresh ${category}`),
    `Fresh ${category}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Scan Item row categories", () => {
  const padded = `${em}${category}${em}`;
  const nbspName = `${nbsp}${category}${nbsp}`;
  const internalEm = `Pro${em}duce`;
  const internalNbsp = `Pro${nbsp}duce`;

  // Inventing proof: Unicode trim would invent the clean category.
  assert.equal(padded.trim(), category);
  assert.equal(nbspName.trim(), category);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimScanItemRowCategory(padded), padded);
  assert.equal(canonicalizeScanItemRowCategory(padded), null);
  assert.equal(canonicalizeScanItemRowCategory(nbspName), null);
  assert.equal(normalizeScanItemRowCategory(padded), null);
  assert.equal(normalizeScanItemRowCategory(nbspName), null);
  assert.equal(normalizeScanItemRowCategory(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeScanItemRowCategory(internalEm), internalEm);
  assert.equal(normalizeScanItemRowCategory(internalNbsp), internalNbsp);
  assert.equal(normalizeScanItemRowCategory(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Scan Item row categories", () => {
  assert.equal(normalizeScanItemRowCategory(undefined), null);
  assert.equal(normalizeScanItemRowCategory(null), null);
  assert.equal(normalizeScanItemRowCategory(""), null);
  assert.equal(normalizeScanItemRowCategory("   "), null);
  assert.equal(normalizeScanItemRowCategory(123 as unknown as string), null);
  assert.equal(normalizeScanItemRowCategory(`\u0001${category}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeScanItemRowCategory(`${category}\t`), category);
  assert.equal(normalizeScanItemRowCategory(`${category}\u0007`), null);
  assert.equal(normalizeScanItemRowCategory(em), null);
});

test("Scan Item row bypass proof: empty and Unicode-only-space categories soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking category before
  // the code separator (`" · abc"` / `"  · abc"`).
  assert.equal(normalizeScanItemRowCategory(""), null);
  assert.equal(normalizeScanItemRowCategory(em), null);
  assert.equal(normalizeScanItemRowCategory(nbsp), null);
  assert.match(
    scanItemSource,
    /normalizeScanItemRowCategory\(\s*item\.category\s*\)\s*\|\|\s*t\("scanItem\.row\.category\.none"\)/
  );
});

test("Scan Item row category identity refuses Unicode inventing equality", () => {
  const padded = `${em}${category}${em}`;
  assert.notEqual(asciiTrimScanItemRowCategory(padded), padded.trim());
  assert.equal(normalizeScanItemRowCategory(padded), null);
  assert.equal(normalizeScanItemRowCategory(`\t${category}\n`), category);
});
