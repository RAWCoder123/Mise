import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimScanItemQuantityUnit,
  canonicalizeScanItemQuantityUnit,
  normalizeScanItemQuantityUnit
} from "../services/domain/presentationScanItemQuantityUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationScanItemQuantityUnitIdentity.ts", import.meta.url),
  "utf8"
);
const scanItemSource = readFileSync(new URL("../app/more/scan-item.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const rowCategoryIdentityPath = new URL(
  "../services/domain/presentationScanItemRowCategoryIdentity.ts",
  import.meta.url
);
const rowItemNameIdentityPath = new URL(
  "../services/domain/presentationScanItemRowItemNameIdentity.ts",
  import.meta.url
);
const hubUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryHubUnitIdentity.ts",
  import.meta.url
);
const detailUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailUnitIdentity.ts",
  import.meta.url
);
const inventoryUnitsPath = new URL("../services/domain/inventoryUnits.ts", import.meta.url);

const unit = "cs";
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

test("MISE-005AAH pins Scan Item quantity unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAH/);
  assert.match(scanItemSource, /MISE-005AAH/);

  assert.match(
    identitySource,
    /export function asciiTrimScanItemQuantityUnit\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    scanItemSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationScanItemQuantityUnitIdentity"/
  );
  assert.match(scanItemSource, /normalizeScanItemQuantityUnit\(/);
  assert.match(
    scanItemSource,
    /normalizeScanItemQuantityUnit\(\s*item\.unit\s*\)\s*\|\|\s*t\("scanItem\.row\.unit\.none"\)/
  );
  assert.doesNotMatch(
    scanItemSource,
    /\$\{formatNumber\([^)]+\)\} \$\{item\.unit\}/
  );

  assert.match(catalogSource, /"scanItem\.row\.unit\.none": "unit"/);
  assert.match(catalogSource, /"scanItem\.row\.unit\.none": "unidad"/);
  assert.match(catalogSource, /"scanItem\.row\.unit\.none": "单位"/);

  // Leave sibling Scan Item category / item_name / hub+detail unit tips alone.
  assert.doesNotMatch(scanItemSource, /normalizeScanItemRowCategory/);
  assert.doesNotMatch(scanItemSource, /normalizeScanItemRowItemName/);
  assert.doesNotMatch(scanItemSource, /normalizeInventoryHubUnit/);
  assert.doesNotMatch(scanItemSource, /normalizeInventoryDetailUnit/);
  assert.doesNotMatch(identitySource, /presentationScanItemRowCategoryIdentity/);
  assert.doesNotMatch(identitySource, /presentationScanItemRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailUnitIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*inventoryUnits/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(rowCategoryIdentityPath), "absent");
  assert.equal(filePresence(rowItemNameIdentityPath), "absent");
  assert.equal(filePresence(hubUnitIdentityPath), "absent");
  assert.equal(filePresence(detailUnitIdentityPath), "absent");
  assert.equal(filePresence(inventoryUnitsPath), "present");

  // Leave Scan Item row title / meta category / a11y item_name paths alone.
  assert.match(scanItemSource, /title=\{item\.item_name\}/);
  assert.match(
    scanItemSource,
    /subtitle=\{t\("scanItem\.row\.meta", \{\s*category: item\.category,\s*code: item\.id/
  );
  assert.match(
    scanItemSource,
    /accessibilityLabel=\{t\("scanItem\.row\.accessibility", \{ item: item\.item_name \}\)/
  );

  // Leave Scan Item search/filter matching on raw item fields.
  assert.match(
    scanItemSource,
    /const haystack = \[item\.item_name, item\.id, item\.category, item\.supplier_name, item\.unit\]/
  );

  assert.equal(normalizeScanItemQuantityUnit(unit), unit);
  assert.equal(normalizeScanItemQuantityUnit(` ${unit} `), unit);
  assert.equal(normalizeScanItemQuantityUnit(`case ${unit}`), `case ${unit}`);
});

test("Unicode padding invents via trim and is soft-nulled for Scan Item quantity units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspName = `${nbsp}${unit}${nbsp}`;
  const internalEm = `c${em}s`;
  const internalNbsp = `c${nbsp}s`;

  // Inventing proof: Unicode trim would invent the clean unit.
  assert.equal(padded.trim(), unit);
  assert.equal(nbspName.trim(), unit);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimScanItemQuantityUnit(padded), padded);
  assert.equal(canonicalizeScanItemQuantityUnit(padded), null);
  assert.equal(canonicalizeScanItemQuantityUnit(nbspName), null);
  assert.equal(normalizeScanItemQuantityUnit(padded), null);
  assert.equal(normalizeScanItemQuantityUnit(nbspName), null);
  assert.equal(normalizeScanItemQuantityUnit(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeScanItemQuantityUnit(internalEm), internalEm);
  assert.equal(normalizeScanItemQuantityUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeScanItemQuantityUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Scan Item quantity units", () => {
  assert.equal(normalizeScanItemQuantityUnit(undefined), null);
  assert.equal(normalizeScanItemQuantityUnit(null), null);
  assert.equal(normalizeScanItemQuantityUnit(""), null);
  assert.equal(normalizeScanItemQuantityUnit("   "), null);
  assert.equal(normalizeScanItemQuantityUnit(123 as unknown as string), null);
  assert.equal(normalizeScanItemQuantityUnit(`\u0001${unit}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeScanItemQuantityUnit(`${unit}\t`), unit);
  assert.equal(normalizeScanItemQuantityUnit(`${unit}\u0007`), null);
  assert.equal(normalizeScanItemQuantityUnit(em), null);
});

test("Scan Item quantity bypass proof: empty and Unicode-only-space units soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking unit in the
  // OperationalRow quantity value (`"12.0  "`).
  assert.equal(normalizeScanItemQuantityUnit(""), null);
  assert.equal(normalizeScanItemQuantityUnit(em), null);
  assert.equal(normalizeScanItemQuantityUnit(nbsp), null);
  assert.match(
    scanItemSource,
    /normalizeScanItemQuantityUnit\(\s*item\.unit\s*\)\s*\|\|\s*t\("scanItem\.row\.unit\.none"\)/
  );
  assert.match(scanItemSource, /scanItemQuantityDisplayUnit/);
  assert.match(
    scanItemSource,
    /\$\{formatNumber\([^)]+\)\} \$\{scanItemQuantityDisplayUnit\}/
  );
});

test("Scan Item quantity unit identity refuses Unicode inventing equality", () => {
  const padded = `${em}${unit}${em}`;
  assert.notEqual(asciiTrimScanItemQuantityUnit(padded), padded.trim());
  assert.equal(normalizeScanItemQuantityUnit(padded), null);
  assert.equal(normalizeScanItemQuantityUnit(`\t${unit}\n`), unit);
});
