import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryHubUnit,
  canonicalizeInventoryHubUnit,
  normalizeInventoryHubUnit
} from "../services/domain/presentationInventoryHubUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryHubUnitIdentity.ts", import.meta.url),
  "utf8"
);
const hubSource = readFileSync(new URL("../app/(tabs)/inventory.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const detailUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailUnitIdentity.ts",
  import.meta.url
);
const hubItemIdentityPath = new URL(
  "../services/domain/presentationInventoryHubItemNameIdentity.ts",
  import.meta.url
);
const detailCategoryIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailCategoryIdentity.ts",
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

test("MISE-005AAG pins Inventory hub unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAG/);
  assert.match(hubSource, /MISE-005AAG/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryHubUnit\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    hubSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryHubUnitIdentity"/
  );
  assert.match(hubSource, /normalizeInventoryHubUnit\(/);
  assert.match(
    hubSource,
    /normalizeInventoryHubUnit\(\s*item\.unit\s*\)\s*\|\|\s*t\("inventory\.row\.unit\.none"\)/
  );
  assert.doesNotMatch(
    hubSource,
    /\$\{formatNumber\([^)]+\)\} \$\{item\.unit\}/
  );

  assert.match(catalogSource, /"inventory\.row\.unit\.none": "unit"/);
  assert.match(catalogSource, /"inventory\.row\.unit\.none": "unidad"/);
  assert.match(catalogSource, /"inventory\.row\.unit\.none": "单位"/);

  // Leave sibling detail-unit / hub item_name / category / inventoryUnits tips alone.
  assert.doesNotMatch(hubSource, /normalizeInventoryDetailUnit/);
  assert.doesNotMatch(hubSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(hubSource, /normalizeInventoryDetailCategory/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*inventoryUnits/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(detailUnitIdentityPath), "absent");
  assert.equal(filePresence(hubItemIdentityPath), "absent");
  assert.equal(filePresence(detailCategoryIdentityPath), "absent");
  assert.equal(filePresence(inventoryUnitsPath), "present");

  // Leave Inventory hub title / a11y item_name paths alone for #1056.
  assert.match(hubSource, /title=\{item\.item_name\}/);
  assert.match(
    hubSource,
    /accessibilityLabel=\{t\("inventory\.row\.accessibilityLedger", \{\s*item: item\.item_name/
  );

  // Leave hub search/filter matching on raw item fields.
  assert.match(hubSource, /item\.item_name\.toLowerCase\(\)\.includes\(normalized\)/);

  assert.equal(normalizeInventoryHubUnit(unit), unit);
  assert.equal(normalizeInventoryHubUnit(` ${unit} `), unit);
  assert.equal(normalizeInventoryHubUnit(`case ${unit}`), `case ${unit}`);
});

test("Unicode padding invents via trim and is soft-nulled for Inventory hub units", () => {
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
  assert.equal(asciiTrimInventoryHubUnit(padded), padded);
  assert.equal(canonicalizeInventoryHubUnit(padded), null);
  assert.equal(canonicalizeInventoryHubUnit(nbspName), null);
  assert.equal(normalizeInventoryHubUnit(padded), null);
  assert.equal(normalizeInventoryHubUnit(nbspName), null);
  assert.equal(normalizeInventoryHubUnit(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryHubUnit(internalEm), internalEm);
  assert.equal(normalizeInventoryHubUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryHubUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory hub units", () => {
  assert.equal(normalizeInventoryHubUnit(undefined), null);
  assert.equal(normalizeInventoryHubUnit(null), null);
  assert.equal(normalizeInventoryHubUnit(""), null);
  assert.equal(normalizeInventoryHubUnit("   "), null);
  assert.equal(normalizeInventoryHubUnit(123 as unknown as string), null);
  assert.equal(normalizeInventoryHubUnit(`\u0001${unit}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryHubUnit(`${unit}\t`), unit);
  assert.equal(normalizeInventoryHubUnit(`${unit}\u0007`), null);
  assert.equal(normalizeInventoryHubUnit(em), null);
});

test("Inventory hub bypass proof: empty and Unicode-only-space units soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking unit in the
  // OperationalRow quantity subtitle (`"12.0   · 3 days"`).
  assert.equal(normalizeInventoryHubUnit(""), null);
  assert.equal(normalizeInventoryHubUnit(em), null);
  assert.equal(normalizeInventoryHubUnit(nbsp), null);
  assert.match(
    hubSource,
    /normalizeInventoryHubUnit\(\s*item\.unit\s*\)\s*\|\|\s*t\("inventory\.row\.unit\.none"\)/
  );
  assert.match(hubSource, /inventoryHubDisplayUnit/);
  assert.match(
    hubSource,
    /\$\{formatNumber\([^)]+\)\} \$\{inventoryHubDisplayUnit\}/
  );
});

test("Inventory hub unit identity refuses Unicode inventing equality", () => {
  const padded = `${em}${unit}${em}`;
  assert.notEqual(asciiTrimInventoryHubUnit(padded), padded.trim());
  assert.equal(normalizeInventoryHubUnit(padded), null);
  assert.equal(normalizeInventoryHubUnit(`\t${unit}\n`), unit);
});
