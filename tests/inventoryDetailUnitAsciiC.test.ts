import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailUnit,
  canonicalizeInventoryDetailUnit,
  normalizeInventoryDetailUnit
} from "../services/domain/presentationInventoryDetailUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryDetailUnitIdentity.ts", import.meta.url),
  "utf8"
);
const detailSource = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const categoryIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailCategoryIdentity.ts",
  import.meta.url
);
const supplierIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailSupplierNameIdentity.ts",
  import.meta.url
);
const hubItemIdentityPath = new URL(
  "../services/domain/presentationInventoryHubItemNameIdentity.ts",
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

test("MISE-005AAF pins Inventory detail unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAF/);
  assert.match(detailSource, /MISE-005AAF/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailUnit\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    detailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryDetailUnitIdentity"/
  );
  assert.match(detailSource, /normalizeInventoryDetailUnit\(/);
  assert.match(
    detailSource,
    /normalizeInventoryDetailUnit\(\s*item\.unit\s*\)\s*\|\|\s*t\("inventory\.detail\.unit\.none"\)/
  );
  assert.doesNotMatch(
    detailSource,
    /t\("inventory\.detail\.perDay",\s*\{\s*unit:\s*item\.unit\s*\}\)/
  );
  assert.doesNotMatch(
    detailSource,
    /t\("inventory\.detail\.parLevel",\s*\{\s*unit:\s*item\.unit\s*\}\)/
  );
  assert.doesNotMatch(
    detailSource,
    /t\("inventory\.detail\.reorderThreshold",\s*\{\s*unit:\s*item\.unit\s*\}\)/
  );
  assert.doesNotMatch(
    detailSource,
    /\$\{formatNumber\([^)]+\)\} \$\{item\.unit\}/
  );

  assert.match(catalogSource, /"inventory\.detail\.unit\.none": "unit"/);
  assert.match(catalogSource, /"inventory\.detail\.unit\.none": "unidad"/);
  assert.match(catalogSource, /"inventory\.detail\.unit\.none": "单位"/);

  // Leave sibling category / supplier / title / hub / inventoryUnits tips alone.
  assert.doesNotMatch(detailSource, /normalizeInventoryDetailCategory/);
  assert.doesNotMatch(detailSource, /normalizeInventoryDetailSupplierName/);
  assert.doesNotMatch(detailSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailCategoryIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*inventoryUnits/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(categoryIdentityPath), "absent");
  assert.equal(filePresence(supplierIdentityPath), "absent");
  assert.equal(filePresence(hubItemIdentityPath), "absent");
  assert.equal(filePresence(inventoryUnitsPath), "present");

  // Leave Inventory detail title / subtitle category / supplier paths alone.
  assert.match(detailSource, /title=\{item\?\.item_name \?\? t\("inventory\.detail\.title"\)\}/);
  assert.match(
    detailSource,
    /subtitle=\{item \? `\$\{item\.supplier_name\} · \$\{item\.category\}`/
  );

  // Leave controlled canonical-unit ops labels alone.
  assert.match(detailSource, /inventory\.ops\.unit\.\$\{canonicalUnit\}/);

  assert.equal(normalizeInventoryDetailUnit(unit), unit);
  assert.equal(normalizeInventoryDetailUnit(` ${unit} `), unit);
  assert.equal(normalizeInventoryDetailUnit(`case ${unit}`), `case ${unit}`);
});

test("Unicode padding invents via trim and is soft-nulled for Inventory detail units", () => {
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
  assert.equal(asciiTrimInventoryDetailUnit(padded), padded);
  assert.equal(canonicalizeInventoryDetailUnit(padded), null);
  assert.equal(canonicalizeInventoryDetailUnit(nbspName), null);
  assert.equal(normalizeInventoryDetailUnit(padded), null);
  assert.equal(normalizeInventoryDetailUnit(nbspName), null);
  assert.equal(normalizeInventoryDetailUnit(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryDetailUnit(internalEm), internalEm);
  assert.equal(normalizeInventoryDetailUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryDetailUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory detail units", () => {
  assert.equal(normalizeInventoryDetailUnit(undefined), null);
  assert.equal(normalizeInventoryDetailUnit(null), null);
  assert.equal(normalizeInventoryDetailUnit(""), null);
  assert.equal(normalizeInventoryDetailUnit("   "), null);
  assert.equal(normalizeInventoryDetailUnit(123 as unknown as string), null);
  assert.equal(normalizeInventoryDetailUnit(`\u0001${unit}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryDetailUnit(`${unit}\t`), unit);
  assert.equal(normalizeInventoryDetailUnit(`${unit}\u0007`), null);
  assert.equal(normalizeInventoryDetailUnit(em), null);
});

test("Inventory detail bypass proof: empty and Unicode-only-space units soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking unit in quantity
  // suffixes (`"12.0 "`) and label shells (`"Par level ()"` / `" per day"`).
  assert.equal(normalizeInventoryDetailUnit(""), null);
  assert.equal(normalizeInventoryDetailUnit(em), null);
  assert.equal(normalizeInventoryDetailUnit(nbsp), null);
  assert.match(
    detailSource,
    /normalizeInventoryDetailUnit\(\s*item\.unit\s*\)\s*\|\|\s*t\("inventory\.detail\.unit\.none"\)/
  );
  assert.match(detailSource, /inventoryDetailDisplayUnit/);
  assert.match(
    detailSource,
    /t\("inventory\.detail\.perDay",\s*\{\s*unit:\s*inventoryDetailDisplayUnit\s*\}\)/
  );
  assert.match(
    detailSource,
    /t\("inventory\.detail\.parLevel",\s*\{\s*unit:\s*inventoryDetailDisplayUnit\s*\}\)/
  );
  assert.match(
    detailSource,
    /t\("inventory\.detail\.reorderThreshold",\s*\{\s*unit:\s*inventoryDetailDisplayUnit\s*\}\)/
  );
});

test("Inventory detail unit identity refuses Unicode inventing equality", () => {
  const padded = `${em}${unit}${em}`;
  assert.notEqual(asciiTrimInventoryDetailUnit(padded), padded.trim());
  assert.equal(normalizeInventoryDetailUnit(padded), null);
  assert.equal(normalizeInventoryDetailUnit(`\t${unit}\n`), unit);
});
