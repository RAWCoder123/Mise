import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyInventoryCategoryIcon,
  normalizeInventoryCategoryIconToken
} from "../services/domain/inventoryCategoryIconIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/inventoryCategoryIconIdentity.ts", import.meta.url),
  "utf8"
);
const inventoryScreenSource = readFileSync(
  new URL("../app/(tabs)/inventory.tsx", import.meta.url),
  "utf8"
);

test("MISE-005KF pins Inventory categoryIcon classify to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005KF/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeInventoryCategoryIconToken("),
    domainSource.indexOf("function haystackIncludesAny(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(inventoryScreenSource, /classifyInventoryCategoryIcon/);

  const categoryIconBody = inventoryScreenSource.slice(
    inventoryScreenSource.indexOf("function categoryIcon("),
    inventoryScreenSource.indexOf("function InventoryListRow(")
  );
  assert.match(categoryIconBody, /classifyInventoryCategoryIcon\(category\)/);
  assert.doesNotMatch(categoryIconBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(categoryIconBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(categoryIconBody, /\.trim\(\)/);
});

test("ASCII C fold keeps ordinary Inventory category icon classification stable", () => {
  assert.equal(normalizeInventoryCategoryIconToken("  Chicken Breast  "), "chicken breast");
  assert.equal(normalizeInventoryCategoryIconToken("DAIRY"), "dairy");
  assert.equal(normalizeInventoryCategoryIconToken(null), "");
  assert.equal(normalizeInventoryCategoryIconToken(undefined), "");
  assert.equal(normalizeInventoryCategoryIconToken(""), "");
  assert.equal(normalizeInventoryCategoryIconToken("   "), "");

  assert.equal(classifyInventoryCategoryIcon("Protein"), "protein");
  assert.equal(classifyInventoryCategoryIcon("CHICKEN"), "protein");
  assert.equal(classifyInventoryCategoryIcon("beef stock"), "protein");
  assert.equal(classifyInventoryCategoryIcon("meat"), "protein");

  assert.equal(classifyInventoryCategoryIcon("Produce"), "produce");
  assert.equal(classifyInventoryCategoryIcon("Fresh Veg"), "produce");
  assert.equal(classifyInventoryCategoryIcon("fruit prep"), "produce");

  assert.equal(classifyInventoryCategoryIcon("Dairy"), "dairy");
  assert.equal(classifyInventoryCategoryIcon("MILK"), "dairy");
  assert.equal(classifyInventoryCategoryIcon("cheese"), "dairy");

  assert.equal(classifyInventoryCategoryIcon("Dry Goods"), "dry");
  assert.equal(classifyInventoryCategoryIcon("grain"), "dry");
  assert.equal(classifyInventoryCategoryIcon("flour"), "dry");
  assert.equal(classifyInventoryCategoryIcon("rice"), "dry");

  assert.equal(classifyInventoryCategoryIcon("Oils"), "liquid");
  assert.equal(classifyInventoryCategoryIcon("sauce"), "liquid");
  assert.equal(classifyInventoryCategoryIcon("liquid"), "liquid");

  assert.equal(classifyInventoryCategoryIcon("Other"), "package");
  assert.equal(classifyInventoryCategoryIcon(""), "package");
  assert.equal(classifyInventoryCategoryIcon("   "), "package");
  assert.equal(classifyInventoryCategoryIcon(null), "package");
});

test("ASCII C fold does not invent Kelvin-sign Inventory category icon identity", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken" / "milk".
  assert.equal(normalizeInventoryCategoryIconToken("chicKen"), "chicKen");
  assert.notEqual(
    normalizeInventoryCategoryIconToken("chicKen"),
    normalizeInventoryCategoryIconToken("chicken")
  );
  assert.equal("chicKen".toLowerCase(), "chicken");
  assert.equal("milK".toLowerCase(), "milk");

  assert.equal(classifyInventoryCategoryIcon("chicKen"), "package");
  assert.equal(classifyInventoryCategoryIcon("chicken"), "protein");

  assert.equal(classifyInventoryCategoryIcon("milK"), "package");
  assert.equal(classifyInventoryCategoryIcon("milk"), "dairy");

  assert.equal(classifyInventoryCategoryIcon("beeℱ"), "package");
  assert.equal(classifyInventoryCategoryIcon("Kelvin pantry"), "package");

  // NBSP-only padding is outside ASCII whitespace; do not treat it as a trim break.
  assert.equal(normalizeInventoryCategoryIconToken("\u00a0chicken\u00a0"), "\u00a0chicken\u00a0");
  assert.notEqual(
    normalizeInventoryCategoryIconToken("\u00a0chicken\u00a0"),
    normalizeInventoryCategoryIconToken("chicken")
  );
  // Contiguous ASCII keyword still matches when NBSP pads ends (same as Ask Mise tip).
  assert.equal(classifyInventoryCategoryIcon("\u00a0chicken\u00a0"), "protein");

  // Em space mid-string must not collapse into a matching space that invents
  // identity across lookalike keyword spellings.
  assert.equal(normalizeInventoryCategoryIconToken("chic\u2003ken"), "chic\u2003ken");
  assert.notEqual(
    normalizeInventoryCategoryIconToken("chic\u2003ken"),
    normalizeInventoryCategoryIconToken("chicken")
  );
  assert.equal(classifyInventoryCategoryIcon("chic\u2003ken"), "package");
});
