import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailAddAccessibilityItemName,
  canonicalizeInventoryDetailAddAccessibilityItemName,
  normalizeInventoryDetailAddAccessibilityItemName
} from "../services/domain/presentationInventoryDetailAddAccessibilityItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationInventoryDetailAddAccessibilityItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XJ pins Inventory detail add-action a11y item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005XJ/);
  assert.match(inventoryDetailSource, /MISE-005XJ/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailAddAccessibilityItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    inventoryDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryDetailAddAccessibilityItemNameIdentity"/
  );
  assert.match(inventoryDetailSource, /normalizeInventoryDetailAddAccessibilityItemName\(/);
  assert.match(
    inventoryDetailSource,
    /normalizeInventoryDetailAddAccessibilityItemName\(item\.item_name\)\s*\|\|\s*t\("inventory\.detail\.add\.item\.none"\)/
  );
  assert.match(
    inventoryDetailSource,
    /t\("inventory\.detail\.addAccessibility", \{\s*(?:\/\/[^\n]*\n\s*)*item:\s*normalizeInventoryDetailAddAccessibilityItemName\(item\.item_name\)\s*\|\|\s*t\("inventory\.detail\.add\.item\.none"\)\s*\}\)/
  );
  assert.doesNotMatch(
    inventoryDetailSource,
    /accessibilityLabel=\{t\("inventory\.detail\.addAccessibility", \{ item: item\.item_name \}\)/
  );

  assert.match(catalogSource, /"inventory\.detail\.add\.item\.none": "Item"/);
  assert.match(catalogSource, /"inventory\.detail\.add\.item\.none": "Artículo"/);
  assert.match(catalogSource, /"inventory\.detail\.add\.item\.none": "项目"/);

  // Leave Inventory detail Screen title raw ?? path alone on main (open #1017).
  assert.match(
    inventoryDetailSource,
    /title=\{item\?\.item_name \?\? t\("inventory\.detail\.title"\)\}/
  );
  assert.doesNotMatch(inventoryDetailSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(itemName), itemName);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeInventoryDetailAddAccessibilityItemName(`Case-${itemName}`),
    `Case-${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Inventory detail add-action a11y item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes`;
  const internalNbsp = `Roma${nbsp}Tomatoes`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInventoryDetailAddAccessibilityItemName(padded), padded);
  assert.equal(canonicalizeInventoryDetailAddAccessibilityItemName(padded), null);
  assert.equal(canonicalizeInventoryDetailAddAccessibilityItemName(nbspName), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(padded), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(nbspName), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryDetailAddAccessibilityItemName(internalEm), internalEm);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory detail add-action a11y item names", () => {
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(undefined), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(null), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(""), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName("   "), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(123 as unknown as string), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(em), null);
});

test("Inventory detail add-action a11y bypass proof: empty and Unicode-only-space item names soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking item into a11y.
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(""), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(em), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    inventoryDetailSource,
    /normalizeInventoryDetailAddAccessibilityItemName\(item\.item_name\)\s*\|\|\s*t\("inventory\.detail\.add\.item\.none"\)/
  );
});

test("Inventory detail add-action a11y item_name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimInventoryDetailAddAccessibilityItemName(padded), padded.trim());
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(padded), null);
  assert.equal(normalizeInventoryDetailAddAccessibilityItemName(`\t${itemName}\n`), itemName);
});
